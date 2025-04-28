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
import { TOKEN_SYMBOLS } from "./shared/popular-tokens.js";

console.error("Starting MCP server...");

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
  "Allow users to swap tokens on DEXes available on Monad Testnet",
  {
    privateKey: z
      .string()
      .describe("User's private key to perform the transaction"),
    routerType: z
      .enum(["uniswap", "sushiswap"])
      .default("uniswap")
      .describe("Type of DEX router to use"),
    tokenInAddress: z
      .string()
      .optional()
      .describe("Input token address (optional for native MON swaps)"),
    tokenOutAddress: z.string().describe("Output token address"),
    amountIn: z
      .string()
      .describe(
        "Input token amount (in whole units, will be converted according to token decimals)"
      ),
    slippagePercentage: z
      .number()
      .default(5)
      .describe("Allowed slippage percentage"),
    deadline: z
      .number()
      .optional()
      .describe("Expiration deadline in seconds since epoch (optional)"),
    useNativeMON: z
      .boolean()
      .default(false)
      .describe("Use native MON as input token"),
    checkLiquidityOnly: z
      .boolean()
      .default(false)
      .describe("Check liquidity only without performing the swap"),
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
      console.error("Initializing token swap on Monad...");

      if (!useNativeMON && !tokenInAddress) {
        throw new Error(
          "Input token address is required when useNativeMON is false"
        );
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Wallet address: ${walletAddress}`);

      let routerAddress;
      let factoryAddress;
      if (routerType === "uniswap") {
        routerAddress = DEX_ADDRESSES.uniswapV2Router;
        factoryAddress = DEX_ADDRESSES.uniswapV2Factory;
        console.error(`Using Uniswap V2 router at address: ${routerAddress}`);
        console.error(`Uniswap V2 factory at address: ${factoryAddress}`);
      } else if (routerType === "sushiswap") {
        routerAddress = DEX_ADDRESSES.sushiswapRouter;
        factoryAddress =
          DEX_ADDRESSES.sushiswapFactory ||
          "0x0000000000000000000000000000000000000000";
        console.error(`Using SushiSwap router at address: ${routerAddress}`);
      } else {
        throw new Error(`Unsupported router type: ${routerType}`);
      }

      if (!ethers.isAddress(routerAddress)) {
        console.error(
          `ERROR: Invalid ${routerType} router address: ${routerAddress}`
        );
        throw new Error(
          `Invalid or unconfigured ${routerType} router address. Please check DEX configuration.`
        );
      }

      if (!ethers.isAddress(WMON_ADDRESS)) {
        console.error(`ERROR: Invalid WMON address: ${WMON_ADDRESS}`);
        throw new Error(
          `Invalid or unconfigured WMON address: ${WMON_ADDRESS}. Please check configuration.`
        );
      }

      console.error(`Using ${routerType} router at address ${routerAddress}`);

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
          `ERROR: No code at ${routerType} router address: ${routerAddress}`
        );
        throw new Error(
          `No contract exists at ${routerType} router address (${routerAddress}). Verify that the DEX is properly deployed on Monad testnet.`
        );
      }

      console.error(`Router code verified: ${routerCode.substring(0, 10)}...`);

      const effectiveTokenInAddress = useNativeMON
        ? WMON_ADDRESS
        : tokenInAddress!;

      async function checkPoolLiquidity(tokenA: string, tokenB: string) {
        try {
          console.error(`Checking pool existence ${tokenA} <-> ${tokenB}...`);
          const pairAddress = await factory.getPair(tokenA, tokenB);

          if (pairAddress === "0x0000000000000000000000000000000000000000") {
            console.error(`No pool exists for ${tokenA} <-> ${tokenB}`);
            return {
              exists: false,
              liquidity: "0",
              tokenASymbol: "Unknown",
              tokenBSymbol: "Unknown",
              pairAddress: "0x0000000000000000000000000000000000000000",
            };
          }

          console.error(`Pool found at address: ${pairAddress}`);

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

          let tokenASymbol = "Unknown";
          let tokenBSymbol = "Unknown";

          try {
            const tokenAContract = new ethers.Contract(
              tokenA,
              ERC20_ABI,
              provider
            );
            tokenASymbol = await tokenAContract.symbol();
          } catch (error) {
            console.error(`Could not retrieve symbol for ${tokenA}`);
          }

          try {
            const tokenBContract = new ethers.Contract(
              tokenB,
              ERC20_ABI,
              provider
            );
            tokenBSymbol = await tokenBContract.symbol();
          } catch (error) {
            console.error(`Could not retrieve symbol for ${tokenB}`);
          }

          console.error(
            `Liquidity: ${ethers.formatEther(
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
          console.error(`Error checking pool:`, error);
          return {
            exists: false,
            liquidity: "0",
            error: String(error),
            tokenASymbol: "Unknown",
            tokenBSymbol: "Unknown",
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
            liquidity: "N/A (native MON)",
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

          console.error(`Fetching first ${limit} token pairs...`);

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
                    `Error retrieving symbols for pair ${i}:`,
                    error
                  );
                }
              }
            } catch (error) {
              console.error(`Error retrieving pair ${i}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error retrieving pairs:`, error);
        }

        return {
          content: [
            {
              type: "text",
              text: `Liquidity check for pools on ${routerType}:
  
  Direct pool ${
    effectiveTokenInAddress === WMON_ADDRESS
      ? "MON"
      : directPoolInfo.tokenASymbol
  } -> ${directPoolInfo.tokenBSymbol}: ${
                directPoolInfo.exists ? "Exists" : "Does not exist"
              }
  ${directPoolInfo.exists ? `Liquidity: ${directPoolInfo.liquidity}` : ""}
  Pool address: ${directPoolInfo.pairAddress}
  
  Pool ${
    effectiveTokenInAddress === WMON_ADDRESS
      ? "MON"
      : wmonPoolInfoIn.tokenASymbol
  } -> MON: ${wmonPoolInfoIn.exists ? "Exists" : "Does not exist"}
  ${wmonPoolInfoIn.exists ? `Liquidity: ${wmonPoolInfoIn.liquidity}` : ""}
  
  Pool MON -> ${wmonPoolInfoOut.tokenBSymbol}: ${
                wmonPoolInfoOut.exists ? "Exists" : "Does not exist"
              }
  ${wmonPoolInfoOut.exists ? `Liquidity: ${wmonPoolInfoOut.liquidity}` : ""}
  
  Recommended path: ${
    directPoolInfo.exists
      ? "Direct"
      : wmonPoolInfoIn.exists && wmonPoolInfoOut.exists
      ? "Via MON"
      : "No viable path"
  }
  
  ${
    popularTokens.length > 0
      ? `Popular tokens available on ${routerType}:
  ${popularTokens
    .map((t, i) => `${i + 1}. ${t.symbol} (${t.address})`)
    .join("\n")}
  
  If you want to create liquidity, you will need to add tokens to the pools through the DEX interface.`
      : "No popular tokens found."
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
          `Using MON -> Token path: ${WMON_ADDRESS} -> ${tokenOutAddress}`
        );

        if (!wmonPoolInfoOut.exists) {
          throw new Error(
            `No liquidity pool exists for MON -> ${
              wmonPoolInfoOut.tokenBSymbol || tokenOutAddress
            }. Cannot proceed with swap.`
          );
        }
      } else if (tokenOutAddress.toLowerCase() === WMON_ADDRESS.toLowerCase()) {
        path = [tokenInAddress!, WMON_ADDRESS];
        console.error(
          `Using Token -> MON path: ${tokenInAddress} -> ${WMON_ADDRESS}`
        );

        if (!wmonPoolInfoIn.exists) {
          throw new Error(
            `No liquidity pool exists for ${
              wmonPoolInfoIn.tokenASymbol || tokenInAddress
            } -> MON. Cannot proceed with swap.`
          );
        }
      } else {
        if (directPoolInfo.exists) {
          path = [tokenInAddress!, tokenOutAddress];
          useDirectPath = true;
          console.error(
            `Using direct path: ${tokenInAddress} -> ${tokenOutAddress}`
          );
        } else if (wmonPoolInfoIn.exists && wmonPoolInfoOut.exists) {
          path = [tokenInAddress!, WMON_ADDRESS, tokenOutAddress];
          console.error(
            `Using path via MON: ${tokenInAddress} -> ${WMON_ADDRESS} -> ${tokenOutAddress}`
          );
        } else {
          throw new Error(
            `No viable swap path found between ${
              wmonPoolInfoIn.tokenASymbol || tokenInAddress
            } and ${
              wmonPoolInfoOut.tokenBSymbol || tokenOutAddress
            }. Verify that liquidity pools exist on ${routerType}.`
          );
        }
      }

      console.error(`Final swap path: ${path.join(" -> ")}`);

      let userBalance;
      if (useNativeMON) {
        userBalance = await provider.getBalance(walletAddress);
        console.error(
          `Wallet MON balance: ${ethers.formatEther(userBalance)} MON`
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
          console.error("Could not retrieve decimals, using default value 18");
        }

        console.error(
          `Wallet token balance: ${ethers.formatUnits(
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
          `Input amount: ${amountIn} MON (${formattedAmountIn.toString()} wei)`
        );

        const estimatedGas = ethers.parseEther("0.005");
        if (userBalance < formattedAmountIn + estimatedGas) {
          throw new Error(
            `Insufficient MON balance. You have ${ethers.formatEther(
              userBalance
            )} MON, but trying to swap ${amountIn} MON plus gas fees.`
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
          console.error("Could not retrieve decimals, using default value 18");
        }

        formattedAmountIn = ethers.parseUnits(amountIn, tokenDecimals);
        console.error(
          `Input amount: ${amountIn} tokens (${formattedAmountIn.toString()} units with ${tokenDecimals} decimals)`
        );

        if (userBalance < formattedAmountIn) {
          throw new Error(
            `Insufficient token balance. You have ${ethers.formatUnits(
              userBalance,
              tokenDecimals
            )} tokens, but trying to swap ${amountIn}.`
          );
        }
      }

      let amountsOut;
      let estimatedAmountOut;

      try {
        console.error(
          `Requesting getAmountsOut for ${ethers.formatUnits(
            formattedAmountIn,
            useNativeMON ? 18 : tokenDecimals
          )} with path:`,
          path
        );
        amountsOut = await router.getAmountsOut(formattedAmountIn, path);
        estimatedAmountOut = amountsOut[amountsOut.length - 1];

        if (estimatedAmountOut === BigInt(0)) {
          throw new Error(
            "Estimated output amount is 0, suggesting no liquidity"
          );
        }

        console.error(
          `Amounts calculated by router:`,
          amountsOut.map((a: bigint) => a.toString())
        );
      } catch (error) {
        console.error(`Error estimating amounts:`, error);
        throw new Error(
          `Could not estimate output amount. This is usually due to lack of liquidity for this trading pair or an issue with the DEX router.`
        );
      }

      const slippageFactor = 1000 - 5 * 10;
      const minAmountOut =
        (estimatedAmountOut * BigInt(slippageFactor)) / BigInt(1000);

      console.error(
        `Estimated output amount: ${ethers.formatUnits(estimatedAmountOut, 18)}`
      );
      console.error(
        `Minimum output amount (with ${slippagePercentage}% slippage): ${ethers.formatUnits(
          minAmountOut,
          18
        )}`
      );

      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 300;

      let swapTx;
      let receipt;

      try {
        if (useNativeMON) {
          console.error("Executing MON -> Token swap...");

          const gasLimit = await router.swapExactETHForTokens.estimateGas(
            minAmountOut,
            path,
            walletAddress,
            swapDeadline,
            { value: formattedAmountIn }
          );

          console.error(`Estimated gas limit: ${gasLimit.toString()}`);

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
          console.error("Executing Token -> MON swap...");

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
            console.error("Token approval needed...");
            const approveTx = await tokenIn.approve(
              routerAddress,
              ethers.MaxUint256
            );
            const approveReceipt = await approveTx.wait();
            console.error(
              `Token approved successfully. Hash: ${approveTx.hash}, Block: ${approveReceipt.blockNumber}`
            );
          } else {
            console.error(
              `Existing approval sufficient: ${allowance.toString()}`
            );
          }

          const gasLimit = await router.swapExactTokensForETH.estimateGas(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline
          );

          console.error(`Estimated gas limit: ${gasLimit.toString()}`);

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
          console.error("Executing Token -> Token swap...");

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
            console.error("Token approval needed...");
            const approveTx = await tokenIn.approve(
              routerAddress,
              ethers.MaxUint256
            );
            const approveReceipt = await approveTx.wait();
            console.error(
              `Token approved successfully. Hash: ${approveTx.hash}, Block: ${approveReceipt.blockNumber}`
            );
          } else {
            console.error(
              `Existing approval sufficient: ${allowance.toString()}`
            );
          }

          const gasLimit = await router.swapExactTokensForTokens.estimateGas(
            formattedAmountIn,
            minAmountOut,
            path,
            walletAddress,
            swapDeadline
          );

          console.error(`Estimated gas limit: ${gasLimit.toString()}`);

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

        console.error(`Swap transaction sent. Hash: ${swapTx.hash}`);
        console.error("Waiting for transaction confirmation...");

        console.error(
          `Transaction pending confirmation: ${swapTx.hash ?? swapTx}`
        );
        // In ethers.js v6, we need to use provider.waitForTransaction instead of wait()
        const txHash =
          typeof swapTx === "object" && swapTx !== null
            ? "hash" in swapTx
              ? swapTx.hash
              : String(swapTx)
            : String(swapTx);

        // Define explicit type for receipt
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
          `Transaction confirmed! Hash: ${receipt?.hash ?? "unknown"}`
        );
      } catch (error) {
        console.error("Detailed error during swap execution:", error);

        let errorMessage = "Unknown reason";
        const errorString = String(error);

        if (errorString.includes("insufficient funds")) {
          errorMessage = "Insufficient funds to cover swap amount and gas fees";
        } else if (errorString.includes("execution reverted")) {
          if (errorString.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            errorMessage =
              "Output amount is less than required minimum (slippage too high)";
          } else if (errorString.includes("INSUFFICIENT_LIQUIDITY")) {
            errorMessage =
              "Insufficient liquidity in pool for this trading pair";
          } else if (errorString.includes("EXPIRED")) {
            errorMessage =
              "Transaction expired before being included in a block";
          } else {
            errorMessage =
              "Contract rejected transaction (possible liquidity or configuration issue)";
          }
        }

        throw new Error(
          `Swap failed: ${errorMessage}. Technical details: ${errorString}`
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
          console.error("Could not retrieve input token symbol");
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
        console.error("Could not retrieve output token symbol");
      }

      if (tokenInAddress && tokenOutAddress) {
        const tokenInSymbol =
          TOKEN_SYMBOLS[tokenInAddress.toLowerCase()] || "Unknown";
        const tokenOutSymbol =
          TOKEN_SYMBOLS[tokenOutAddress.toLowerCase()] || "Unknown";
        console.error(`Swapping from ${tokenInSymbol} to ${tokenOutSymbol}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Token swap successful!
  
  From: ${amountIn} ${tokenInSymbol}
  To: ${ethers.formatUnits(estimatedAmountOut, 18)} ${tokenOutSymbol} (estimate)
  
  Transaction: ${(swapTx as any).hash}
  Block: ${(receipt as any)?.blockNumber || "N/A"}
  DEX used: ${routerType}
  Swap path: ${path
    .map((addr, i) => {
      if (addr && addr.toLowerCase() === WMON_ADDRESS.toLowerCase())
        return "MON";
      return i === 0 && useNativeMON
        ? "MON"
        : addr
        ? `Token(${addr.slice(0, 6)}...${addr.slice(-4)})`
        : "Token(unknown)";
    })
    .join(" -> ")}
  
  You can view your transaction here:
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
      console.error("Error during token swap:", error);

      let errorMessage = error instanceof Error ? error.message : String(error);
      let friendlyMessage = `Token swap failed. Error: ${errorMessage}`;

      friendlyMessage += `\n\nSuggestions:
  1. Verify you have enough tokens for the swap and to pay gas fees
  2. Ensure token addresses are correct
  3. Verify the trading pair exists on the chosen DEX
  4. Try increasing slippage for low liquidity pairs
  5. Verify you're using the correct router address for the DEX`;

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
    console.error("Monad testnet MCP server started on stdio");
  } catch (error) {
    console.error("Server initialization error:", error);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
