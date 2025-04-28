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
const BLOCKVISION_BASE_URL = "https://api.blockvision.org/v2";
const BLOCKVISION_API_KEY = process.env.BLOCKVISION_API_KEY || "";
console.error("Starting MCP server...");
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "nft-top-holders",
    version: "0.0.1",
    capabilities: ["nft-top-holders"],
});
server.tool("nft-top-holders", "Get the list of holders for a specific NFT on Monad Testnet using BlockVision API", {
    contractAddress: z.string().describe("NFT contract address"),
    tokenId: z.string().optional().describe("Specific token ID (optional)"),
    standard: z
        .enum(["ERC721", "ERC1155"])
        .default("ERC721")
        .describe("NFT standard (ERC721 or ERC1155)"),
    limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of holders to retrieve"),
}, async ({ contractAddress, tokenId, standard, limit }) => {
    try {
        // Check if contract address is valid
        if (!ethers.isAddress(contractAddress)) {
            throw new Error(`Invalid contract address: ${contractAddress}`);
        }
        console.error(`Retrieving holders for NFT at address: ${contractAddress}`);
        // Get NFT holders from BlockVision API with pagination
        let allHolders = [];
        let pageIndex = 1;
        const pageSize = 50;
        let hasMore = true;
        let totalRetrieved = 0;
        const maxHolders = 20; // Limit to top 20 holders
        while (hasMore && allHolders.length < maxHolders) {
            try {
                console.error(`Fetching page ${pageIndex}...`);
                const response = await axios.get(`${BLOCKVISION_BASE_URL}/monad/collection/holders?contractAddress=${contractAddress}&pageIndex=${pageIndex}&pageSize=${pageSize}`, {
                    headers: {
                        "x-api-key": BLOCKVISION_API_KEY,
                    },
                });
                if (!response.data || !response.data.result) {
                    throw new Error("Invalid API response structure");
                }
                if (response.data.code !== 0) {
                    throw new Error(`BlockVision API error: ${response.data.message || "Unknown error"}`);
                }
                const holders = response.data.result.data || [];
                // Sort holders by amount in descending order
                const sortedHolders = holders.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
                allHolders = [...allHolders, ...sortedHolders];
                totalRetrieved += holders.length;
                console.error(`Retrieved ${holders.length} holders on page ${pageIndex} (Total: ${totalRetrieved})`);
                // Check if we've reached the end or max holders
                if (!response.data.result.nextPageIndex ||
                    holders.length < pageSize ||
                    allHolders.length >= maxHolders) {
                    hasMore = false;
                    console.error(`Finished retrieving top holders. Total: ${Math.min(allHolders.length, maxHolders)}`);
                }
                else {
                    pageIndex = response.data.result.nextPageIndex;
                    // Add a delay of 1 second between requests to avoid rate limiting
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 404) {
                        throw new Error(`Contract address ${contractAddress} not found or not an NFT contract`);
                    }
                    if (error.response?.status === 429) {
                        // If we hit rate limit, wait longer before retrying
                        console.error("Rate limit reached, waiting 5 seconds before retrying...");
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                        continue; // Retry the same request
                    }
                    throw new Error(`API request failed: ${error.message}`);
                }
                throw error;
            }
        }
        if (allHolders.length === 0) {
            throw new Error(`No holders found for contract ${contractAddress}`);
        }
        // Take only the top holders and sort them by amount
        const topHolders = allHolders
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, maxHolders);
        // Format holders list for display
        const holdersList = topHolders
            .map((holder, index) => `${index + 1}. ${holder.ownerAddress} (${holder.amount} tokens, ${holder.percentage}%)`)
            .join("\n");
        return {
            content: [
                {
                    type: "text",
                    text: `Top ${topHolders.length} NFT holders for contract ${contractAddress}:\n\n${topHolders.length > 0
                        ? `Found ${topHolders.length} holders:\n\n${holdersList}`
                        : "No holders found for this collection or token."}`,
                },
            ],
            contractAddress,
            standard,
            tokenId: tokenId || "all",
            holderCount: topHolders.length,
            holders: topHolders.map((holder) => ({
                address: holder.ownerAddress,
                amount: holder.amount,
                uniqueTokens: holder.uniqueTokens,
                percentage: holder.percentage,
                isContract: holder.isContract,
            })),
        };
    }
    catch (error) {
        console.error(`Error retrieving NFT holders:`, error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error retrieving NFT holders: ${error instanceof Error ? error.message : String(error)}\n\nPlease verify that the contract address is correct and that it is an NFT contract (${standard}).`,
                },
            ],
        };
    }
});
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("MCP Monad testnet server started on stdio");
    }
    catch (error) {
        console.error("Server initialization error:", error);
    }
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
