import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import { ERC1155_ABI, ERC721_ABI } from "./shared/constants.js";

console.error("Starting MCP server...");

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "nft-holders",
  version: "0.0.1",
  capabilities: ["nft-holders"],
});

server.tool(
  "nft-holders",
  "Get the list of holders for a specific NFT on Monad Testnet",
  {
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
  },
  async ({ contractAddress, tokenId, standard, limit }) => {
    try {
      // Check if contract address is valid
      if (!ethers.isAddress(contractAddress)) {
        throw new Error(`Invalid contract address: ${contractAddress}`);
      }

      console.error(
        `Retrieving holders for NFT at address: ${contractAddress}`
      );

      // Select ABI based on standard
      const abi = standard === "ERC721" ? ERC721_ABI : ERC1155_ABI;

      // Create contract instance
      const contract = new ethers.Contract(contractAddress, abi, provider);

      // Collection information
      let name = "NFT Collection";
      let symbol = "NFT";

      try {
        if (standard === "ERC721") {
          name = await contract.name();
          symbol = await contract.symbol();
        }
      } catch (error) {
        console.error("Unable to retrieve name or symbol:", error);
      }

      // NFT holders
      const holders = new Map<string, number[]>();

      if (standard === "ERC721") {
        // For ERC721 NFTs
        try {
          // If a specific tokenId is provided
          if (tokenId) {
            // Get owner of this specific tokenId
            const owner = await contract.ownerOf(tokenId);
            if (owner) {
              holders.set(owner, [parseInt(tokenId)]);
            }
          } else {
            // Get all tokens (limited by 'limit')
            // Check if contract implements totalSupply and tokenByIndex (enumerable)
            let isEnumerable = false;
            let totalSupply = BigInt(0);

            try {
              totalSupply = await contract.totalSupply();
              isEnumerable = true;
            } catch (error) {
              console.error(
                "Contract does not implement totalSupply/tokenByIndex, using event method"
              );
            }

            if (isEnumerable) {
              // If contract is enumerable, use totalSupply and tokenByIndex
              const maxTokens = Math.min(Number(totalSupply), limit);

              for (let i = 0; i < maxTokens; i++) {
                try {
                  const tokenId = await contract.tokenByIndex(i);
                  const owner = await contract.ownerOf(tokenId);

                  if (holders.has(owner)) {
                    holders.get(owner)?.push(Number(tokenId));
                  } else {
                    holders.set(owner, [Number(tokenId)]);
                  }
                } catch (error) {
                  console.error(`Error retrieving token ${i}:`, error);
                }
              }
            } else {
              // If contract is not enumerable, look for Transfer events
              // Manually define filtering for Transfer events
              const transferEventSignature = ethers.id(
                "Transfer(address,address,uint256)"
              );
              const transferEvents = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                address: contractAddress,
                topics: [transferEventSignature],
              });

              // Analyze events to find most recent transfers
              const processedTokens = new Set<string>();
              let tokenCount = 0;

              // Go through events in reverse order (most recent to oldest)
              for (
                let i = transferEvents.length - 1;
                i >= 0 && tokenCount < limit;
                i--
              ) {
                const event = transferEvents[i];

                // Decode event
                const decodedEvent = contract.interface.parseLog({
                  topics: event.topics as string[],
                  data: event.data,
                });

                if (decodedEvent && decodedEvent.args) {
                  const tokenIdFromEvent = decodedEvent.args[2].toString();

                  if (!processedTokens.has(tokenIdFromEvent)) {
                    processedTokens.add(tokenIdFromEvent);

                    try {
                      const owner = await contract.ownerOf(tokenIdFromEvent);

                      if (holders.has(owner)) {
                        holders.get(owner)?.push(Number(tokenIdFromEvent));
                      } else {
                        holders.set(owner, [Number(tokenIdFromEvent)]);
                      }

                      tokenCount++;
                    } catch (error) {
                      console.error(
                        `Error retrieving owner for token ${tokenIdFromEvent}:`,
                        error
                      );
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error retrieving ERC721 holders:", error);
        }
      } else if (standard === "ERC1155") {
        // For ERC1155 NFTs
        // This implementation is simplified as ERC1155 does not define a standard method to list all tokens

        if (!tokenId) {
          return {
            content: [
              {
                type: "text",
                text: "For ERC1155 NFTs, you must specify a specific tokenId.",
              },
            ],
          };
        }

        // For ERC1155, we need to search in TransferSingle and TransferBatch events
        const transferSingleSignature = ethers.id(
          "TransferSingle(address,address,address,uint256,uint256)"
        );
        const transferBatchSignature = ethers.id(
          "TransferBatch(address,address,address,uint256[],uint256[])"
        );

        const tokenIdValue = BigInt(tokenId);

        // Get TransferSingle events
        const transferSingleEvents = await provider.getLogs({
          fromBlock: 0,
          toBlock: "latest",
          address: contractAddress,
          topics: [transferSingleSignature],
        });

        // Get TransferBatch events
        const transferBatchEvents = await provider.getLogs({
          fromBlock: 0,
          toBlock: "latest",
          address: contractAddress,
          topics: [transferBatchSignature],
        });

        // Process TransferSingle events
        for (const event of transferSingleEvents) {
          const decodedEvent = contract.interface.parseLog({
            topics: event.topics as string[],
            data: event.data,
          });

          if (decodedEvent && decodedEvent.args) {
            const eventTokenId = decodedEvent.args[3];
            const to = decodedEvent.args[2];
            const value = decodedEvent.args[4];

            if (eventTokenId.toString() === tokenId && value > 0) {
              // Check if address still owns this token
              try {
                const balance = await contract.balanceOf(to, tokenIdValue);

                if (balance > 0) {
                  if (holders.has(to)) {
                    if (!holders.get(to)?.includes(Number(tokenId))) {
                      holders.get(to)?.push(Number(tokenId));
                    }
                  } else {
                    holders.set(to, [Number(tokenId)]);
                  }
                }
              } catch (error) {
                console.error(`Error checking balance for ${to}:`, error);
              }
            }
          }
        }

        // Process TransferBatch events
        for (const event of transferBatchEvents) {
          const decodedEvent = contract.interface.parseLog({
            topics: event.topics as string[],
            data: event.data,
          });

          if (decodedEvent && decodedEvent.args) {
            const to = decodedEvent.args[2];
            const ids = decodedEvent.args[3];
            const values = decodedEvent.args[4];

            for (let i = 0; i < ids.length; i++) {
              if (ids[i].toString() === tokenId && values[i] > 0) {
                // Check if address still owns this token
                try {
                  const balance = await contract.balanceOf(to, tokenIdValue);

                  if (balance > 0) {
                    if (holders.has(to)) {
                      if (!holders.get(to)?.includes(Number(tokenId))) {
                        holders.get(to)?.push(Number(tokenId));
                      }
                    } else {
                      holders.set(to, [Number(tokenId)]);
                    }
                  }
                } catch (error) {
                  console.error(`Error checking balance for ${to}:`, error);
                }
              }
            }
          }
        }
      }

      // Convert Map to array for response
      const holdersArray = Array.from(holders.entries()).map(
        ([address, tokens]) => ({
          address,
          tokens,
          tokenCount: tokens.length,
        })
      );

      // Sort by number of tokens (descending)
      holdersArray.sort((a, b) => b.tokenCount - a.tokenCount);

      // Limit number of holders returned
      const limitedHolders = holdersArray.slice(0, limit);

      // Prepare summary text for display
      const holderSummary = limitedHolders
        .map(
          (holder, index) =>
            `${index + 1}. ${holder.address}: ${
              holder.tokenCount
            } token(s) - IDs: [${holder.tokens.join(", ")}]`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `NFT holders for ${name} (${symbol}) at address ${contractAddress}:\n\n${
              limitedHolders.length > 0
                ? holderSummary
                : "No holders found for this collection or token."
            }`,
          },
        ],
        contractAddress,
        standard,
        name,
        symbol,
        tokenId: tokenId || "all",
        holderCount: limitedHolders.length,
        holders: limitedHolders,
      };
    } catch (error) {
      console.error(`Error retrieving NFT holders:`, error);

      return {
        content: [
          {
            type: "text",
            text: `Error retrieving NFT holders: ${
              error instanceof Error ? error.message : String(error)
            }\n\nPlease verify that the contract address is correct and that it is an NFT contract (${standard}).`,
          },
        ],
      };
    }
  }
);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Monad testnet server started on stdio");
  } catch (error) {
    console.error("Server initialization error:", error);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
