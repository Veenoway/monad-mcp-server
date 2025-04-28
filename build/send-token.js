import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "send-mon",
    version: "0.0.1",
    capabilities: ["send-mon"],
});
server.tool("send-mon", "Send MON (native token of Monad) to another address", {
    privateKey: z.string().describe("Private key of the sender wallet"),
    recipientAddress: z.string().describe("Recipient address"),
    amount: z.string().describe("Amount of MON to send"),
}, async ({ privateKey, recipientAddress, amount }, _extra) => {
    try {
        // Check recipient address
        if (!ethers.isAddress(recipientAddress)) {
            throw new Error(`Invalid recipient address: ${recipientAddress}`);
        }
        // Create wallet
        const wallet = new ethers.Wallet(privateKey, provider);
        const senderAddress = wallet.address;
        console.error(`Sending MON from ${senderAddress} to ${recipientAddress}...`);
        // Convert amount to wei
        const amountInWei = ethers.parseEther(amount);
        // Check balance
        const balance = await provider.getBalance(senderAddress);
        if (balance < amountInWei) {
            throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} MON, but you are trying to send ${amount}.`);
        }
        console.error(`Sending ${amount} MON...`);
        const tx = await wallet.sendTransaction({
            to: recipientAddress,
            value: amountInWei,
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
                    text: `✅ ${amount} MON successfully sent to ${recipientAddress}
Transaction: ${tx.hash}
Sender: ${senderAddress}

You can view your transaction here:
https://testnet.monadexplorer.com/tx/${tx.hash}`,
                },
            ],
        };
    }
    catch (error) {
        console.error("Error sending MON:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error sending MON: ${error.message}`,
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
