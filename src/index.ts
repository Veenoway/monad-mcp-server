/**
 * Monad MCP Tutorial
 *
 * This file demonstrates how to create a Model Context Protocol (MCP) server
 * that interacts with the Monad blockchain testnet to check MON balances.
 */

// Import necessary dependencies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";

console.error("Starting MCP server...");

// Create a provider to interact with the Monad testnet
const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6"
);

// Create a new MCP server instance
const server = new McpServer({
  name: "monad-mcp-tutorial",
  version: "0.0.1",
  // Array of supported tool names that clients can call
  capabilities: ["get-mon-balance"],
});

server.tool(
  "get-mon-balance",
  "Get MON balance for an address on Monad testnet",
  // Input schema
  {
    address: z.string().describe("Monad testnet address to check balance for"),
  },
  // Tool implementation
  async ({ address }) => {
    try {
      console.error(`Checking balance for address: ${address}`);

      // Check MON balance for the input address
      const balance = await provider.getBalance(address);

      console.error(`Balance retrieved: ${balance.toString()}`);

      // Return a human friendly message indicating the balance.
      return {
        content: [
          {
            type: "text",
            text: `Balance for ${address}: ${ethers.formatEther(balance)} MON`,
          },
        ],
      };
    } catch (error) {
      console.error("Error details:", error);
      // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve balance for address: ${address}. Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

/**
 * Main function to start the MCP server
 * Uses stdio for communication with LLM clients
 */
async function main() {
  try {
    // Create a transport layer using standard input/output
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    await server.connect(transport);

    console.error("Monad testnet MCP Server running on stdio");
  } catch (error) {
    console.error("Error initializing server:", error);
  }
}

// Start the server and handle any fatal errors
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
