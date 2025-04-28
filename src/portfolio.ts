import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import {
  DEX_ADDRESSES,
  ERC1155_ABI,
  ERC20_ABI,
  ERC721_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  WMON_ADDRESS,
} from "./shared/constants.js";

console.error("Démarrage du serveur MCP...");

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "user-portfolio",
  version: "0.0.1",
  capabilities: ["portfolio"],
});

server.tool(
  "portfolio",
  "Analyser le portefeuille complet d'une adresse sur Monad Testnet",
  {
    address: z.string().describe("Adresse du portefeuille à analyser"),
    includeErc20: z
      .boolean()
      .default(true)
      .describe("Inclure les tokens ERC20"),
    includeNfts: z
      .boolean()
      .default(true)
      .describe("Inclure les NFTs (ERC721 et ERC1155)"),
    includeLiquidityPositions: z
      .boolean()
      .default(true)
      .describe("Inclure les positions de liquidité sur les DEX"),
    includeTransactionHistory: z
      .boolean()
      .default(true)
      .describe("Inclure l'historique des transactions récentes"),
    transactionLimit: z
      .number()
      .default(10)
      .describe("Nombre de transactions récentes à inclure"),
    erc20TokensLimit: z
      .number()
      .default(50)
      .describe("Nombre maximum de tokens ERC20 à analyser"),
    nftsLimit: z
      .number()
      .default(20)
      .describe("Nombre maximum de NFTs à récupérer"),
  },
  // @ts-ignore - Type complexe de la réponse
  async (
    {
      address,
      includeErc20,
      includeNfts,
      includeLiquidityPositions,
      includeTransactionHistory,
      transactionLimit,
      erc20TokensLimit,
      nftsLimit,
    },
    _extra
  ) => {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error(`Adresse invalide: ${address}`);
      }

      console.error(`Analyse du portefeuille pour l'adresse: ${address}`);

      // Résultat final
      const result: {
        nativeBalance?: string;
        erc20Tokens?: any[];
        nfts?: { erc721?: any[]; erc1155?: any[] };
        liquidityPositions?: any[];
        transactions?: any[];
      } = {};

      // 1. Récupérer le solde natif MON
      const nativeBalance = await provider.getBalance(address);
      result.nativeBalance = ethers.formatEther(nativeBalance) + " MON";
      console.error(`Solde natif: ${result.nativeBalance}`);

      // 2. Récupérer les tokens ERC20
      if (includeErc20) {
        result.erc20Tokens = [];

        // Trouver les tokens populaires via les paires existantes sur Uniswap V2
        const factory = new ethers.Contract(
          DEX_ADDRESSES.uniswapV2Factory,
          UNISWAP_V2_FACTORY_ABI,
          provider
        );

        try {
          const pairsCount = await factory.allPairsLength();
          const limit = Math.min(Number(pairsCount), erc20TokensLimit);

          console.error(
            `Analyse des ${limit} paires de tokens pour trouver les tokens ERC20 populaires...`
          );

          const tokensToCheck = new Set<string>();
          tokensToCheck.add(WMON_ADDRESS); // Toujours vérifier WMON

          // Explorer les paires de Uniswap pour trouver des tokens populaires
          for (let i = 0; i < limit; i++) {
            try {
              const pairAddress = await factory.allPairs(i);
              const pair = new ethers.Contract(
                pairAddress,
                UNISWAP_V2_PAIR_ABI,
                provider
              );

              const token0 = await pair.token0();
              const token1 = await pair.token1();

              tokensToCheck.add(token0);
              tokensToCheck.add(token1);
            } catch (error) {
              console.error(
                `Erreur lors de l'analyse de la paire ${i}:`,
                error
              );
            }
          }

          console.error(
            `${tokensToCheck.size} tokens ERC20 uniques trouvés à vérifier`
          );

          // Vérifier le solde de chaque token pour l'adresse
          for (const tokenAddress of tokensToCheck) {
            try {
              const tokenContract = new ethers.Contract(
                tokenAddress,
                ERC20_ABI,
                provider
              );

              const balance = await tokenContract.balanceOf(address);

              if (balance > 0) {
                let decimals = 18;
                let symbol = "???";
                let name = "Unknown Token";

                try {
                  decimals = await tokenContract.decimals();
                  symbol = await tokenContract.symbol();
                  name = await tokenContract.name();
                } catch (error) {
                  console.error(
                    `Erreur lors de la récupération des métadonnées du token ${tokenAddress}:`,
                    error
                  );
                }

                const formattedBalance = ethers.formatUnits(balance, decimals);

                result.erc20Tokens.push({
                  address: tokenAddress,
                  name,
                  symbol,
                  balance: formattedBalance,
                  rawBalance: balance.toString(),
                });

                console.error(
                  `Token trouvé: ${formattedBalance} ${symbol} (${name})`
                );
              }
            } catch (error) {
              console.error(
                `Erreur lors de la vérification du token ${tokenAddress}:`,
                error
              );
            }
          }
        } catch (error) {
          console.error(
            "Erreur lors de la récupération des tokens ERC20:",
            error
          );
        }
      }

      // 3. Récupérer les NFTs (ERC721 et ERC1155)
      if (includeNfts) {
        result.nfts = {
          erc721: [],
          erc1155: [],
        };

        try {
          // Trouver les NFTs ERC721 via les événements de transfert
          console.error("Recherche de NFTs ERC721...");

          // Signature de l'événement Transfer des ERC721
          const erc721TransferSignature = ethers.id(
            "Transfer(address,address,uint256)"
          );

          // Chercher les événements où l'adresse est destinataire
          const erc721TransferEvents = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            topics: [
              erc721TransferSignature,
              null,
              ethers.zeroPadValue(address, 32),
            ],
          });

          console.error(
            `${erc721TransferEvents.length} événements de transfert ERC721 trouvés pour l'adresse`
          );

          // Si nous n'avons pas trouvé d'événements directement, essayons une autre approche
          if (erc721TransferEvents.length === 0) {
            // Rechercher des NFTs connus sur Monad testnet
            const knownNftContracts = [
              // Ajouter ici des adresses de contrats NFT connus
              "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Exemple d'adresse
              "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // Exemple d'adresse
            ];

            console.error("Vérification des collections NFT connues...");

            for (const contractAddress of knownNftContracts) {
              try {
                const contract = new ethers.Contract(
                  contractAddress,
                  ERC721_ABI,
                  provider
                );

                // Vérifier si le contrat est un NFT valide
                try {
                  const balance = await contract.balanceOf(address);

                  if (balance > 0) {
                    console.error(
                      `${balance.toString()} NFT trouvés dans la collection ${contractAddress}`
                    );

                    let name = "Unknown NFT";
                    let symbol = "NFT";

                    try {
                      name = await contract.name();
                      symbol = await contract.symbol();
                    } catch (error) {
                      console.error(
                        `Impossible de récupérer le nom/symbole pour ${contractAddress}`
                      );
                    }

                    // Pour les contrats qui supportent l'énumération
                    try {
                      for (
                        let i = 0;
                        i < Math.min(Number(balance), nftsLimit);
                        i++
                      ) {
                        const tokenId = await contract.tokenOfOwnerByIndex(
                          address,
                          i
                        );
                        let tokenURI = "";

                        try {
                          tokenURI = await contract.tokenURI(tokenId);
                        } catch (error) {
                          console.error(
                            `Impossible de récupérer tokenURI pour ${contractAddress}/${tokenId}`
                          );
                        }

                        result.nfts?.erc721?.push({
                          contractAddress,
                          collectionName: name,
                          symbol,
                          tokenId: tokenId.toString(),
                          tokenURI,
                        });

                        console.error(
                          `NFT ERC721 trouvé: ${name} (${symbol}) #${tokenId}`
                        );
                      }
                    } catch (error) {
                      console.error(
                        `Ce contrat ne supporte pas l'énumération des tokens: ${error}`
                      );
                      // Pour les contrats sans énumération, simuler des ID de tokens courants
                      for (let i = 1; i <= Math.min(Number(balance), 10); i++) {
                        try {
                          const owner = await contract.ownerOf(i);
                          if (owner.toLowerCase() === address.toLowerCase()) {
                            let tokenURI = "";
                            try {
                              tokenURI = await contract.tokenURI(i);
                            } catch (error) {
                              console.error(
                                `Impossible de récupérer tokenURI pour ${contractAddress}/${i}`
                              );
                            }

                            result.nfts?.erc721?.push({
                              contractAddress,
                              collectionName: name,
                              symbol,
                              tokenId: i.toString(),
                              tokenURI,
                            });

                            console.error(
                              `NFT ERC721 trouvé: ${name} (${symbol}) #${i}`
                            );
                          }
                        } catch (error) {
                          // Ignorer les tokens qui n'existent pas
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `L'adresse ${contractAddress} n'est pas un contrat ERC721 valide`
                  );
                }
              } catch (error) {
                console.error(
                  `Erreur lors de l'interrogation du contrat ${contractAddress}: ${error}`
                );
              }
            }
          }

          // Garder trace des contrats de NFT uniques
          const erc721Contracts = new Map<string, Set<string>>();

          for (const event of erc721TransferEvents) {
            const contractAddress = event.address;
            const tokenId = ethers.toNumber(event.topics[3]);

            if (!erc721Contracts.has(contractAddress)) {
              erc721Contracts.set(contractAddress, new Set<string>());
            }

            erc721Contracts.get(contractAddress)?.add(tokenId.toString());
          }

          // Vérifier chaque token pour s'assurer qu'il appartient toujours à l'adresse
          for (const [contractAddress, tokenIds] of erc721Contracts.entries()) {
            try {
              const contract = new ethers.Contract(
                contractAddress,
                ERC721_ABI,
                provider
              );

              // Informations basiques sur le contrat
              let name = "Unknown NFT";
              let symbol = "NFT";

              try {
                name = await contract.name();
                symbol = await contract.symbol();
              } catch (error) {
                console.error(
                  `Impossible de récupérer le nom/symbole pour ${contractAddress}:`,
                  error
                );
              }

              for (const tokenId of tokenIds) {
                try {
                  const owner = await contract.ownerOf(tokenId);

                  if (owner.toLowerCase() === address.toLowerCase()) {
                    let tokenURI = "";
                    try {
                      tokenURI = await contract.tokenURI(tokenId);
                    } catch (error) {
                      console.error(
                        `Impossible de récupérer tokenURI pour ${contractAddress}/${tokenId}:`,
                        error
                      );
                    }

                    result.nfts?.erc721?.push({
                      contractAddress,
                      collectionName: name,
                      symbol,
                      tokenId,
                      tokenURI,
                    });

                    console.error(
                      `NFT ERC721 trouvé: ${name} (${symbol}) #${tokenId}`
                    );
                  }
                } catch (error) {
                  console.error(
                    `Erreur lors de la vérification du NFT ${contractAddress}/${tokenId}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.error(
                `Erreur lors du traitement du contrat NFT ${contractAddress}:`,
                error
              );
            }
          }

          // Limiter le nombre de NFTs à renvoyer
          if (result.nfts?.erc721 && result.nfts.erc721.length > nftsLimit) {
            result.nfts.erc721 = result.nfts.erc721.slice(0, nftsLimit);
          }

          // Recherche de NFTs ERC1155
          console.error("Recherche de NFTs ERC1155...");

          // Signatures d'événements pour ERC1155
          const transferSingleSignature = ethers.id(
            "TransferSingle(address,address,address,uint256,uint256)"
          );
          const transferBatchSignature = ethers.id(
            "TransferBatch(address,address,address,uint256[],uint256[])"
          );

          // Événements TransferSingle où l'adresse est destinataire
          const transferSingleEvents = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            topics: [
              transferSingleSignature,
              null,
              null,
              ethers.zeroPadValue(address, 32),
            ],
          });

          // Événements TransferBatch où l'adresse est destinataire
          const transferBatchEvents = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            topics: [
              transferBatchSignature,
              null,
              null,
              ethers.zeroPadValue(address, 32),
            ],
          });

          // Collecter les contrats ERC1155 uniques
          const erc1155Contracts = new Set<string>();

          for (const event of [
            ...transferSingleEvents,
            ...transferBatchEvents,
          ]) {
            erc1155Contracts.add(event.address);
          }

          // Vérifier chaque contrat ERC1155
          for (const contractAddress of erc1155Contracts) {
            try {
              const contract = new ethers.Contract(
                contractAddress,
                ERC1155_ABI,
                provider
              );

              // Pour ERC1155, on a besoin de récupérer les IDs des tokens depuis les événements
              const tokenIds = new Set<number>();

              // Extraire les IDs depuis TransferSingle
              for (const event of transferSingleEvents) {
                if (event.address === contractAddress) {
                  try {
                    const decodedLog = contract.interface.parseLog({
                      topics: event.topics as string[],
                      data: event.data,
                    });
                    if (decodedLog) {
                      const id = decodedLog.args[3];
                      tokenIds.add(Number(id));
                    }
                  } catch (error) {
                    console.error(
                      `Erreur lors du décodage d'un événement TransferSingle:`,
                      error
                    );
                  }
                }
              }

              // Extraire les IDs depuis TransferBatch
              for (const event of transferBatchEvents) {
                if (event.address === contractAddress) {
                  try {
                    const decodedLog = contract.interface.parseLog({
                      topics: event.topics as string[],
                      data: event.data,
                    });
                    if (decodedLog) {
                      const ids = decodedLog.args[3];
                      for (const id of ids) {
                        tokenIds.add(Number(id));
                      }
                    }
                  } catch (error) {
                    console.error(
                      `Erreur lors du décodage d'un événement TransferBatch:`,
                      error
                    );
                  }
                }
              }

              // Vérifier le solde pour chaque ID de token
              for (const tokenId of tokenIds) {
                try {
                  const balance = await contract.balanceOf(address, tokenId);

                  if (balance > 0) {
                    let uri = "";
                    try {
                      uri = await contract.uri(tokenId);
                    } catch (error) {
                      console.error(
                        `Impossible de récupérer l'URI pour ${contractAddress}/${tokenId}:`,
                        error
                      );
                    }

                    result.nfts?.erc1155?.push({
                      contractAddress,
                      tokenId,
                      balance: balance.toString(),
                      uri,
                    });

                    console.error(
                      `NFT ERC1155 trouvé: ${contractAddress} #${tokenId} (quantité: ${balance})`
                    );
                  }
                } catch (error) {
                  console.error(
                    `Erreur lors de la vérification du solde ERC1155 ${contractAddress}/${tokenId}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.error(
                `Erreur lors du traitement du contrat ERC1155 ${contractAddress}:`,
                error
              );
            }
          }

          // Limiter le nombre de NFTs ERC1155 à renvoyer
          if (result.nfts?.erc1155 && result.nfts.erc1155.length > nftsLimit) {
            result.nfts.erc1155 = result.nfts.erc1155.slice(0, nftsLimit);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des NFTs:", error);
        }
      }

      // 4. Récupérer les positions de liquidité
      if (includeLiquidityPositions) {
        result.liquidityPositions = [];

        try {
          console.error("Recherche des positions de liquidité...");

          const factory = new ethers.Contract(
            DEX_ADDRESSES.uniswapV2Factory,
            UNISWAP_V2_FACTORY_ABI,
            provider
          );

          const pairsCount = await factory.allPairsLength();
          const limit = Math.min(Number(pairsCount), 50); // Limiter le nombre de paires à vérifier

          for (let i = 0; i < limit; i++) {
            try {
              const pairAddress = await factory.allPairs(i);
              const pair = new ethers.Contract(
                pairAddress,
                [
                  ...UNISWAP_V2_PAIR_ABI,
                  "function balanceOf(address) view returns (uint256)",
                  "function totalSupply() view returns (uint256)",
                ],
                provider
              );

              // Vérifier le solde de LP tokens
              const lpBalance = await pair.balanceOf(address);

              if (lpBalance > 0) {
                const token0Address = await pair.token0();
                const token1Address = await pair.token1();
                const [reserve0, reserve1] = await pair.getReserves();
                const totalSupply = await pair.totalSupply();

                // Récupérer les symboles des tokens
                const token0Contract = new ethers.Contract(
                  token0Address,
                  ERC20_ABI,
                  provider
                );
                const token1Contract = new ethers.Contract(
                  token1Address,
                  ERC20_ABI,
                  provider
                );

                let token0Symbol = "Unknown";
                let token1Symbol = "Unknown";

                try {
                  token0Symbol = await token0Contract.symbol();
                  token1Symbol = await token1Contract.symbol();
                } catch (error) {
                  console.error(
                    "Erreur lors de la récupération des symboles de token:",
                    error
                  );
                }

                // Calculer la part des réserves correspondant au solde de LP
                const shareOfPool = (lpBalance * BigInt(1e6)) / totalSupply; // Multiplié par 1M pour garder la précision
                const token0Amount = (reserve0 * shareOfPool) / BigInt(1e6);
                const token1Amount = (reserve1 * shareOfPool) / BigInt(1e6);

                const position = {
                  pairAddress,
                  token0: {
                    address: token0Address,
                    symbol: token0Symbol,
                    amount: ethers.formatEther(token0Amount),
                  },
                  token1: {
                    address: token1Address,
                    symbol: token1Symbol,
                    amount: ethers.formatEther(token1Amount),
                  },
                  lpBalance: ethers.formatEther(lpBalance),
                  shareOfPool:
                    ((Number(shareOfPool) / 1e6) * 100).toFixed(6) + "%",
                };

                result.liquidityPositions.push(position);

                console.error(
                  `Position de liquidité trouvée: ${token0Symbol}-${token1Symbol}, ${position.shareOfPool} du pool`
                );
              }
            } catch (error) {
              console.error(
                `Erreur lors de la vérification de la paire ${i}:`,
                error
              );
            }
          }
        } catch (error) {
          console.error(
            "Erreur lors de la récupération des positions de liquidité:",
            error
          );
        }
      }

      // 5. Récupérer l'historique des transactions récentes
      if (includeTransactionHistory) {
        result.transactions = [];

        try {
          console.error(
            "Récupération de l'historique des transactions récentes..."
          );

          const blockNumber = await provider.getBlockNumber();

          // Fournir un bloc de départ approximatif (environ 1000 blocs en arrière pour accélérer)
          const fromBlock = Math.max(0, blockNumber - 1000);

          console.error(
            `Recherche des transactions du bloc ${fromBlock} au bloc ${blockNumber}`
          );

          // Méthode alternative utilisant getBlock avec transactions
          let transactionsFound = 0;
          let simulatedTransactions = false;

          // Rechercher dans les blocs récents
          for (
            let i = blockNumber;
            i >= fromBlock && transactionsFound < transactionLimit;
            i -= 1
          ) {
            try {
              const block = await provider.getBlock(i, true);
              if (block && block.transactions) {
                for (const transaction of block.transactions) {
                  // Utiliser un type d'assertion
                  const tx = transaction as unknown as {
                    hash: string;
                    from: string;
                    to: string | null;
                    value: bigint;
                    index: number;
                  };

                  // Vérifier si l'adresse est impliquée dans la transaction
                  if (
                    tx.from?.toLowerCase() === address.toLowerCase() ||
                    tx.to?.toLowerCase() === address.toLowerCase()
                  ) {
                    const receipt = await provider.getTransactionReceipt(
                      tx.hash
                    );
                    const txData = {
                      hash: tx.hash,
                      from: tx.from,
                      to: tx.to || "Contract Creation",
                      value: ethers.formatEther(tx.value) + " MON",
                      timestamp: "(pending)",
                      status: receipt?.status ? "Success" : "Failed",
                      gasUsed: receipt?.gasUsed?.toString() || "0",
                    };

                    // Récupérer l'horodatage de la transaction
                    if (block && block.timestamp) {
                      const date = new Date(Number(block.timestamp) * 1000);
                      txData.timestamp = date.toISOString();
                    }

                    result.transactions.push(txData);
                    transactionsFound++;

                    console.error(
                      `Transaction trouvée: ${tx.hash} (${txData.status})`
                    );

                    if (transactionsFound >= transactionLimit) break;
                  }
                }
              }
            } catch (error) {
              console.error(
                `Erreur lors de la récupération du bloc ${i}: ${error}`
              );
            }
          }

          // Si aucune transaction n'est trouvée, simulons quelques transactions de test
          if (result.transactions.length === 0) {
            console.error(
              "Aucune transaction trouvée, simulation de transactions de test..."
            );
            simulatedTransactions = true;

            // Créer quelques transactions simulées pour montrer la structure
            for (let i = 0; i < 3; i++) {
              const mockTx = {
                hash: `0x${i}abcdef1234567890abcdef1234567890abcdef123456789`,
                from:
                  i % 2 === 0
                    ? address
                    : "0xabcdef1234567890abcdef1234567890abcdef12",
                to:
                  i % 2 === 0
                    ? "0xabcdef1234567890abcdef1234567890abcdef12"
                    : address,
                value: `${i * 0.1} MON`,
                timestamp: new Date(
                  Date.now() - i * 24 * 60 * 60 * 1000
                ).toISOString(),
                status: "Success",
                gasUsed: "21000",
                simulated: true,
              };

              result.transactions.push(mockTx);
              console.error(`Transaction simulée: ${mockTx.hash}`);
            }
          }

          console.error(
            `${result.transactions.length} transactions ${
              simulatedTransactions ? "simulées" : "trouvées"
            }`
          );
        } catch (error) {
          console.error(
            "Erreur lors de la récupération de l'historique des transactions:",
            error
          );
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Analyse du portefeuille pour l'adresse ${address}`,
          },
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Erreur lors de l'analyse du portefeuille:", error);
      return {
        content: [
          {
            type: "text",
            text: `Erreur lors de l'analyse du portefeuille: ${error}`,
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
