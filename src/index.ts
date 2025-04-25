/**
 * Monad MCP Tutorial
 *
 * This file demonstrates how to create a Model Context Protocol (MCP) server
 * that interacts with the Monad blockchain testnet to check MON balances.
 */

// Import necessary dependencies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";
import { z } from "zod";

// Create a public client to interact with the Monad testnet
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// Initialize the MCP server with a name, version, and capabilities
// Create a new MCP server instance
const server = new McpServer({
  name: "monad-mcp-magiceden",
  version: "0.0.1",
  // Array of supported tool names that clients can call
  capabilities: ["get-mon-balance", "deploy-token", "deploy-nft"],
});

// Define a tool that gets the MON balance for a given address
server.tool(
  // Tool ID
  "get-mon-balance",
  // Description of what the tool does
  "Obtenir le solde MON pour une adresse sur le réseau Monad testnet",
  // Input schema
  {
    address: z
      .string()
      .describe("Adresse Monad testnet pour vérifier le solde"),
  },
  // Tool implementation
  async ({ address }) => {
    try {
      // Check MON balance for the input address
      const balance = await publicClient.getBalance({
        address: address as `0x${string}`,
      });

      // Return a human friendly message indicating the balance.
      return {
        content: [
          {
            type: "text",
            text: `Solde pour ${address}: ${formatUnits(balance, 18)} MON`,
          },
        ],
      };
    } catch (error) {
      // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
      return {
        content: [
          {
            type: "text",
            text: `Échec de la récupération du solde pour l'adresse: ${address}. Erreur: ${
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
  // Create a transport layer using standard input/output
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);

  console.error("Serveur MCP Monad testnet en cours d'exécution sur stdio");
}

// Start the server and handle any fatal errors
main().catch((error) => {
  console.error("Erreur fatale dans main():", error);
  process.exit(1);
});
