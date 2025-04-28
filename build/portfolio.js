import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { ethers } from "ethers";
import { z } from "zod";
console.error("Starting MCP server...");
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "user-portfolio",
    version: "0.0.1",
    capabilities: ["portfolio"],
});
const BLOCKVISION_API_KEY = process.env.BLOCKVISION_API_KEY;
const BLOCKVISION_BASE_URL = "https://api.blockvision.org/v2/monad";
server.tool("portfolio", "Analyze a complete portfolio of an address on Monad Testnet", {
    address: z.string().describe("Address of the portfolio to analyze"),
    includeErc20: z.boolean().default(true).describe("Include ERC20 tokens"),
    includeNfts: z
        .boolean()
        .default(true)
        .describe("Include NFTs (ERC721 and ERC1155)"),
    includeLiquidityPositions: z
        .boolean()
        .default(true)
        .describe("Include liquidity positions on DEXes"),
    includeTransactionHistory: z
        .boolean()
        .default(true)
        .describe("Include recent transaction history"),
    transactionLimit: z
        .number()
        .default(10)
        .describe("Number of recent transactions to include"),
    erc20TokensLimit: z
        .number()
        .default(50)
        .describe("Maximum number of ERC20 tokens to analyze"),
    nftsLimit: z
        .number()
        .default(20)
        .describe("Maximum number of NFTs to retrieve"),
}, async ({ address, includeErc20, includeNfts, includeLiquidityPositions, includeTransactionHistory, transactionLimit, erc20TokensLimit, nftsLimit, }) => {
    try {
        if (!ethers.isAddress(address)) {
            throw new Error(`Invalid address: ${address}`);
        }
        if (!BLOCKVISION_API_KEY) {
            throw new Error("BlockVision API key is required");
        }
        console.error(`Analyzing portfolio for address: ${address}`);
        // Final result
        const result = {
            erc20Tokens: [],
            nfts: { erc721: [], erc1155: [] },
            liquidityPositions: [],
            transactions: [],
            holdingHistory: [],
            performanceMetrics: {
                totalPnL: "0",
                totalPnLPercentage: "0",
                averageHoldingTime: "0",
                largestTransaction: "0",
                transactionCount: 0,
                inflow: "0",
                outflow: "0",
            },
        };
        // 1. Get native MON balance
        const nativeBalance = await provider.getBalance(address);
        result.nativeBalance = ethers.formatEther(nativeBalance) + " MON";
        console.error(`Native balance: ${result.nativeBalance}`);
        // 2. Get ERC20 tokens using BlockVision API
        try {
            const response = await axios.get(`${BLOCKVISION_BASE_URL}/account/tokens?address=${address}`, {
                headers: {
                    "x-api-key": BLOCKVISION_API_KEY,
                },
            });
            if (response.data.code === 0) {
                result.erc20Tokens = response.data.result.data
                    .slice(0, erc20TokensLimit)
                    .map((token) => ({
                    address: token.contractAddress,
                    name: token.name,
                    symbol: token.symbol,
                    balance: token.balance,
                    decimals: token.decimal,
                    verified: token.verified,
                    price: token.price,
                    usdValue: token.usdValue,
                }));
                console.error(`Found ${result.erc20Tokens.length} ERC20 tokens`);
            }
        }
        catch (error) {
            console.error("Error fetching ERC20 tokens from BlockVision:", error);
        }
        // 3. Get NFTs using BlockVision API
        result.nfts = {
            erc721: [],
            erc1155: [],
        };
        try {
            const response = await axios.get(`${BLOCKVISION_BASE_URL}/account/nfts`, {
                headers: {
                    "x-api-key": BLOCKVISION_API_KEY,
                },
                params: {
                    address,
                },
            });
            if (response.data.code === 0) {
                const collections = response.data.result.data;
                for (const collection of collections) {
                    if (collection.ercStandard === "ERC721") {
                        for (const item of collection.items) {
                            result.nfts.erc721.push({
                                contractAddress: item.contractAddress,
                                collectionName: collection.name,
                                tokenId: item.tokenId,
                                name: item.name,
                                imageURL: item.image || collection.image,
                                verified: collection.verified,
                            });
                        }
                    }
                    else if (collection.ercStandard === "ERC1155") {
                        for (const item of collection.items) {
                            result.nfts.erc1155.push({
                                contractAddress: item.contractAddress,
                                tokenId: item.tokenId,
                                name: item.name,
                                balance: item.qty,
                                imageURL: item.image || collection.image,
                                verified: collection.verified,
                            });
                        }
                    }
                }
                // Apply limits
                if (result.nfts.erc721.length > nftsLimit) {
                    result.nfts.erc721 = result.nfts.erc721.slice(0, nftsLimit);
                }
                if (result.nfts.erc1155.length > nftsLimit) {
                    result.nfts.erc1155 = result.nfts.erc1155.slice(0, nftsLimit);
                }
                console.error(`Found ${result.nfts.erc721.length} ERC721 NFTs and ${result.nfts.erc1155.length} ERC1155 NFTs`);
            }
        }
        catch (error) {
            console.error("Error fetching NFTs from BlockVision:", error);
        }
        // 4. Get transaction history using BlockVision API
        if (includeTransactionHistory) {
            try {
                const response = await axios.get(`${BLOCKVISION_BASE_URL}/account/transactions`, {
                    headers: {
                        "x-api-key": BLOCKVISION_API_KEY,
                    },
                    params: {
                        address,
                        limit: transactionLimit,
                    },
                });
                if (response.data.code === 0) {
                    result.transactions = response.data.result.data.map((tx) => ({
                        hash: tx.hash,
                        blockNumber: tx.blockNumber,
                        timestamp: tx.timestamp,
                        from: tx.from,
                        to: tx.to,
                        value: tx.value,
                        transactionFee: tx.transactionFee,
                        gasUsed: tx.gasUsed,
                        status: tx.status,
                        methodName: tx.methodName,
                        fromAddress: {
                            address: tx.fromAddress.address,
                            type: tx.fromAddress.type,
                            isContract: tx.fromAddress.isContract,
                            verified: tx.fromAddress.verified,
                            ens: tx.fromAddress.ens,
                            name: tx.fromAddress.name,
                        },
                        toAddress: {
                            address: tx.toAddress.address,
                            type: tx.toAddress.type,
                            isContract: tx.toAddress.isContract,
                            verified: tx.toAddress.verified,
                            ens: tx.toAddress.ens,
                            name: tx.toAddress.name,
                        },
                    }));
                    // Analyze holding history and calculate performance metrics
                    const holdingHistoryMap = {};
                    let currentBalance = BigInt(0);
                    let totalInflow = BigInt(0);
                    let totalOutflow = BigInt(0);
                    let largestTransaction = BigInt(0);
                    let firstTransactionTime = 0;
                    let lastTransactionTime = 0;
                    // Sort transactions by timestamp
                    const sortedTransactions = [...result.transactions].sort((a, b) => a.timestamp - b.timestamp);
                    for (const tx of sortedTransactions) {
                        const value = BigInt(tx.value);
                        if (tx.from.toLowerCase() === address.toLowerCase()) {
                            currentBalance -= value;
                            totalOutflow += value;
                            if (value > largestTransaction) {
                                largestTransaction = value;
                            }
                        }
                        if (tx.to.toLowerCase() === address.toLowerCase()) {
                            currentBalance += value;
                            totalInflow += value;
                            if (value > largestTransaction) {
                                largestTransaction = value;
                            }
                        }
                        if (firstTransactionTime === 0) {
                            firstTransactionTime = tx.timestamp;
                        }
                        lastTransactionTime = tx.timestamp;
                        holdingHistoryMap[tx.timestamp] = {
                            balance: ethers.formatEther(currentBalance.toString()),
                            timestamp: tx.timestamp,
                        };
                    }
                    result.holdingHistory = Object.values(holdingHistoryMap).sort((a, b) => b.timestamp - a.timestamp);
                    // Calculate performance metrics
                    const initialBalance = BigInt(0);
                    const finalBalance = currentBalance;
                    const totalPnL = finalBalance - initialBalance;
                    const totalPnLPercentage = initialBalance > 0
                        ? (Number(totalPnL) / Number(initialBalance)) * 100
                        : 0;
                    const holdingTimeInDays = (lastTransactionTime - firstTransactionTime) /
                        (24 * 60 * 60 * 1000);
                    const averageHoldingTime = holdingTimeInDays > 0
                        ? holdingTimeInDays / result.transactions.length
                        : 0;
                    result.performanceMetrics = {
                        totalPnL: ethers.formatEther(totalPnL.toString()),
                        totalPnLPercentage: totalPnLPercentage.toFixed(2) + "%",
                        averageHoldingTime: averageHoldingTime.toFixed(2) + " days",
                        largestTransaction: ethers.formatEther(largestTransaction.toString()),
                        transactionCount: result.transactions.length,
                        inflow: ethers.formatEther(totalInflow.toString()),
                        outflow: ethers.formatEther(totalOutflow.toString()),
                    };
                    console.error(`Found ${result.transactions.length} recent transactions and ${result.holdingHistory.length} balance changes`);
                    console.error(`Performance metrics calculated:
              - Total PnL: ${result.performanceMetrics.totalPnL} MON
              - PnL Percentage: ${result.performanceMetrics.totalPnLPercentage}
              - Average Holding Time: ${result.performanceMetrics.averageHoldingTime}
              - Largest Transaction: ${result.performanceMetrics.largestTransaction} MON
              - Total Inflow: ${result.performanceMetrics.inflow} MON
              - Total Outflow: ${result.performanceMetrics.outflow} MON`);
                }
            }
            catch (error) {
                console.error("Error fetching transactions from BlockVision:", error);
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        nativeBalance: result.nativeBalance,
                        erc20Tokens: result.erc20Tokens,
                        nfts: result.nfts,
                        liquidityPositions: result.liquidityPositions,
                        transactions: result.transactions,
                        holdingHistory: result.holdingHistory,
                        performanceMetrics: result.performanceMetrics,
                    }, null, 2),
                },
            ],
        };
    }
    catch (error) {
        console.error("Error during portfolio analysis:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error during portfolio analysis: ${error}`,
                },
            ],
        };
    }
});
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Monad testnet MCP server started on stdio");
    }
    catch (error) {
        console.error("Server initialization error:", error);
    }
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
