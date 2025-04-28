import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import {
  DEX_ADDRESSES,
  ERC20_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_ROUTER_ABI,
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
  name: "swap",
  version: "0.0.1",
  capabilities: ["swap"],
});

server.tool(
  "swap",
  "Permettre aux utilisateurs d'échanger des tokens sur des DEX disponibles sur Monad Testnet",
  {
    privateKey: z
      .string()
      .describe("Clé privée de l'utilisateur pour effectuer la transaction"),
    routerType: z
      .enum(["uniswap", "sushiswap"])
      .default("uniswap")
      .describe("Type de routeur DEX à utiliser"),
    tokenInAddress: z
      .string()
      .optional()
      .describe(
        "Adresse du token d'entrée (optionnel pour swaps de MON natif)"
      ),
    tokenOutAddress: z.string().describe("Adresse du token de sortie"),
    amountIn: z
      .string()
      .describe(
        "Montant du token d'entrée (en unités complètes, sera converti selon les décimales du token)"
      ),
    slippagePercentage: z
      .number()
      .default(0.5)
      .describe("Pourcentage de slippage autorisé"),
    deadline: z
      .number()
      .optional()
      .describe(
        "Date limite d'expiration en secondes depuis l'epoch (optionnel)"
      ),
    useNativeMON: z
      .boolean()
      .default(false)
      .describe("Utiliser MON natif comme token d'entrée"),
    checkLiquidityOnly: z
      .boolean()
      .default(false)
      .describe("Vérifier uniquement la liquidité sans effectuer le swap"),
  },
  async ({
    privateKey,
    routerType,
    tokenInAddress,
    tokenOutAddress,
    amountIn,
    slippagePercentage,
    deadline,
    useNativeMON,
    checkLiquidityOnly,
  }) => {
    try {
      console.error("Initialisation du swap de tokens sur Monad...");

      if (!useNativeMON && !tokenInAddress) {
        throw new Error(
          "L'adresse du token d'entrée est requise lorsque useNativeMON est false"
        );
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Adresse du wallet: ${walletAddress}`);

      let routerAddress;
      let factoryAddress;
      if (routerType === "uniswap") {
        routerAddress = DEX_ADDRESSES.uniswapV2Router;
        factoryAddress = DEX_ADDRESSES.uniswapV2Factory;
        console.error(
          `Utilisation du routeur Uniswap V2 à l'adresse: ${routerAddress}`
        );
        console.error(`Factory Uniswap V2 à l'adresse: ${factoryAddress}`);
      } else if (routerType === "sushiswap") {
        routerAddress = DEX_ADDRESSES.sushiswapRouter;
        factoryAddress =
          DEX_ADDRESSES.sushiswapFactory ||
          "0x0000000000000000000000000000000000000000";
        console.error(
          `Utilisation du routeur SushiSwap à l'adresse: ${routerAddress}`
        );
      } else {
        throw new Error(`Type de routeur non pris en charge: ${routerType}`);
      }

      if (!ethers.isAddress(routerAddress)) {
        console.error(
          `ERREUR: Adresse de routeur ${routerType} invalide: ${routerAddress}`
        );
        throw new Error(
          `Adresse de routeur ${routerType} invalide ou non configurée. Veuillez vérifier la configuration du DEX.`
        );
      }

      if (!ethers.isAddress(WMON_ADDRESS)) {
        console.error(`ERREUR: Adresse WMON invalide: ${WMON_ADDRESS}`);
        throw new Error(
          `Adresse WMON invalide ou non configurée: ${WMON_ADDRESS}. Veuillez vérifier la configuration.`
        );
      }

      console.error(
        `Utilisation du routeur ${routerType} à l'adresse ${routerAddress}`
      );

      const router = new ethers.Contract(
        routerAddress,
        UNISWAP_V2_ROUTER_ABI,
        wallet
      );

      const factory = new ethers.Contract(
        factoryAddress,
        UNISWAP_V2_FACTORY_ABI,
        provider
      );

      const routerCode = await provider.getCode(routerAddress);
      if (routerCode === "0x" || routerCode === "") {
        console.error(
          `ERREUR: Aucun code à l'adresse du routeur ${routerType}: ${routerAddress}`
        );
        throw new Error(
          `Aucun contrat n'existe à l'adresse du routeur ${routerType} (${routerAddress}). Vérifiez que le DEX est bien déployé sur Monad testnet.`
        );
      }

      console.error(
        `Code du routeur vérifié: ${routerCode.substring(0, 10)}...`
      );

      const effectiveTokenInAddress = useNativeMON
        ? WMON_ADDRESS
        : tokenInAddress!;

      async function checkPoolLiquidity(tokenA: string, tokenB: string) {
        try {
          console.error(
            `Vérification de l'existence du pool ${tokenA} <-> ${tokenB}...`
          );
          const pairAddress = await factory.getPair(tokenA, tokenB);

          if (pairAddress === "0x0000000000000000000000000000000000000000") {
            console.error(`Pool inexistant pour ${tokenA} <-> ${tokenB}`);
            return {
              exists: false,
              liquidity: "0",
              tokenASymbol: "Inconnu",
              tokenBSymbol: "Inconnu",
              pairAddress: "0x0000000000000000000000000000000000000000",
            };
          }

          console.error(`Pool trouvé à l'adresse: ${pairAddress}`);

          const pair = new ethers.Contract(
            pairAddress,
            UNISWAP_V2_PAIR_ABI,
            provider
          );
          const [reserve0, reserve1] = await pair.getReserves();
          const token0 = await pair.token0();
          const token1 = await pair.token1();

          const reserveA =
            token0.toLowerCase() === tokenA.toLowerCase() ? reserve0 : reserve1;
          const reserveB =
            token0.toLowerCase() === tokenA.toLowerCase() ? reserve1 : reserve0;

          let tokenASymbol = "Inconnu";
          let tokenBSymbol = "Inconnu";

          try {
            const tokenAContract = new ethers.Contract(
              tokenA,
              ERC20_ABI,
              provider
            );
            tokenASymbol = await tokenAContract.symbol();
          } catch (error) {
            console.error(`Impossible de récupérer le symbole pour ${tokenA}`);
          }

          try {
            const tokenBContract = new ethers.Contract(
              tokenB,
              ERC20_ABI,
              provider
            );
            tokenBSymbol = await tokenBContract.symbol();
          } catch (error) {
            console.error(`Impossible de récupérer le symbole pour ${tokenB}`);
          }

          console.error(
            `Liquidité: ${ethers.formatEther(
              reserveA
            )} ${tokenASymbol} <-> ${ethers.formatEther(
              reserveB
            )} ${tokenBSymbol}`
          );

          return {
            exists: true,
            liquidity: `${ethers.formatEther(
              reserveA
            )} ${tokenASymbol} <-> ${ethers.formatEther(
              reserveB
            )} ${tokenBSymbol}`,
            tokenASymbol,
            tokenBSymbol,
            reserveA: reserveA.toString(),
            reserveB: reserveB.toString(),
            pairAddress,
          };
        } catch (error) {
          console.error(`Erreur lors de la vérification du pool:`, error);
          return {
            exists: false,
            liquidity: "0",
            error: String(error),
            tokenASymbol: "Inconnu",
            tokenBSymbol: "Inconnu",
            pairAddress: "0x0000000000000000000000000000000000000000",
          };
        }
      }

      const directPoolInfo = await checkPoolLiquidity(
        effectiveTokenInAddress,
        tokenOutAddress
      );
      const wmonPoolInfoIn = !useNativeMON
        ? await checkPoolLiquidity(effectiveTokenInAddress, WMON_ADDRESS)
        : {
            exists: true,
            liquidity: "N/A (MON natif)",
            tokenASymbol: "MON",
            tokenBSymbol: "WMON",
            pairAddress: "0x0000000000000000000000000000000000000000",
          };
      const wmonPoolInfoOut = await checkPoolLiquidity(
        WMON_ADDRESS,
        tokenOutAddress
      );

      if (checkLiquidityOnly) {
        const popularTokens: { address: string; symbol: string }[] = [];

        try {
          const pairsCount = await factory.allPairsLength();
          const limit = Math.min(Number(pairsCount), 10);

          console.error(
            `Récupération des ${limit} premières paires de tokens...`
          );

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
              const [reserve0, reserve1] = await pair.getReserves();

              if (
                reserve0 > ethers.parseEther("0.01") &&
                reserve1 > ethers.parseEther("0.01")
              ) {
                try {
                  const token0Contract = new ethers.Contract(
                    token0,
                    ERC20_ABI,
                    provider
                  );
                  const token1Contract = new ethers.Contract(
                    token1,
                    ERC20_ABI,
                    provider
                  );

                  const symbol0 = await token0Contract.symbol();
                  const symbol1 = await token1Contract.symbol();

                  if (
                    !popularTokens.some(
                      (t) => t.address.toLowerCase() === token0.toLowerCase()
                    )
                  ) {
                    popularTokens.push({ address: token0, symbol: symbol0 });
                  }

                  if (
                    !popularTokens.some(
                      (t) => t.address.toLowerCase() === token1.toLowerCase()
                    )
                  ) {
                    popularTokens.push({ address: token1, symbol: symbol1 });
                  }
                } catch (error) {
                  console.error(
                    `Erreur lors de la récupération des symboles pour la paire ${i}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.error(
                `Erreur lors de la récupération de la paire ${i}:`,
                error
              );
            }
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération des paires:`, error);
        }

        return {
          content: [
            {
              type: "text",
              text: `Vérification de la liquidité des pools sur ${routerType}:
  
  Pool direct ${
    effectiveTokenInAddress === WMON_ADDRESS
      ? "MON"
      : directPoolInfo.tokenASymbol
  } -> ${directPoolInfo.tokenBSymbol}: ${
                directPoolInfo.exists ? "Existe" : "N'existe pas"
              }
  ${directPoolInfo.exists ? `Liquidité: ${directPoolInfo.liquidity}` : ""}
  Adresse du pool: ${directPoolInfo.pairAddress}
  
  Pool ${
    effectiveTokenInAddress === WMON_ADDRESS
      ? "MON"
      : wmonPoolInfoIn.tokenASymbol
  } -> MON: ${wmonPoolInfoIn.exists ? "Existe" : "N'existe pas"}
  ${wmonPoolInfoIn.exists ? `Liquidité: ${wmonPoolInfoIn.liquidity}` : ""}
  
  Pool MON -> ${wmonPoolInfoOut.tokenBSymbol}: ${
                wmonPoolInfoOut.exists ? "Existe" : "N'existe pas"
              }
  ${wmonPoolInfoOut.exists ? `Liquidité: ${wmonPoolInfoOut.liquidity}` : ""}
  
  Chemin recommandé: ${
    directPoolInfo.exists
      ? "Direct"
      : wmonPoolInfoIn.exists && wmonPoolInfoOut.exists
      ? "Via MON"
      : "Aucun chemin viable"
  }
  
  ${
    popularTokens.length > 0
      ? `Tokens populaires disponibles sur ${routerType}:
  ${popularTokens
    .map((t, i) => `${i + 1}. ${t.symbol} (${t.address})`)
    .join("\n")}
  
  Si vous souhaitez créer de la liquidité, vous devrez ajouter des tokens aux pools via l'interface du DEX.`
      : "Aucun token populaire trouvé."
  }`,
            },
          ],
          poolInfo: {
            direct: directPoolInfo,
            viaMON: {
              tokenIn: wmonPoolInfoIn,
              tokenOut: wmonPoolInfoOut,
            },
            recommendedPath: directPoolInfo.exists
              ? "direct"
              : wmonPoolInfoIn.exists && wmonPoolInfoOut.exists
              ? "via_mon"
              : "none",
            popularTokens,
          },
        };
      }

      let path: string[] = [];
      let useDirectPath = false;

      if (useNativeMON) {
        path = [WMON_ADDRESS, tokenOutAddress];
        console.error(
          `Utilisation du chemin MON -> Token: ${WMON_ADDRESS} -> ${tokenOutAddress}`
        );

        if (!wmonPoolInfoOut.exists) {
          throw new Error(
            `Aucun pool de liquidité n'existe pour MON -> ${
              wmonPoolInfoOut.tokenBSymbol || tokenOutAddress
            }. Impossible de procéder au swap.`
          );
        }
      } else if (tokenOutAddress.toLowerCase() === WMON_ADDRESS.toLowerCase()) {
        path = [tokenInAddress!, WMON_ADDRESS];
        console.error(
          `Utilisation du chemin Token -> MON: ${tokenInAddress} -> ${WMON_ADDRESS}`
        );

        if (!wmonPoolInfoIn.exists) {
          throw new Error(
            `Aucun pool de liquidité n'existe pour ${
              wmonPoolInfoIn.tokenASymbol || tokenInAddress
            } -> MON. Impossible de procéder au swap.`
          );
        }
      } else {
        if (directPoolInfo.exists) {
          path = [tokenInAddress!, tokenOutAddress];
          useDirectPath = true;
          console.error(
            `Utilisation du chemin direct: ${tokenInAddress} -> ${tokenOutAddress}`
          );
        } else if (wmonPoolInfoIn.exists && wmonPoolInfoOut.exists) {
          path = [tokenInAddress!, WMON_ADDRESS, tokenOutAddress];
          console.error(
            `Utilisation du chemin via MON: ${tokenInAddress} -> ${WMON_ADDRESS} -> ${tokenOutAddress}`
          );
        } else {
          throw new Error(
            `Aucun chemin de swap viable n'a été trouvé entre ${
              wmonPoolInfoIn.tokenASymbol || tokenInAddress
            } et ${
              wmonPoolInfoOut.tokenBSymbol || tokenOutAddress
            }. Vérifiez que les pools de liquidité existent sur ${routerType}.`
          );
        }
      }

      console.error(`Chemin de swap final: ${path.join(" -> ")}`);

      let userBalance;
      if (useNativeMON) {
        userBalance = await provider.getBalance(walletAddress);
        console.error(
          `Solde MON du wallet: ${ethers.formatEther(userBalance)} MON`
        );
      } else {
        const tokenIn = new ethers.Contract(
          tokenInAddress!,
          ERC20_ABI,
          provider
        );
        userBalance = await tokenIn.balanceOf(walletAddress);

        let decimals = 18;
        try {
          decimals = await tokenIn.decimals();
        } catch (error) {
          console.error(
            "Impossible de récupérer les décimales, utilisation de la valeur par défaut 18"
          );
        }

        console.error(
          `Solde de tokens du wallet: ${ethers.formatUnits(
            userBalance,
            decimals
          )} tokens`
        );
      }

      let formattedAmountIn;
      let tokenDecimals = 18;

      if (useNativeMON) {
        formattedAmountIn = ethers.parseEther(amountIn);
        console.error(
          `Montant d'entrée: ${amountIn} MON (${formattedAmountIn.toString()} wei)`
        );

        const estimatedGas = ethers.parseEther("0.005");
        if (userBalance < formattedAmountIn + estimatedGas) {
          throw new Error(
            `Solde MON insuffisant. Vous avez ${ethers.formatEther(
              userBalance
            )} MON, mais vous essayez de swapper ${amountIn} MON plus les frais de gas.`
          );
        }
      } else {
        const tokenIn = new ethers.Contract(
          tokenInAddress!,
          ERC20_ABI,
          provider
        );
        try {
          tokenDecimals = await tokenIn.decimals();
        } catch (error) {
          console.error(
            "Impossible de récupérer les décimales, utilisation de la valeur par défaut 18"
          );
        }

        formattedAmountIn = ethers.parseUnits(amountIn, tokenDecimals);
        console.error(
          `Montant d'entrée: ${amountIn} tokens (${formattedAmountIn.toString()} unités avec ${tokenDecimals} décimales)`
        );

        if (userBalance < formattedAmountIn) {
          throw new Error(
            `Solde de tokens insuffisant. Vous avez ${ethers.formatUnits(
              userBalance,
              tokenDecimals
            )} tokens, mais vous essayez d'en swapper ${amountIn}.`
          );
        }
      }

      let amountsOut;
      let estimatedAmountOut;

      try {
        console.error(
          `Demande de getAmountsOut pour ${ethers.formatUnits(
            formattedAmountIn,
            useNativeMON ? 18 : tokenDecimals
          )} avec chemin:`,
          path
        );
        amountsOut = await router.getAmountsOut(formattedAmountIn, path);
        estimatedAmountOut = amountsOut[amountsOut.length - 1];

        if (estimatedAmountOut === BigInt(0)) {
          throw new Error(
            "Le montant de sortie estimé est 0, ce qui suggère une absence de liquidité"
          );
        }

        console.error(
          `Montants calculés par le routeur:`,
          amountsOut.map((a: bigint) => a.toString())
        );
      } catch (error) {
        console.error(`Erreur lors de l'estimation des montants:`, error);
        throw new Error(
          `Impossible d'estimer le montant de sortie. Ceci est généralement dû à un manque de liquidité pour cette paire de trading ou à un problème avec le routeur DEX.`
        );
      }

      const slippageFactor = 1000 - slippagePercentage * 10;
      const minAmountOut =
        (estimatedAmountOut * BigInt(slippageFactor)) / BigInt(1000);

      console.error(
        `Montant estimé en sortie: ${ethers.formatUnits(
          estimatedAmountOut,
          18
        )}`
      );
      console.error(
        `Montant minimum en sortie (avec slippage de ${slippagePercentage}%): ${ethers.formatUnits(
          minAmountOut,
          18
        )}`
      );

      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 300;

      let swapTx;
      let receipt;

      try {
        if (useNativeMON) {
          console.error("Exécution d'un swap MON -> Token...");

          const gasLimit = await router.swapExactETHForTokens.estimateGas(
            minAmountOut,
            path,
            walletAddress,
            swapDeadline,
            { value: formattedAmountIn }
          );

          console.error(`Limite de gas estimée: ${gasLimit.toString()}`);

          swapTx = await router.swapExactETHForTokens(
            minAmountOut,
            path,
            walletAddress,
            swapDeadline,
            {
              value: formattedAmountIn,
              gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
            }
          );
        } else if (
          path.length > 0 &&
          path[path.length - 1].toLowerCase() === WMON_ADDRESS.toLowerCase()
        ) {
          console.error("Exécution d'un swap Token -> MON...");

          const tokenIn = new ethers.Contract(
            tokenInAddress!,
            ERC20_ABI,
            wallet
          );
          const allowance = await tokenIn.allowance(
            walletAddress,
            routerAddress
          );

          if (allowance < formattedAmountIn) {
            console.error("Approbation du token nécessaire...");
            const approveTx = await tokenIn.approve(
              routerAddress,
              ethers.MaxUint256
            );
            const approveReceipt = await approveTx.wait();
            console.error(
              `Token approuvé avec succès. Hash: ${approveTx.hash}, Bloc: ${approveReceipt.blockNumber}`
            );
          } else {
            console.error(
              `Approbation existante suffisante: ${allowance.toString()}`
            );
          }

          const gasLimit = await router.swapExactTokensForETH.estimateGas(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline
          );

          console.error(`Limite de gas estimée: ${gasLimit.toString()}`);

          swapTx = await router.swapExactTokensForETH(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline,
            {
              gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
            }
          );
        } else {
          console.error("Exécution d'un swap Token -> Token...");

          const tokenIn = new ethers.Contract(
            tokenInAddress!,
            ERC20_ABI,
            wallet
          );
          const allowance = await tokenIn.allowance(
            walletAddress,
            routerAddress
          );

          if (allowance < formattedAmountIn) {
            console.error("Approbation du token nécessaire...");
            const approveTx = await tokenIn.approve(
              routerAddress,
              ethers.MaxUint256
            );
            const approveReceipt = await approveTx.wait();
            console.error(
              `Token approuvé avec succès. Hash: ${approveTx.hash}, Bloc: ${approveReceipt.blockNumber}`
            );
          } else {
            console.error(
              `Approbation existante suffisante: ${allowance.toString()}`
            );
          }

          const gasLimit = await router.swapExactTokensForTokens.estimateGas(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline
          );

          console.error(`Limite de gas estimée: ${gasLimit.toString()}`);

          swapTx = await router.swapExactTokensForTokens(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline,
            {
              gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
            }
          );
        }

        console.error(`Transaction de swap envoyée. Hash: ${swapTx.hash}`);
        console.error("Attente de la confirmation de la transaction...");

        console.error(
          `Transaction en attente de confirmation: ${swapTx.hash ?? swapTx}`
        );
        // Dans ethers.js v6, nous devons utiliser provider.waitForTransaction au lieu de wait()
        const txHash =
          typeof swapTx === "object" && swapTx !== null
            ? "hash" in swapTx
              ? swapTx.hash
              : String(swapTx)
            : String(swapTx);

        // Définir un type explicite pour receipt
        interface TransactionReceiptResponse {
          blockNumber?: number;
          hash?: string;
          gasUsed?: bigint;
          status?: number;
        }

        const receipt = (await provider.waitForTransaction(
          txHash
        )) as TransactionReceiptResponse;
        console.error(
          `Transaction confirmée! Hash: ${receipt?.hash ?? "inconnu"}`
        );
      } catch (error) {
        console.error("Erreur détaillée lors de l'exécution du swap:", error);

        let errorMessage = "Raison inconnue";
        const errorString = String(error);

        if (errorString.includes("insufficient funds")) {
          errorMessage =
            "Fonds insuffisants pour couvrir le montant du swap et les frais de gas";
        } else if (errorString.includes("execution reverted")) {
          if (errorString.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            errorMessage =
              "Le montant de sortie est inférieur au minimum requis (slippage trop élevé)";
          } else if (errorString.includes("INSUFFICIENT_LIQUIDITY")) {
            errorMessage =
              "Liquidité insuffisante dans le pool pour cette paire de trading";
          } else if (errorString.includes("EXPIRED")) {
            errorMessage =
              "La transaction a expiré avant d'être incluse dans un bloc";
          } else {
            errorMessage =
              "Le contrat a rejeté la transaction (possible problème de liquidité ou de configuration)";
          }
        }

        throw new Error(
          `Échec du swap: ${errorMessage}. Détails techniques: ${errorString}`
        );
      }

      let tokenInSymbol = useNativeMON ? "MON" : "Unknown";
      let tokenOutSymbol = "Unknown";

      if (!useNativeMON && tokenInAddress) {
        try {
          const tokenIn = new ethers.Contract(
            tokenInAddress,
            ERC20_ABI,
            provider
          );
          tokenInSymbol = await tokenIn.symbol();
        } catch (error) {
          console.error("Impossible de récupérer le symbole du token d'entrée");
        }
      }

      try {
        const tokenOut = new ethers.Contract(
          tokenOutAddress,
          ERC20_ABI,
          provider
        );
        tokenOutSymbol = await tokenOut.symbol();
      } catch (error) {
        console.error("Impossible de récupérer le symbole du token de sortie");
      }

      return {
        content: [
          {
            type: "text",
            text: `Swap de tokens réussi !
  
  De: ${amountIn} ${tokenInSymbol}
  À: ${ethers.formatUnits(
    estimatedAmountOut,
    18
  )} ${tokenOutSymbol} (estimation)
  
  Transaction: ${(swapTx as any).hash}
  Block: ${(receipt as any)?.blockNumber || "N/A"}
  DEX utilisé: ${routerType}
  Chemin de swap: ${path
    .map((addr, i) => {
      if (addr && addr.toLowerCase() === WMON_ADDRESS.toLowerCase())
        return "MON";
      return i === 0 && useNativeMON
        ? "MON"
        : addr
        ? `Token(${addr.slice(0, 6)}...${addr.slice(-4)})`
        : "Token(inconnu)";
    })
    .join(" -> ")}
  
  Vous pouvez consulter votre transaction ici:
  https://testnet.monadexplorer.com/tx/${(swapTx as any).hash}`,
          },
        ],
        txHash: (swapTx as any).hash,
        blockNumber: (receipt as any)?.blockNumber || 0,
        tokenInSymbol,
        tokenOutSymbol,
        amountIn: amountIn,
        estimatedAmountOut: ethers.formatUnits(estimatedAmountOut, 18),
        actualAmountOut: ethers.formatUnits(estimatedAmountOut, 18),
        dex: routerType,
      };
    } catch (error) {
      console.error("Erreur lors du swap de tokens:", error);

      let errorMessage = error instanceof Error ? error.message : String(error);
      let friendlyMessage = `Échec du swap de tokens. Erreur: ${errorMessage}`;

      friendlyMessage += `\n\nSuggestions:
  1. Vérifiez que vous disposez de suffisamment de tokens pour le swap et pour payer les frais de gas
  2. Assurez-vous que les adresses des tokens sont correctes
  3. Vérifiez que la paire de trading existe sur le DEX choisi
  4. Essayez d'augmenter le slippage pour les paires à faible liquidité
  5. Vérifiez que vous utilisez la bonne adresse de routeur pour le DEX`;

      return {
        content: [
          {
            type: "text",
            text: friendlyMessage,
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
