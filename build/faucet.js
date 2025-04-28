import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "monad-faucet",
    version: "0.0.1",
    capabilities: ["monad-faucet"],
});
server.tool("monad-faucet", "Get 0.2 MON on Monad Testnet to test your applications", {
    walletAddress: z
        .string()
        .describe("Wallet address that will receive the tokens"),
}, async ({ walletAddress }, extra) => {
    try {
        if (!ethers.isAddress(walletAddress)) {
            throw new Error(`Invalid wallet address: ${walletAddress}`);
        }
        console.error(`Preparing to send MON to ${walletAddress}...`);
        const faucetPrivateKey = process.env.PRIVATE_KEY;
        const senderWallet = new ethers.Wallet(faucetPrivateKey, provider);
        const senderAddress = senderWallet.address;
        const senderBalance = await provider.getBalance(senderAddress);
        console.error(`Sender wallet balance (${senderAddress}): ${ethers.formatEther(senderBalance)} MON`);
        const amountToSend = ethers.parseEther("0.2");
        if (senderBalance < amountToSend) {
            throw new Error(`Insufficient balance: your wallet has ${ethers.formatEther(senderBalance)} MON, but sending requires 0.2 MON`);
        }
        console.error(`Sending 0.2 MON from ${senderAddress} to ${walletAddress}...`);
        const tx = await senderWallet.sendTransaction({
            to: walletAddress,
            value: amountToSend,
            gasLimit: ethers.toBigInt("300000"),
        });
        console.error(`Transaction sent: ${tx.hash}`);
        const receipt = await provider.waitForTransaction(tx.hash);
        if (!receipt || receipt.status === 0) {
            throw new Error(`Transaction failed: ${tx.hash}`);
        }
        return {
            content: [
                {
                    type: "text",
                    text: `✅ 0.2 MON successfully sent to ${walletAddress}\nTransaction: ${tx.hash}\nSent from: ${senderAddress}`,
                },
            ],
        };
    }
    catch (error) {
        console.error("Error:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error sending tokens: ${error}`,
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
