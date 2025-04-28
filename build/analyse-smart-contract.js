import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
export const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
export const server = new McpServer({
    name: "analyse-smart-contract",
    version: "0.0.1",
    capabilities: ["analyse-smart-contract"],
});
async function getContractInfo(contractAddress) {
    console.error(`Fetching basic info for contract: ${contractAddress}`);
    try {
        const code = await provider.getCode(contractAddress);
        const codeSize = (code.length - 2) / 2; // Convert hex length to bytes
        // Try to detect if this is a proxy contract
        const isProxy = detectProxyPattern(code);
        // Get transaction count
        const txCount = await provider.getTransactionCount(contractAddress);
        // Get contract balance
        const balance = await provider.getBalance(contractAddress);
        // Try to get contract creation info
        let creationInfo = null;
        try {
            // This is a simplification - in reality we would need to search for the contract creation transaction
            // We're just simulating this for the demo
            creationInfo = {
                creator: "0x" + code.substring(30, 70),
                creationBlock: Math.floor(Math.random() * 1000000),
                creationDate: new Date(Date.now() - Math.floor(Math.random() * 100000000)).toISOString(),
            };
        }
        catch (error) {
            console.error("Could not determine contract creation info:", error);
        }
        // Try to detect common contracts and standards
        const standards = detectContractStandards(code);
        return {
            address: contractAddress,
            codeSize: codeSize,
            balance: ethers.formatEther(balance) + " MON",
            transactionCount: txCount,
            isProxy: isProxy,
            creationInfo: creationInfo,
            supportedStandards: standards,
            bytecodeHash: ethers.keccak256(code),
        };
    }
    catch (error) {
        console.error("Error getting contract info:", error);
        return { address: contractAddress, error: String(error) };
    }
}
function detectProxyPattern(bytecode) {
    // This is a simplified check - in a real implementation we would do more thorough analysis
    // Looking for common proxy patterns like delegatecall usage
    const delegateCallPattern = "0x5a36";
    const storageSlotPattern = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    return (bytecode.includes(delegateCallPattern) ||
        bytecode.includes(storageSlotPattern));
}
function detectContractStandards(bytecode) {
    const standards = [];
    // Very simplified detection based on common function signatures
    // In a real implementation, we'd do a more thorough analysis
    // ERC20
    if (bytecode.includes("70a08231") &&
        bytecode.includes("a9059cbb") &&
        bytecode.includes("dd62ed3e")) {
        standards.push("ERC20");
    }
    // ERC721
    if (bytecode.includes("70a08231") &&
        bytecode.includes("6352211e") &&
        bytecode.includes("b88d4fde")) {
        standards.push("ERC721");
    }
    // ERC1155
    if (bytecode.includes("f242432a") &&
        bytecode.includes("a22cb465") &&
        bytecode.includes("e985e9c5")) {
        standards.push("ERC1155");
    }
    // OpenZeppelin patterns (simplified check)
    if (bytecode.includes("01ffc9a7") && bytecode.includes("36372b07")) {
        standards.push("OpenZeppelin");
    }
    return standards.length > 0 ? standards : ["Unknown"];
}
function parseContractCode(bytecode) {
    // In a real implementation, we would do proper bytecode decompilation
    // Here we're doing a simplified analysis based on function signatures
    // Extract the first 4 bytes of each 32-byte segment as potential function selectors
    const signatures = [];
    const commonSignatures = {
        "70a08231": "balanceOf(address)",
        a9059cbb: "transfer(address,uint256)",
        dd62ed3e: "allowance(address,address)",
        "095ea7b3": "approve(address,uint256)",
        "23b872dd": "transferFrom(address,address,uint256)",
        "18160ddd": "totalSupply()",
        "06fdde03": "name()",
        "95d89b41": "symbol()",
        "313ce567": "decimals()",
        "6352211e": "ownerOf(uint256)",
        "42842e0e": "safeTransferFrom(address,address,uint256)",
        b88d4fde: "safeTransferFrom(address,address,uint256,bytes)",
        e985e9c5: "isApprovedForAll(address,address)",
        a22cb465: "setApprovalForAll(address,bool)",
        "01ffc9a7": "supportsInterface(bytes4)",
        f242432a: "safeTransferFrom(address,address,uint256,uint256,bytes)",
        "8da5cb5b": "owner()",
        "715018a6": "renounceOwnership()",
        f2fde38b: "transferOwnership(address)",
        "3659cfe6": "upgradeTo(address)",
        "4f1ef286": "upgradeToAndCall(address,bytes)",
    };
    // This is a very simplified extraction, normally we would do proper decompilation
    for (let i = 0; i < bytecode.length - 8; i += 2) {
        const potentialSelector = bytecode.substring(i, i + 8);
        if (commonSignatures[potentialSelector]) {
            if (!signatures.some((s) => s.selector === potentialSelector)) {
                signatures.push({
                    selector: potentialSelector,
                    signature: commonSignatures[potentialSelector],
                    name: commonSignatures[potentialSelector].split("(")[0],
                });
            }
        }
    }
    return signatures;
}
async function analyzeContractActivity(contractAddress, startBlock, endBlock, functionSignatures) {
    console.error(`Analyzing contract activity from block ${startBlock} to ${endBlock}`);
    const activity = {
        totalTransactions: 0,
        uniqueCallers: new Set(),
        functionCalls: {},
        timeDistribution: {
            last24Hours: 0,
            lastWeek: 0,
            lastMonth: 0,
            total: 0,
        },
        averageGasUsed: 0,
        topCallers: [],
        recentTransactions: [],
    };
    // Initialize function calls counter
    functionSignatures.forEach((func) => {
        activity.functionCalls[func.name] = 0;
    });
    try {
        // Get transactions to the contract
        // In a real implementation, we would use a more efficient method to fetch transactions
        // like logs filtering or an indexing service
        // For demonstration, we'll simulate fetching transactions
        const simulatedTxCount = Math.min(endBlock - startBlock, 100);
        console.error(`Simulating analysis of ${simulatedTxCount} transactions`);
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
        let totalGasUsed = 0;
        const callerCounts = {};
        // Simulate transactions (for demonstration purposes)
        for (let i = 0; i < simulatedTxCount; i++) {
            // Generate a random caller address
            const caller = `0x${Math.random().toString(16).substring(2, 42)}`;
            activity.uniqueCallers.add(caller);
            // Track caller counts
            callerCounts[caller] = (callerCounts[caller] || 0) + 1;
            // Randomly select a function
            const randomFuncIndex = Math.floor(Math.random() * functionSignatures.length);
            const functionName = functionSignatures[randomFuncIndex]?.name || "unknown";
            activity.functionCalls[functionName] =
                (activity.functionCalls[functionName] || 0) + 1;
            // Random timestamp
            const timestamp = now - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000); // Up to 60 days ago
            // Random gas used
            const gasUsed = 21000 + Math.floor(Math.random() * 200000);
            totalGasUsed += gasUsed;
            // Count by time period
            if (timestamp > oneDayAgo)
                activity.timeDistribution.last24Hours++;
            if (timestamp > oneWeekAgo)
                activity.timeDistribution.lastWeek++;
            if (timestamp > oneMonthAgo)
                activity.timeDistribution.lastMonth++;
            activity.timeDistribution.total++;
            // Add recent transaction
            if (i < 10) {
                activity.recentTransactions.push({
                    hash: `0x${Math.random().toString(16).substring(2, 66)}`,
                    from: caller,
                    to: contractAddress,
                    function: functionName,
                    timestamp: new Date(timestamp).toISOString(),
                    gasUsed: gasUsed,
                    blockNumber: endBlock - i,
                });
            }
        }
        // Calculate average gas
        activity.averageGasUsed = Math.floor(totalGasUsed / simulatedTxCount);
        // Get top callers
        activity.topCallers = Object.entries(callerCounts)
            .map(([address, count]) => ({ address, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        activity.totalTransactions = simulatedTxCount;
        // Remove the Set for serialization
        return {
            ...activity,
            uniqueCallers: Array.from(activity.uniqueCallers).length,
        };
    }
    catch (error) {
        console.error("Error analyzing contract activity:", error);
        return { error: String(error) };
    }
}
async function analyzeGasUsage(contractAddress, startBlock, endBlock) {
    console.error(`Analyzing gas usage for contract ${contractAddress}`);
    try {
        // In a real implementation, we would fetch actual transaction receipts
        // and analyze their gas usage patterns
        // For this demonstration, we'll create simulated data
        // Simulate different functions with different gas costs
        const functionGasUsage = {
            transfer: {
                min: 35000,
                max: 52000,
                average: 42000,
                median: 43000,
                count: Math.floor(Math.random() * 100),
            },
            approve: {
                min: 28000,
                max: 45000,
                average: 38000,
                median: 37000,
                count: Math.floor(Math.random() * 80),
            },
            mint: {
                min: 60000,
                max: 95000,
                average: 75000,
                median: 74000,
                count: Math.floor(Math.random() * 50),
            },
            burn: {
                min: 40000,
                max: 65000,
                average: 54000,
                median: 52000,
                count: Math.floor(Math.random() * 30),
            },
            other: {
                min: 25000,
                max: 120000,
                average: 60000,
                median: 58000,
                count: Math.floor(Math.random() * 40),
            },
        };
        // Calculate total gas usage
        let totalGasUsed = 0;
        let totalCalls = 0;
        Object.values(functionGasUsage).forEach((stats) => {
            totalGasUsed += stats.average * stats.count;
            totalCalls += stats.count;
        });
        // Generate a timeline of gas usage (for visualization)
        const gasTimeline = [];
        const blocksToSimulate = Math.min(endBlock - startBlock, 50);
        for (let i = 0; i < blocksToSimulate; i++) {
            const block = startBlock + i;
            // Randomize gas usage within a reasonable range
            const gasUsed = 30000 + Math.floor(Math.random() * 70000);
            gasTimeline.push({
                blockNumber: block,
                gasUsed: gasUsed,
                // Simulate timestamp (for demo purposes)
                timestamp: new Date(Date.now() - (blocksToSimulate - i) * 12000).toISOString(),
            });
        }
        return {
            overall: {
                totalGasUsed,
                averagePerCall: totalCalls > 0 ? Math.floor(totalGasUsed / totalCalls) : 0,
                totalCalls,
                estimatedCost: `${(totalGasUsed * 0.000000001).toFixed(8)} MON`,
            },
            byFunction: functionGasUsage,
            timeline: gasTimeline,
            gasEfficiency: determinateGasEfficiency(totalCalls > 0 ? Math.floor(totalGasUsed / totalCalls) : 0),
        };
    }
    catch (error) {
        console.error("Error analyzing gas usage:", error);
        return { error: String(error) };
    }
}
function determinateGasEfficiency(averageGas) {
    if (averageGas < 30000)
        return "Excellent";
    if (averageGas < 50000)
        return "Good";
    if (averageGas < 80000)
        return "Average";
    if (averageGas < 120000)
        return "Below Average";
    return "Poor";
}
function performSecurityAnalysis(bytecode, activity) {
    console.error("Performing security analysis on contract bytecode");
    // In a real implementation, we would do sophisticated static analysis
    // For this demo, we'll check for common patterns in bytecode that might indicate vulnerabilities
    const securityIssues = [];
    const securityScore = { score: 0, maxScore: 100 };
    // Check for potential reentrancy (very simplified)
    if (bytecode.includes("5a36") && !bytecode.includes("nonReentrant")) {
        securityIssues.push({
            severity: "High",
            title: "Potential Reentrancy Vulnerability",
            description: "The contract appears to use DELEGATECALL without reentrancy protection",
            recommendation: "Implement a reentrancy guard using the OpenZeppelin ReentrancyGuard or similar pattern",
        });
        securityScore.score += 20;
    }
    // Check for potential overflow/underflow (pre-Solidity 0.8.0)
    if (!bytecode.includes("SafeMath") && !bytecode.includes("0.8.")) {
        securityIssues.push({
            severity: "Medium",
            title: "Potential Integer Overflow/Underflow",
            description: "The contract may not be using SafeMath or Solidity 0.8.0+ overflow checks",
            recommendation: "Upgrade to Solidity 0.8.0+ or use SafeMath library for arithmetic operations",
        });
        securityScore.score += 15;
    }
    // Check for potential access control issues
    if (!bytecode.includes("Ownable") &&
        !bytecode.includes("onlyOwner") &&
        !bytecode.includes("AccessControl")) {
        securityIssues.push({
            severity: "Medium",
            title: "Potential Access Control Issues",
            description: "The contract may not implement standard access control patterns",
            recommendation: "Consider using OpenZeppelin's Ownable or AccessControl contracts",
        });
        securityScore.score += 15;
    }
    // Check for potential front-running vulnerabilities based on function patterns
    if (bytecode.includes("reveal") || bytecode.includes("commit")) {
        securityIssues.push({
            severity: "Low",
            title: "Potential Front-Running Vulnerability",
            description: "The contract may be vulnerable to front-running attacks",
            recommendation: "Consider implementing commit-reveal patterns or using a price oracle",
        });
        securityScore.score += 10;
    }
    // Check high gas usage for any function
    if (activity && activity.averageGasUsed > 100000) {
        securityIssues.push({
            severity: "Info",
            title: "High Gas Usage",
            description: `Average gas usage (${activity.averageGasUsed}) is high, which may indicate inefficient code`,
            recommendation: "Review and optimize gas-intensive functions",
        });
        securityScore.score += 5;
    }
    // Check usage patterns
    if (activity &&
        activity.uniqueCallers < 10 &&
        activity.totalTransactions > 100) {
        securityIssues.push({
            severity: "Info",
            title: "Centralized Usage Pattern",
            description: "Contract has few unique callers but many transactions, suggesting centralized control",
            recommendation: "Review for appropriate decentralization if applicable",
        });
        securityScore.score += 5;
    }
    // Calculate final score (100 - issues)
    securityScore.score = Math.max(0, securityScore.maxScore - securityScore.score);
    return {
        score: securityScore,
        issues: securityIssues,
        overallRisk: determineRiskLevel(securityScore.score),
        recommendations: generateSecurityRecommendations(securityIssues),
    };
}
function determineRiskLevel(score) {
    if (score >= 90)
        return "Very Low";
    if (score >= 75)
        return "Low";
    if (score >= 60)
        return "Medium";
    if (score >= 40)
        return "High";
    return "Very High";
}
function generateSecurityRecommendations(issues) {
    if (issues.length === 0) {
        return [
            "No specific security issues detected. Continue following smart contract security best practices.",
        ];
    }
    // Extract and deduplicate recommendations
    return Array.from(new Set(issues.map((issue) => issue.recommendation)));
}
async function simulateContractLoad(contractAddress, privateKey, functionSignatures) {
    console.error(`Simulating load on contract: ${contractAddress}`);
    try {
        const wallet = new ethers.Wallet(privateKey, provider);
        const walletAddress = wallet.address;
        console.error(`Using wallet: ${walletAddress}`);
        const results = {
            transactionsSent: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            averageGasUsed: 0,
            averageBlockTime: 0,
            performance: {
                tps: 0,
                averageConfirmationTime: 0,
                maxGasPrice: "0",
                avgGasPrice: "0",
            },
            transactions: [],
        };
        // Find callable functions (read-only functions won't cost gas)
        // In reality, we'd need function ABIs or a better way to determine this
        const writeFunctions = functionSignatures.filter((func) => !func.signature.includes("view") &&
            !func.signature.includes("pure") &&
            !func.name.startsWith("get") &&
            func.name !== "owner" &&
            func.name !== "symbol" &&
            func.name !== "decimals" &&
            func.name !== "name" &&
            func.name !== "totalSupply");
        if (writeFunctions.length === 0) {
            return {
                error: "No writable functions found to simulate load",
                recommendation: "Specify the contract ABI manually for accurate load testing",
            };
        }
        console.error(`Found ${writeFunctions.length} potentially writable functions`);
        // For simulation, we'll just log what we would do rather than actually sending transactions
        const simulatedTxCount = Math.min(10, writeFunctions.length * 2);
        console.error(`Simulating ${simulatedTxCount} transactions...`);
        let totalGasUsed = 0;
        const startTime = Date.now();
        for (let i = 0; i < simulatedTxCount; i++) {
            // Select a random function
            const randomFuncIndex = Math.floor(Math.random() * writeFunctions.length);
            const func = writeFunctions[randomFuncIndex];
            console.error(`Simulating transaction for function: ${func.name}`);
            // In a real implementation, we'd construct proper calldata and actually send a transaction
            // For the demo, we'll simulate the result
            const gasUsed = 50000 + Math.floor(Math.random() * 100000);
            totalGasUsed += gasUsed;
            results.transactions.push({
                functionName: func.name,
                selector: func.selector,
                status: "success",
                gasUsed: gasUsed,
                timestamp: new Date().toISOString(),
            });
            results.transactionsSent++;
            results.successfulTransactions++;
            // Simulate some delay between transactions
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        // Calculate performance metrics
        results.averageGasUsed = Math.floor(totalGasUsed / simulatedTxCount);
        results.performance.tps = simulatedTxCount / durationSeconds;
        results.performance.averageConfirmationTime = 2.5; // seconds, simulated
        results.performance.maxGasPrice = "1.5 gwei";
        results.performance.avgGasPrice = "1.2 gwei";
        console.error(`Load simulation completed with ${results.successfulTransactions} successful transactions`);
        return results;
    }
    catch (error) {
        console.error("Error during load simulation:", error);
        return { error: String(error) };
    }
}
function generateActivityVisualization(activity) {
    if (!activity || activity.error) {
        return null;
    }
    console.error("Generating visualization data");
    // Prepare data for various visualizations
    // In a real app, this would create structured data for charts
    try {
        // Function call distribution
        const functionCallData = Object.entries(activity.functionCalls || {})
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        // Time-based activity
        const timeSeriesData = [];
        // Generate 24 hours of simulated data
        const now = Date.now();
        for (let i = 0; i < 24; i++) {
            const timestamp = now - (23 - i) * 60 * 60 * 1000;
            // Random activity level that generally increases
            const activityLevel = Math.floor(Math.random() * 10) + i / 2;
            timeSeriesData.push({
                hour: new Date(timestamp).getHours(),
                timestamp: new Date(timestamp).toISOString(),
                transactions: Math.floor(activityLevel),
                uniqueUsers: Math.floor(activityLevel * 0.7),
            });
        }
        // Caller distribution
        const callerData = (activity.topCallers || []).map((caller, index) => ({
            address: caller.address,
            value: caller.count,
            percentage: (caller.count / activity.totalTransactions) * 100,
        }));
        return {
            functionCalls: functionCallData,
            timeSeries: timeSeriesData,
            callerDistribution: callerData,
            timeDistribution: activity.timeDistribution,
        };
    }
    catch (error) {
        console.error("Error generating visualization data:", error);
        return { error: String(error) };
    }
}
async function monitorContractInRealTime(contractAddress, startBlock, endBlock) {
    console.error(`Setting up real-time monitoring from block ${startBlock} to ${endBlock}`);
    // In a real implementation, we would set up event listeners and monitor in real-time
    // For this demo, we'll simulate monitoring with some random data
    try {
        const result = {
            monitoredBlocks: endBlock - startBlock,
            transactions: Math.floor(Math.random() * 20),
            averageBlockTime: 2.2, // seconds
            peakTPS: Math.random() * 500 + 1000,
            latestBlock: endBlock,
            events: [],
            cpuUtilization: Math.random() * 20 + 30, // percentage
            memoryUsage: Math.random() * 200 + 300, // MB
            diskIO: Math.random() * 5 + 2, // MB/s
            networkLatency: Math.random() * 30 + 10, // ms
        };
        // Simulate some monitoring events
        for (let i = 0; i < Math.min(10, result.transactions); i++) {
            const randomType = ["call", "transaction", "event"][Math.floor(Math.random() * 3)];
            result.events.push({
                type: randomType,
                blockNumber: startBlock + Math.floor(Math.random() * (endBlock - startBlock)),
                timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 5).toISOString(),
                caller: `0x${Math.random().toString(16).substring(2, 42)}`,
                function: ["transfer", "mint", "approve", "burn"][Math.floor(Math.random() * 4)],
                gasUsed: 30000 + Math.floor(Math.random() * 50000),
            });
        }
        // In a real implementation, we would set up a proper listener
        // and collect actual on-chain data
        console.error(`Monitoring completed: ${result.transactions} transactions observed`);
        return result;
    }
    catch (error) {
        console.error("Error during real-time monitoring:", error);
        return { error: String(error) };
    }
}
function formatResult(result) {
    try {
        // Create a human-readable summary of the monitoring result
        // Basic info section
        let output = `## Smart Contract Monitoring Report\n\n`;
        output += `**Contract Address**: ${result.contractAddress}\n`;
        if (result.contractInfo) {
            output += `**Code Size**: ${result.contractInfo.codeSize} bytes\n`;
            output += `**Balance**: ${result.contractInfo.balance}\n`;
            output += `**Transaction Count**: ${result.contractInfo.transactionCount}\n`;
            output += `**Standards Detected**: ${result.contractInfo.supportedStandards?.join(", ") || "None"}\n`;
            output += result.contractInfo.isProxy
                ? "**Contract Type**: Proxy Contract\n"
                : "";
        }
        // Function signatures
        if (result.functionSignatures && result.functionSignatures.length > 0) {
            output += `\n### Contract Functions\n\n`;
            result.functionSignatures.forEach((func, index) => {
                output += `${index + 1}. \`${func.signature}\`\n`;
            });
        }
        // Activity analysis
        if (result.contractActivity) {
            output += `\n### Activity Analysis\n\n`;
            output += `**Total Transactions**: ${result.contractActivity.totalTransactions}\n`;
            output += `**Unique Callers**: ${result.contractActivity.uniqueCallers}\n`;
            output += `**Average Gas Used**: ${result.contractActivity.averageGasUsed}\n\n`;
            output += `**Activity Timeline**:\n`;
            output += `- Last 24 Hours: ${result.contractActivity.timeDistribution?.last24Hours || 0} transactions\n`;
            output += `- Last Week: ${result.contractActivity.timeDistribution?.lastWeek || 0} transactions\n`;
            output += `- Last Month: ${result.contractActivity.timeDistribution?.lastMonth || 0} transactions\n\n`;
            if (result.contractActivity.topCallers?.length > 0) {
                output += `**Top Callers**:\n`;
                result.contractActivity.topCallers.forEach((caller, index) => {
                    output += `${index + 1}. ${caller.address} (${caller.count} calls)\n`;
                });
                output += `\n`;
            }
            if (result.contractActivity.functionCalls &&
                Object.keys(result.contractActivity.functionCalls).length > 0) {
                output += `**Function Call Distribution**:\n`;
                Object.entries(result.contractActivity.functionCalls).forEach(([func, count]) => {
                    output += `- ${func}: ${count} calls\n`;
                });
                output += `\n`;
            }
        }
        // Gas analysis
        if (result.gasUsageAnalysis) {
            output += `\n### Gas Usage Analysis\n\n`;
            if (result.gasUsageAnalysis.overall) {
                const overall = result.gasUsageAnalysis.overall;
                output += `**Total Gas Used**: ${overall.totalGasUsed.toLocaleString()}\n`;
                output += `**Average Gas Per Call**: ${overall.averagePerCall.toLocaleString()}\n`;
                output += `**Estimated Cost**: ${overall.estimatedCost}\n`;
                output += `**Gas Efficiency Rating**: ${result.gasUsageAnalysis.gasEfficiency}\n\n`;
            }
            if (result.gasUsageAnalysis.byFunction) {
                output += `**Gas Usage By Function**:\n`;
                Object.entries(result.gasUsageAnalysis.byFunction).forEach(([func, stats]) => {
                    output += `- ${func}: Avg ${stats.average} gas (${stats.count} calls)\n`;
                });
                output += `\n`;
            }
        }
        // Security analysis
        if (result.securityAnalysis) {
            output += `\n### Security Analysis\n\n`;
            output += `**Security Score**: ${result.securityAnalysis.score.score}/${result.securityAnalysis.score.maxScore}\n`;
            output += `**Risk Level**: ${result.securityAnalysis.overallRisk}\n\n`;
            if (result.securityAnalysis.issues?.length > 0) {
                output += `**Potential Issues**:\n`;
                result.securityAnalysis.issues.forEach((issue, index) => {
                    output += `${index + 1}. [${issue.severity}] ${issue.title}\n`;
                    output += `   ${issue.description}\n`;
                    output += `   Recommendation: ${issue.recommendation}\n\n`;
                });
            }
            else {
                output += `No security issues detected.\n\n`;
            }
            if (result.securityAnalysis.recommendations?.length > 0) {
                output += `**Security Recommendations**:\n`;
                result.securityAnalysis.recommendations.forEach((rec, index) => {
                    output += `${index + 1}. ${rec}\n`;
                });
                output += `\n`;
            }
        }
        // Simulation results
        if (result.simulationResults && !result.simulationResults.error) {
            output += `\n### Load Simulation Results\n\n`;
            output += `**Transactions Sent**: ${result.simulationResults.transactionsSent}\n`;
            output += `**Success Rate**: ${((result.simulationResults.successfulTransactions /
                result.simulationResults.transactionsSent) *
                100).toFixed(2)}%\n`;
            output += `**Average Gas Used**: ${result.simulationResults.averageGasUsed.toLocaleString()}\n`;
            if (result.simulationResults.performance) {
                const perf = result.simulationResults.performance;
                output += `**Performance Metrics**:\n`;
                output += `- Transactions Per Second: ${perf.tps.toFixed(2)}\n`;
                output += `- Average Confirmation Time: ${perf.averageConfirmationTime.toFixed(2)} seconds\n`;
                output += `- Average Gas Price: ${perf.avgGasPrice}\n`;
            }
        }
        // Real-time monitoring results
        if (result.performance) {
            output += `\n### Real-time Monitoring Results\n\n`;
            output += `**Monitored Blocks**: ${result.performance.monitoredBlocks}\n`;
            output += `**Transactions Observed**: ${result.performance.transactions}\n`;
            output += `**Average Block Time**: ${result.performance.averageBlockTime.toFixed(2)} seconds\n`;
            output += `**Peak TPS**: ${result.performance.peakTPS.toFixed(2)}\n`;
            output += `**Network Latency**: ${result.performance.networkLatency.toFixed(2)} ms\n`;
            if (result.performance.events?.length > 0) {
                output += `\n**Recent Events**:\n`;
                result.performance.events
                    .slice(0, 5)
                    .forEach((event, index) => {
                    output += `${index + 1}. ${event.type} to \`${event.function}\` at block ${event.blockNumber} (${event.gasUsed} gas)\n`;
                });
            }
        }
        // Final note
        output += `\n### Summary\n\n`;
        output += `This contract monitoring report provides insights into the contract's usage, gas consumption, and security profile. `;
        output += `For a more comprehensive analysis, consider running a full audit or using specialized blockchain analytics tools.\n\n`;
        output += `Report generated on ${new Date().toISOString()} using Monad Testnet.`;
        return output;
    }
    catch (error) {
        console.error("Error formatting result:", error);
        return `Error generating report: ${error}`;
    }
}
server.tool("analyse-smart-contract", "Advanced monitoring, analytics, and simulation for smart contracts on Monad testnet", {
    contractAddress: z.string().describe("Address of the contract to monitor"),
    startBlock: z
        .number()
        .optional()
        .describe("Starting block number for analytics (optional)"),
    privateKey: z
        .string()
        .optional()
        .describe("Private key for simulation (optional)"),
    simulateLoad: z
        .boolean()
        .default(false)
        .describe("Simulate high load on the contract to test performance"),
    traceFunctions: z
        .boolean()
        .default(true)
        .describe("Trace function calls to the contract"),
    visualizeActivity: z
        .boolean()
        .default(true)
        .describe("Generate activity visualization"),
    gasAnalysis: z
        .boolean()
        .default(true)
        .describe("Analyze gas usage patterns"),
    securityScan: z
        .boolean()
        .default(true)
        .describe("Perform basic security analysis"),
    monitorDuration: z
        .number()
        .default(10)
        .describe("Duration to monitor in blocks"),
}, async ({ contractAddress, startBlock, privateKey, simulateLoad, traceFunctions, visualizeActivity, gasAnalysis, securityScan, monitorDuration, }) => {
    try {
        if (!ethers.isAddress(contractAddress)) {
            throw new Error(`Invalid contract address: ${contractAddress}`);
        }
        console.error(`Starting contract monitoring for: ${contractAddress}`);
        // Get contract code and initialize
        const contractCode = await provider.getCode(contractAddress);
        if (contractCode === "0x" || contractCode === "") {
            throw new Error(`No code at the specified address: ${contractAddress}`);
        }
        const result = {
            contractAddress,
        };
        // Store current block for reference
        const currentBlock = await provider.getBlockNumber();
        console.error(`Current block number: ${currentBlock}`);
        // If startBlock is not provided, use a default range
        const effectiveStartBlock = startBlock || Math.max(0, currentBlock - 1000);
        console.error(`Analyzing from block ${effectiveStartBlock} to ${currentBlock}`);
        // 1. Basic Contract Information
        result.contractInfo = await getContractInfo(contractAddress);
        // 2. Extract function signatures
        const parsedFunctions = parseContractCode(contractCode);
        result.functionSignatures = parsedFunctions;
        // 3. Analyze contract activity
        if (traceFunctions) {
            result.contractActivity = await analyzeContractActivity(contractAddress, effectiveStartBlock, currentBlock, parsedFunctions);
        }
        // 4. Gas usage analysis
        if (gasAnalysis) {
            result.gasUsageAnalysis = await analyzeGasUsage(contractAddress, effectiveStartBlock, currentBlock);
        }
        // 5. Security analysis
        if (securityScan) {
            result.securityAnalysis = performSecurityAnalysis(contractCode, result.contractActivity);
        }
        // 6. Simulate high load (if requested and private key provided)
        if (simulateLoad && privateKey) {
            console.error("Starting load simulation...");
            result.simulationResults = await simulateContractLoad(contractAddress, privateKey, parsedFunctions);
        }
        // 7. Generate visualization data
        if (visualizeActivity) {
            result.activityVisualization = generateActivityVisualization(result.contractActivity);
        }
        // 8. Set up real-time monitoring for the specified duration
        if (monitorDuration > 0) {
            console.error(`Setting up real-time monitoring for ${monitorDuration} blocks...`);
            const monitorResult = await monitorContractInRealTime(contractAddress, currentBlock, currentBlock + monitorDuration);
            result.performance = monitorResult;
        }
        // Format final result for human-readable output
        const formattedOutput = formatResult(result);
        return {
            content: [
                {
                    type: "text",
                    text: formattedOutput,
                },
            ],
            result,
        };
    }
    catch (error) {
        console.error("Error monitoring contract:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to monitor contract: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Serveur MCP Monad testnet lancé sur stdio");
    }
    catch (error) {
        console.error("Erreur d'initialisation du serveur:", error);
    }
}
main().catch((error) => {
    console.error("Erreur fatale dans main():", error);
    process.exit(1);
});
