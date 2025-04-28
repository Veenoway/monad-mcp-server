import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import { ERC1155_ABI, ERC721_ABI } from "./shared/constants.js";

console.error("Démarrage du serveur MCP...");

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
  "Récupérer la liste des détenteurs d'un NFT spécifique sur Monad Testnet",
  {
    contractAddress: z.string().describe("Adresse du contrat NFT"),
    tokenId: z
      .string()
      .optional()
      .describe("ID du token spécifique (optionnel)"),
    standard: z
      .enum(["ERC721", "ERC1155"])
      .default("ERC721")
      .describe("Standard du NFT (ERC721 ou ERC1155)"),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe("Nombre maximum de détenteurs à récupérer"),
  },
  async ({ contractAddress, tokenId, standard, limit }) => {
    try {
      // Vérifier que l'adresse du contrat est valide
      if (!ethers.isAddress(contractAddress)) {
        throw new Error(`Adresse de contrat invalide: ${contractAddress}`);
      }

      console.error(
        `Récupération des détenteurs pour le NFT à l'adresse: ${contractAddress}`
      );

      // Sélectionner l'ABI en fonction du standard
      const abi = standard === "ERC721" ? ERC721_ABI : ERC1155_ABI;

      // Créer une instance du contrat
      const contract = new ethers.Contract(contractAddress, abi, provider);

      // Informations sur la collection
      let name = "NFT Collection";
      let symbol = "NFT";

      try {
        if (standard === "ERC721") {
          name = await contract.name();
          symbol = await contract.symbol();
        }
      } catch (error) {
        console.error("Impossible de récupérer le nom ou le symbole:", error);
      }

      // Détenteurs des NFTs
      const holders = new Map<string, number[]>();

      if (standard === "ERC721") {
        // Pour les NFTs ERC721
        try {
          // Si un tokenId spécifique est fourni
          if (tokenId) {
            // Récupérer le propriétaire de ce tokenId spécifique
            const owner = await contract.ownerOf(tokenId);
            if (owner) {
              holders.set(owner, [parseInt(tokenId)]);
            }
          } else {
            // Récupérer tous les tokens (limité par 'limit')
            // Vérifier si le contrat implémente totalSupply et tokenByIndex (énumérable)
            let isEnumerable = false;
            let totalSupply = BigInt(0);

            try {
              totalSupply = await contract.totalSupply();
              isEnumerable = true;
            } catch (error) {
              console.error(
                "Le contrat n'implémente pas totalSupply/tokenByIndex, utilisation de la méthode d'événements"
              );
            }

            if (isEnumerable) {
              // Si le contrat est énumérable, utiliser totalSupply et tokenByIndex
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
                  console.error(
                    `Erreur lors de la récupération du token ${i}:`,
                    error
                  );
                }
              }
            } else {
              // Si le contrat n'est pas énumérable, chercher les événements Transfer
              // Définir manuellement le filtrage pour les événements Transfer
              const transferEventSignature = ethers.id(
                "Transfer(address,address,uint256)"
              );
              const transferEvents = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                address: contractAddress,
                topics: [transferEventSignature],
              });

              // Analyser les événements pour trouver les transferts les plus récents
              const processedTokens = new Set<string>();
              let tokenCount = 0;

              // Parcourir les événements en ordre inverse (des plus récents aux plus anciens)
              for (
                let i = transferEvents.length - 1;
                i >= 0 && tokenCount < limit;
                i--
              ) {
                const event = transferEvents[i];

                // Décoder l'événement
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
                        `Erreur lors de la récupération du propriétaire pour le token ${tokenIdFromEvent}:`,
                        error
                      );
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(
            "Erreur lors de la récupération des détenteurs ERC721:",
            error
          );
        }
      } else if (standard === "ERC1155") {
        // Pour les NFTs ERC1155
        // Cette implémentation est simplifiée car ERC1155 ne définit pas de méthode standard pour lister tous les tokens

        if (!tokenId) {
          return {
            content: [
              {
                type: "text",
                text: "Pour les NFTs ERC1155, vous devez spécifier un tokenId spécifique.",
              },
            ],
          };
        }

        // Pour ERC1155, nous avons besoin de rechercher dans les événements TransferSingle et TransferBatch
        const transferSingleSignature = ethers.id(
          "TransferSingle(address,address,address,uint256,uint256)"
        );
        const transferBatchSignature = ethers.id(
          "TransferBatch(address,address,address,uint256[],uint256[])"
        );

        const tokenIdValue = BigInt(tokenId);

        // Récupérer les événements TransferSingle
        const transferSingleEvents = await provider.getLogs({
          fromBlock: 0,
          toBlock: "latest",
          address: contractAddress,
          topics: [transferSingleSignature],
        });

        // Récupérer les événements TransferBatch
        const transferBatchEvents = await provider.getLogs({
          fromBlock: 0,
          toBlock: "latest",
          address: contractAddress,
          topics: [transferBatchSignature],
        });

        // Traiter les événements TransferSingle
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
              // Vérifier si l'adresse possède encore ce token
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
                console.error(
                  `Erreur lors de la vérification du solde pour ${to}:`,
                  error
                );
              }
            }
          }
        }

        // Traiter les événements TransferBatch
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
                // Vérifier si l'adresse possède encore ce token
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
                  console.error(
                    `Erreur lors de la vérification du solde pour ${to}:`,
                    error
                  );
                }
              }
            }
          }
        }
      }

      // Convertir la Map en tableau pour la réponse
      const holdersArray = Array.from(holders.entries()).map(
        ([address, tokens]) => ({
          address,
          tokens,
          tokenCount: tokens.length,
        })
      );

      // Trier par nombre de tokens (décroissant)
      holdersArray.sort((a, b) => b.tokenCount - a.tokenCount);

      // Limiter le nombre de détenteurs retournés
      const limitedHolders = holdersArray.slice(0, limit);

      // Préparer le texte récapitulatif pour l'affichage
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
            text: `Détenteurs de NFT pour ${name} (${symbol}) à l'adresse ${contractAddress}:\n\n${
              limitedHolders.length > 0
                ? holderSummary
                : "Aucun détenteur trouvé pour cette collection ou ce token."
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
      console.error(
        `Erreur lors de la récupération des détenteurs de NFT:`,
        error
      );

      return {
        content: [
          {
            type: "text",
            text: `Erreur lors de la récupération des détenteurs de NFT: ${
              error instanceof Error ? error.message : String(error)
            }\n\nVérifiez que l'adresse du contrat est correcte et qu'il s'agit bien d'un contrat NFT (${standard}).`,
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
    console.error("Serveur MCP Monad testnet lancé sur stdio");
  } catch (error) {
    console.error("Erreur d'initialisation du serveur:", error);
  }
}

main().catch((error) => {
  console.error("Erreur fatale dans main():", error);
  process.exit(1);
});
