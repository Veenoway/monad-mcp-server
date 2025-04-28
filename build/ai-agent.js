import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import { ERC20_ABI, UNISWAP_V2_ROUTER_ABI } from "./shared/constants.js";
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "monad-ai-trader",
    version: "0.0.1",
    capabilities: ["monad-ai-trader"],
});
async function performInitialTrade(wallet, initialInvestment) {
    try {
        console.error("Executing initial TCHOG purchase...");
        // Contract addresses
        const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
        const TCHOG_ADDRESS = "0xCaF9244A9D4A79c3229cb354a1919961fa0122B4";
        const DEX_ROUTER_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436";
        // Instantiate contracts
        const wmonContract = new ethers.Contract(WMON_ADDRESS, ERC20_ABI, wallet);
        const routerContract = new ethers.Contract(DEX_ROUTER_ADDRESS, UNISWAP_V2_ROUTER_ABI, wallet);
        // Amount to swap (50% of initial investment)
        const amountToSwap = initialInvestment * 0.5;
        const amountInWei = ethers.parseEther(amountToSwap.toString());
        // Approve router to spend WMON
        console.error(`Approving router to spend ${amountToSwap} WMON...`);
        const approvalTx = await wmonContract.approve(DEX_ROUTER_ADDRESS, amountInWei);
        await approvalTx.wait();
        // Calculate minimum amount to receive (with 1% slippage)
        const amountOutMin = 0; // For demonstration, accept any amount
        // Build swap path
        const path = [WMON_ADDRESS, TCHOG_ADDRESS];
        // Execute swap
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        const swapTx = await routerContract.swapExactTokensForTokens(amountInWei, amountOutMin, path, wallet.address, deadline, { gasLimit: 500000 });
        const swapTxHash = swapTx && typeof swapTx === "object"
            ? swapTx.hash
            : String(swapTx);
        const receipt = (await provider.waitForTransaction(swapTxHash));
        console.error(`Initial TCHOG purchase successful! Hash: ${receipt.hash}`);
        return {
            success: true,
            txHash: receipt.hash,
            amount: amountToSwap,
            action: "buy",
        };
    }
    catch (error) {
        console.error("Error during initial TCHOG purchase:", error);
        return {
            success: false,
            message: `Error during initial purchase: ${error}`,
        };
    }
}
server.tool("monad-ai-trader", "Create and manage an AI agent that automatically trades WMON/TCHOG on Monad Testnet", {
    privateKey: z
        .string()
        .describe("Private key of the wallet to use for trading"),
    initialInvestment: z
        .number()
        .default(0.1)
        .describe("Initial amount to invest in MON"),
    riskLevel: z
        .enum(["conservative", "moderate", "aggressive"])
        .default("moderate")
        .describe("Risk level for trading strategy"),
    learningRate: z
        .number()
        .default(0.1)
        .describe("Initial learning rate of the agent"),
    maxSlippage: z
        .number()
        .default(1.5)
        .describe("Maximum allowed slippage percentage"),
    action: z
        .enum(["create", "start", "stop", "status", "improve"])
        .default("status")
        .describe("Action to perform with the AI agent"),
}, 
// @ts-ignore - Complex response type
async ({ privateKey, initialInvestment, riskLevel, learningRate, maxSlippage, action, }, _extra) => {
    try {
        // Initialize wallet for agent
        const wallet = new ethers.Wallet(privateKey, provider);
        const agentAddress = wallet.address;
        // Generate unique ID for agent if it doesn't exist
        const agentId = `ai-trader-${agentAddress.substring(2, 8)}`;
        console.error(`Autonomous AI agent ${agentId} - Action: ${action}`);
        // Check wallet balance
        const balance = await provider.getBalance(agentAddress);
        console.error(`Available balance: ${ethers.formatEther(balance)} MON`);
        if (balance < ethers.parseEther(initialInvestment.toString())) {
            throw new Error(`Insufficient balance to start agent: ${ethers.formatEther(balance)} MON`);
        }
        // Contract addresses on Monad Testnet
        const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"; // Replace with actual address
        const TCHOG_ADDRESS = "0xCaF9244A9D4A79c3229cb354a1919961fa0122B4"; // Replace with actual address
        const DEX_ROUTER_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436"; // Replace with router address
        // Instantiate contracts
        const wmonContract = new ethers.Contract(WMON_ADDRESS, ERC20_ABI, wallet);
        const tchogContract = new ethers.Contract(TCHOG_ADDRESS, ERC20_ABI, wallet);
        const routerContract = new ethers.Contract(DEX_ROUTER_ADDRESS, UNISWAP_V2_ROUTER_ABI, wallet);
        const agentData = {
            id: agentId,
            address: agentAddress,
            status: "active", // Always active by default
            initialCapital: initialInvestment,
            currentBalance: Number(ethers.formatEther(balance)),
            transactions: [],
            learningMetrics: {
                successRate: 0,
                profitFactor: 0,
                averageProfit: 0,
                sharpeRatio: 0,
                learningRate: learningRate,
                explorationRate: 0.2,
                improvementIterations: 0,
            },
            riskProfile: riskLevel,
            createdAt: new Date().toISOString(),
            lastImprovement: null,
            strategyParams: {
                entryThreshold: riskLevel === "conservative"
                    ? 0.8
                    : riskLevel === "moderate"
                        ? 0.6
                        : 0.4,
                exitThreshold: riskLevel === "conservative"
                    ? 1.5
                    : riskLevel === "moderate"
                        ? 2
                        : 2.5,
                positionSizePercent: riskLevel === "conservative"
                    ? 10
                    : riskLevel === "moderate"
                        ? 25
                        : 40,
                stopLossPercent: riskLevel === "conservative"
                    ? 5
                    : riskLevel === "moderate"
                        ? 10
                        : 15,
                takeProfitPercent: riskLevel === "conservative"
                    ? 8
                    : riskLevel === "moderate"
                        ? 15
                        : 25,
            },
        };
        // Simulated technical analysis functions (to be implemented with real calculations)
        const technicalAnalysis = {
            calculateRSI: async (pair) => {
                // Simulate RSI value
                return 30 + Math.random() * 40;
            },
            calculateMACD: async (pair) => {
                // Simulate MACD signal
                return Math.random() - 0.5;
            },
            calculateEMA: async (pair, period) => {
                // Simulate EMA value
                return 0.00015 + (Math.random() * 0.00002 - 0.00001);
            },
            detectPricePattern: async (pair) => {
                // Simulate pattern detection
                const patterns = [
                    "double_bottom",
                    "head_shoulders",
                    "channel_breakout",
                    "none",
                ];
                return patterns[Math.floor(Math.random() * patterns.length)];
            },
        };
        // Function to execute a real transaction
        const executeTransaction = async (action, amount) => {
            console.error(`Executing real transaction: ${action} ${amount} TCHOG...`);
            try {
                // Get current balances
                const wmonBalance = await wmonContract.balanceOf(wallet.address);
                const tchogBalance = await tchogContract.balanceOf(wallet.address);
                console.error(`Current balances - WMON: ${ethers.formatUnits(wmonBalance, 18)}, TCHOG: ${ethers.formatUnits(tchogBalance, 18)}`);
                // Check if user has enough tokens for transaction
                if (action === "buy" &&
                    wmonBalance < ethers.parseEther(amount.toString())) {
                    return {
                        success: false,
                        error: `Insufficient WMON balance to buy ${amount} TCHOG`,
                    };
                }
                else if (action === "sell" &&
                    tchogBalance < ethers.parseUnits(amount.toString(), 18)) {
                    return {
                        success: false,
                        error: `Insufficient TCHOG balance to sell ${amount} TCHOG`,
                    };
                }
                // Calculate amount to trade
                const amountIn = action === "buy"
                    ? ethers.parseEther(amount.toString())
                    : ethers.parseUnits(amount.toString(), 18);
                // Approve router to spend our tokens if it's a sell
                if (action === "sell") {
                    console.error(`Approving router to spend ${amount} TCHOG`);
                    // In ethers.js v6, await directly on transaction
                    const receipt = await tchogContract.approve(DEX_ROUTER_ADDRESS, amountIn);
                    console.error(`Approval successful for ${amount} TCHOG`);
                }
                else if (action === "buy") {
                    console.error(`Approving router to spend ${amount} WMON`);
                    // In ethers.js v6, await directly on transaction
                    const receipt = await wmonContract.approve(DEX_ROUTER_ADDRESS, amountIn);
                    console.error(`Approval successful for ${amount} WMON`);
                }
                // Calculate slippage (0.5% default)
                const slippageTolerance = 99.5; // 0.5% slippage
                const minAmountOut = ethers.parseUnits((((action === "buy" ? amount * 0.00015 : amount) *
                    slippageTolerance) /
                    100).toString(), 18);
                // Configure transaction parameters
                const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
                // Swap path
                const path = action === "buy"
                    ? [WMON_ADDRESS, TCHOG_ADDRESS]
                    : [TCHOG_ADDRESS, WMON_ADDRESS];
                // Execute swap with user's real wallet
                const routerWithSigner = routerContract.connect(wallet);
                let swapTx;
                if (action === "buy") {
                    console.error(`Executing swap to buy ${amount} TCHOG`);
                    swapTx = await routerWithSigner.swapExactTokensForTokens(amountIn, minAmountOut, path, wallet.address, deadline, { gasLimit: 500000 });
                }
                else {
                    console.error(`Executing swap to sell ${amount} TCHOG`);
                    swapTx = await routerWithSigner.swapExactTokensForTokens(amountIn, minAmountOut, path, wallet.address, deadline, { gasLimit: 500000 });
                }
                const swapTxHash = swapTx && typeof swapTx === "object"
                    ? swapTx.hash
                    : String(swapTx);
                const receipt = (await provider.waitForTransaction(swapTxHash));
                // Get updated balances
                const newWmonBalance = await wmonContract.balanceOf(wallet.address);
                const newTchogBalance = await tchogContract.balanceOf(wallet.address);
                // Calculate real profit/loss
                const wmonDiff = newWmonBalance - wmonBalance;
                const tchogDiff = newTchogBalance - tchogBalance;
                const estimatedProfit = action === "buy"
                    ? ethers.formatUnits(tchogDiff, 18)
                    : ethers.formatUnits(wmonDiff, 18);
                // Record transaction in history
                const txDetails = {
                    txHash: receipt?.hash || swapTxHash,
                    timestamp: new Date().toISOString(),
                    action,
                    amount: amount.toString(),
                    price: action === "buy"
                        ? tchogDiff === 0n
                            ? "0"
                            : ethers.formatUnits((BigInt(amountIn) * 10n ** 18n) / tchogDiff, 18)
                        : ethers.formatUnits((wmonDiff * 10n ** 18n) / (BigInt(amountIn) || 1n), 18),
                    gasUsed: receipt?.gasUsed?.toString() || "0",
                    profit: estimatedProfit,
                    status: "completed",
                };
                agentData.transactions.push(txDetails);
                console.error(`Real transaction recorded: ${action} ${amount} TCHOG`);
                return {
                    success: true,
                    txHash: receipt?.hash || swapTxHash,
                    details: txDetails,
                };
            }
            catch (error) {
                console.error(`Error during real transaction execution: ${error}`);
                return {
                    success: false,
                    error: error.message,
                };
            }
        };
        // Function to make trading decision based on real data analysis
        const makeDecision = async () => {
            console.error("Analyzing WMON/TCHOG market with real data...");
            try {
                let priceData;
                // Try to get real data via Mobula API for the pair
                try {
                    console.error("Attempting to retrieve pair data via Mobula API...");
                    // The WMON/TCHOG pair address (modify address according to your real pair)
                    const PAIR_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436"; // Replace with actual pair address
                    const response = await fetch(`https://api.mobula.io/api/1/market/history/pair?address=${PAIR_ADDRESS}&period=1h&amount=2`);
                    if (response.ok) {
                        const pairData = (await response.json());
                        if (pairData?.data &&
                            Array.isArray(pairData.data) &&
                            pairData.data.length > 0) {
                            // The pair API returns OHLCV data
                            const ohlcvData = pairData.data;
                            // Extract the most recent closing price for current price
                            const latestCandle = ohlcvData[ohlcvData.length - 1];
                            const earlierCandle = ohlcvData[0];
                            // Calculate change over last hour (2 data points)
                            const change = ((latestCandle.close - earlierCandle.close) /
                                earlierCandle.close) *
                                100;
                            priceData = {
                                price: latestCandle.close,
                                change24h: change,
                                volume24h: latestCandle.volume || 0,
                                lastUpdated: new Date().toISOString(),
                            };
                            console.error(`Real pair data obtained - Price: ${priceData.price}, Change: ${priceData.change24h.toFixed(2)}%`);
                        }
                        else {
                            throw new Error("Invalid pair data format");
                        }
                    }
                    else {
                        throw new Error(`Error ${response.status}: ${response.statusText}`);
                    }
                }
                catch (apiError) {
                    console.error("Failed to retrieve pair data via Mobula API, using simulated data:", apiError);
                    // Use simulated data as fallback
                    priceData = {
                        price: 0.00015,
                        change24h: Math.random() * 10 - 5, // -5% to +5%
                        volume24h: 1000000 + Math.random() * 500000,
                        lastUpdated: new Date().toISOString(),
                    };
                    console.error("Using simulated data for market analysis");
                }
                // Verify that priceData is defined
                if (!priceData) {
                    priceData = {
                        price: 0.00015,
                        change24h: 0,
                        volume24h: 0,
                        lastUpdated: new Date().toISOString(),
                    };
                }
                // Simulate simplified technical indicators
                const indicators = {
                    price: priceData.price,
                    change24h: priceData.change24h,
                    volume24h: priceData.volume24h,
                    rsi: 50 + priceData.change24h * 2, // Simplified simulation
                    ema: priceData.price * (1 + priceData.change24h / 200), // Simplified simulation
                    macd: priceData.change24h / 2, // Simplified simulation
                    lastUpdated: priceData.lastUpdated,
                };
                // Simple trading strategy based on simulated values
                let decision = "hold";
                let confidence = 0.5;
                let amount = 0;
                // If RSI is low and price is falling, might be a buying opportunity
                if (indicators.rsi < 30 && indicators.change24h < -2) {
                    decision = "buy";
                    confidence =
                        0.7 + Math.min(0.2, Math.abs(indicators.change24h) / 100);
                    amount = Math.floor(10 + Math.random() * 90); // Between 10 and 100 units
                }
                // If RSI is high and price is rising quickly, consider selling
                else if (indicators.rsi > 70 && indicators.change24h > 2) {
                    decision = "sell";
                    confidence = 0.7 + Math.min(0.2, indicators.change24h / 100);
                    amount = Math.floor(10 + Math.random() * 90);
                }
                // Otherwise, maintain current position
                else {
                    decision = "hold";
                    confidence = 0.5 + Math.random() * 0.3;
                    amount = 0;
                }
                console.error(`Decision: ${decision.toUpperCase()} ${amount} TCHOG (Confidence: ${(confidence * 100).toFixed(2)}%)`);
                return {
                    decision,
                    amount,
                    confidence,
                    indicators,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                console.error(`Error during market analysis: ${error}`);
                return {
                    decision: "hold",
                    amount: 0,
                    confidence: 0.1,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                };
            }
        };
        // Function to improve agent based on past performance
        const improveAgent = () => {
            console.error("Improving AI agent based on trading history...");
            if (agentData.transactions.length < 5) {
                return {
                    success: false,
                    message: "Insufficient data to improve agent (minimum 5 transactions)",
                };
            }
            // Calculate performance metrics
            const profits = agentData.transactions
                .filter((tx) => tx.status === "completed")
                .map((tx) => parseFloat(tx.profit));
            const successCount = profits.filter((p) => p > 0).length;
            const totalCount = profits.length;
            const successRate = totalCount > 0 ? successCount / totalCount : 0;
            const averageProfit = totalCount > 0 ? profits.reduce((a, b) => a + b, 0) / totalCount : 0;
            // Calculate simplified Sharpe ratio
            const returns = profits.map((p) => p / 100);
            const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const stdDeviation = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
                returns.length);
            const sharpeRatio = stdDeviation > 0 ? meanReturn / stdDeviation : 0;
            // Update learning parameters
            agentData.learningMetrics.successRate = successRate;
            agentData.learningMetrics.averageProfit = averageProfit;
            agentData.learningMetrics.sharpeRatio = sharpeRatio;
            agentData.learningMetrics.improvementIterations++;
            // Reduce exploration rate over time to favor exploitation
            agentData.learningMetrics.explorationRate = Math.max(0.05, agentData.learningMetrics.explorationRate * 0.9);
            // Adjust strategy parameters based on performance
            if (successRate > 0.6) {
                // Successful strategy, increase position size
                agentData.strategyParams.positionSizePercent = Math.min(agentData.strategyParams.positionSizePercent * 1.1, riskLevel === "conservative"
                    ? 20
                    : riskLevel === "moderate"
                        ? 40
                        : 60);
            }
            else if (successRate < 0.4) {
                // Unsuccessful strategy, reduce position size
                agentData.strategyParams.positionSizePercent = Math.max(agentData.strategyParams.positionSizePercent * 0.9, riskLevel === "conservative"
                    ? 5
                    : riskLevel === "moderate"
                        ? 10
                        : 20);
            }
            // Adjust entry/exit thresholds
            if (averageProfit > 0) {
                agentData.strategyParams.takeProfitPercent *= 1.05; // Aim for higher profits
                agentData.strategyParams.stopLossPercent *= 0.95; // Reduce losses
            }
            else {
                agentData.strategyParams.takeProfitPercent *= 0.95; // Lower expectations
                agentData.strategyParams.stopLossPercent *= 1.05; // Increase loss tolerance
            }
            agentData.lastImprovement = new Date().toISOString();
            return {
                success: true,
                iterations: agentData.learningMetrics.improvementIterations,
                successRate,
                averageProfit,
                sharpeRatio,
                newParams: agentData.strategyParams,
            };
        };
        // Process requested action
        let result = null;
        // Type guards to check result type
        const isCreateResult = (result) => action === "create";
        const isStartResult = (result) => action === "start";
        const isStopResult = (result) => action === "stop";
        const isImproveResult = (result) => action === "improve";
        const isStatusResult = (result) => action === "status" ||
            !["create", "start", "stop", "improve"].includes(action);
        switch (action) {
            case "create":
                result = {
                    success: true,
                    agentId,
                    message: `Autonomous AI agent created: ${agentId}`,
                    address: agentAddress,
                    status: "active", // Active from creation
                    initialCapital: initialInvestment,
                    riskLevel,
                };
                // After creating agent, perform initial purchase
                if (agentAddress) {
                    try {
                        const tradeResult = await performInitialTrade(wallet, initialInvestment);
                        // Add transaction to agent history if trade successful
                        if (tradeResult.success) {
                            const transaction = {
                                txHash: tradeResult.txHash || "",
                                timestamp: new Date().toISOString(),
                                action: "buy",
                                amount: String(tradeResult.amount),
                                price: "0", // To be filled later with real price
                                gasUsed: "0", // To be filled later with real gas
                                profit: "0",
                                status: "completed",
                            };
                            agentData.transactions.push(transaction);
                            // Add initial trade information to result
                            result.initialTrade = {
                                success: true,
                                action: "buy",
                                amount: tradeResult.amount ?? 0, // Use 0 if amount is undefined
                                txHash: tradeResult.txHash || "",
                            };
                        }
                        else {
                            console.error("Initial purchase failed:", tradeResult.message);
                        }
                        // Start trading decision immediately after creation
                        console.error("Starting automatic trading after creation...");
                        // Make trading decision
                        const decision = await makeDecision();
                        if (decision.decision !== "hold" &&
                            decision.confidence > agentData.strategyParams.entryThreshold) {
                            console.error(`Auto trading decision: ${decision.decision.toUpperCase()} ${decision.amount} TCHOG`);
                            // Execute transaction
                            const txResult = await executeTransaction(decision.decision, decision.amount);
                            if (txResult.success) {
                                console.error(`Auto transaction successful: ${txResult.txHash}`);
                            }
                            else {
                                console.error(`Auto transaction failed: ${txResult.error}`);
                            }
                        }
                        else {
                            console.error(`HOLD decision - No auto trading for now`);
                        }
                    }
                    catch (tradeError) {
                        console.error("Error during initial purchase:", tradeError);
                    }
                }
                break;
            case "start":
                // Make trading decision
                const decision = await makeDecision();
                if (decision.decision !== "hold" &&
                    decision.confidence > agentData.strategyParams.entryThreshold) {
                    // Execute transaction
                    const txResult = await executeTransaction(decision.decision, decision.amount);
                    result = {
                        success: txResult.success,
                        agentId,
                        action: decision.decision,
                        amount: decision.amount,
                        confidence: decision.confidence,
                        txHash: txResult.success ? txResult.txHash : null,
                        message: txResult.success
                            ? `Transaction successful: ${decision.decision ? decision.decision.toUpperCase() : "NONE"} ${decision.amount || 0} TCHOG
  Confidence: ${decision.confidence ? (decision.confidence * 100).toFixed(2) : "0"}%
  Hash: ${txResult.txHash || "N/A"}`
                            : `Transaction failed: ${txResult.error}`,
                    };
                }
                else {
                    result = {
                        success: true,
                        agentId,
                        action: "hold",
                        message: `Decision: HOLD - Insufficient confidence (${(decision.confidence * 100).toFixed(2)}%) or no better opportunity detected`,
                        indicators: decision.indicators,
                    };
                }
                break;
            case "stop":
                result = {
                    success: true,
                    agentId,
                    message: `AI agent stopped: ${agentId}`,
                    status: "idle",
                };
                break;
            case "improve":
                const improvementResult = improveAgent();
                result = {
                    success: improvementResult.success,
                    agentId,
                    message: improvementResult.success
                        ? `AI agent improved after ${improvementResult.iterations} iterations`
                        : improvementResult.message,
                    metrics: improvementResult.success
                        ? {
                            successRate: improvementResult.successRate,
                            averageProfit: improvementResult.averageProfit,
                            sharpeRatio: improvementResult.sharpeRatio,
                            iterations: improvementResult.iterations,
                        }
                        : undefined,
                    newParams: improvementResult.success
                        ? improvementResult.newParams
                        : undefined,
                };
                break;
            case "status":
            default:
                // Get current status
                result = {
                    success: true,
                    agentId,
                    address: agentAddress,
                    balance: ethers.formatEther(balance),
                    status: "active", // Always in active mode
                    transactions: agentData.transactions.length,
                    riskLevel,
                    learningMetrics: agentData.learningMetrics,
                    strategyParams: agentData.strategyParams,
                    lastImprovement: agentData.lastImprovement,
                };
                break;
        }
        // Generate output
        let output = `
  🤖 AUTONOMOUS AI TRADING AGENT ${action === "create"
            ? "CREATED"
            : action === "start"
                ? "STARTED"
                : action === "stop"
                    ? "STOPPED"
                    : action === "improve"
                        ? "IMPROVED"
                        : "STATUS"}
  
  ID: ${agentId}
  Address: ${agentAddress}
  Balance: ${ethers.formatEther(balance)} MON
  Status: ${result && "status" in result
            ? result.status
            : action === "start"
                ? "active"
                : "inactive"}
  Risk Level: ${riskLevel.toUpperCase()}
  
  ${action === "create" && isCreateResult(result)
            ? `✅ AI agent created successfully
  Initial capital: ${initialInvestment} MON
  ${result.initialTrade && result.initialTrade.success
                ? `✅ Initial purchase: ${result.initialTrade.amount} WMON → TCHOG
  Hash: ${result.initialTrade.txHash}`
                : "⚠️ Initial purchase not performed"}
  To start agent: monad-ai-trader-autonomous --action=start --privateKey=${privateKey.substring(0, 6)}...`
            : action === "start" && isStartResult(result)
                ? `${result.success
                    ? `✅ Transaction executed: ${result.action ? result.action.toUpperCase() : "NONE"} ${result.amount || 0} TCHOG
  Confidence: ${result.confidence ? (result.confidence * 100).toFixed(2) : "0"}%
  Hash: ${result.txHash || "N/A"}`
                    : `❌ ${result.message || "Unknown error"}`}`
                : action === "stop" && isStopResult(result)
                    ? `✅ AI agent stopped`
                    : action === "improve" && isImproveResult(result)
                        ? `${result.success
                            ? `✅ AI agent improved after ${result.metrics && result.metrics.iterations
                                ? result.metrics.iterations
                                : "N/A"} iterations
  Success rate: ${result.metrics && result.metrics.successRate
                                ? (result.metrics.successRate * 100).toFixed(2)
                                : "N/A"}%
  Average profit: ${result.metrics && result.metrics.averageProfit
                                ? result.metrics.averageProfit.toFixed(6)
                                : "N/A"} MON
  Sharpe ratio: ${result.metrics && result.metrics.sharpeRatio
                                ? result.metrics.sharpeRatio.toFixed(2)
                                : "N/A"}
  
  NEW PARAMETERS:
  - Position size: ${result.newParams ? result.newParams.positionSizePercent.toFixed(2) : "N/A"}%
  - Entry threshold: ${result.newParams ? result.newParams.entryThreshold.toFixed(2) : "N/A"}`
                            : `❌ ${result.message || "Unknown error"}`}`
                        : isStatusResult(result)
                            ? `📊 AI AGENT STATUS
  Total transactions: ${result.transactions || 0}
  Learning rate: ${result.learningMetrics ? result.learningMetrics.learningRate : learningRate}
  Exploration rate: ${result.learningMetrics
                                ? result.learningMetrics.explorationRate.toFixed(3)
                                : "0.200"}
  Last improvement: ${result.lastImprovement || "Never"}
  
  STRATEGY PARAMETERS:
  - Position size: ${result.strategyParams
                                ? result.strategyParams.positionSizePercent.toFixed(2)
                                : "N/A"}%
  - Entry threshold: ${result.strategyParams
                                ? result.strategyParams.entryThreshold.toFixed(2)
                                : "N/A"}
  - Stop loss: ${result.strategyParams
                                ? result.strategyParams.stopLossPercent.toFixed(2)
                                : "N/A"}%
  - Take profit: ${result.strategyParams
                                ? result.strategyParams.takeProfitPercent.toFixed(2)
                                : "N/A"}%`
                            : ""}
  
  AVAILABLE COMMANDS:
  - To create an agent: monad-ai-trader-autonomous --action=create --privateKey=<your_key>
  - To start an agent: monad-ai-trader-autonomous --action=start --privateKey=<your_key>
  - To improve an agent: monad-ai-trader-autonomous --action=improve --privateKey=<your_key>
  - To stop an agent: monad-ai-trader-autonomous --action=stop --privateKey=<your_key>
  
  NOTE: The AI agent executes real transactions on Monad Testnet.
  All transactions are verifiable in the Monad explorer.
  `;
        return {
            content: [
                {
                    type: "text",
                    text: output,
                },
            ],
        };
    }
    catch (error) {
        console.error("Error during autonomous AI agent execution:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error during autonomous AI agent execution: ${error}`,
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
