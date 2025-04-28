import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "defi-challenges",
  version: "0.0.1",
  capabilities: ["defi-challenges"],
});

server.tool(
  "defi-challenges",
  "Participate in DeFi challenges on Monad and compare your performance with other users",
  {
    privateKey: z.string().describe("Private key of the participating wallet"),
    challengeType: z
      .enum(["yield-farming", "trading", "liquidity-mining", "staking", "all"])
      .default("all")
      .describe("Challenge type"),
    duration: z
      .enum(["daily", "weekly", "monthly"])
      .default("weekly")
      .describe("Challenge duration"),
    publicUsername: z
      .string()
      .optional()
      .describe("Public username for the leaderboard"),
    initialInvestment: z.string().describe("Initial amount for the challenge"),
    riskLevel: z
      .enum(["low", "medium", "high"])
      .default("medium")
      .describe("Acceptable risk level"),
    joinPool: z.boolean().default(false).describe("Join the rewards pool"),
    teamName: z.string().optional().describe("Team name (for team challenges)"),
    specificStrategies: z
      .array(z.string())
      .optional()
      .describe("Specific DeFi strategies to use"),
    autoRebalance: z
      .boolean()
      .default(false)
      .describe("Automatically rebalance the portfolio"),
    notificationsEnabled: z
      .boolean()
      .default(true)
      .describe("Enable performance notifications"),
  },
  async ({
    privateKey,
    challengeType,
    duration,
    publicUsername,
    initialInvestment,
    riskLevel,
    joinPool,
    teamName,
    specificStrategies,
    autoRebalance,
    notificationsEnabled,
  }) => {
    try {
      console.error(
        `Initializing DeFi challenge for ${publicUsername || "anonymous user"}`
      );

      // Initialize and validate parameters
      if (
        !ethers.isAddress(initialInvestment) &&
        isNaN(Number(initialInvestment))
      ) {
        throw new Error(
          `Invalid amount for initial investment: ${initialInvestment}`
        );
      }

      // Create wallet with private key
      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Wallet address: ${walletAddress}`);

      // Check wallet balance
      const balance = await provider.getBalance(walletAddress);
      const formattedBalance = ethers.formatEther(balance);
      console.error(`Wallet balance: ${formattedBalance} MON`);

      // Verify that initial amount doesn't exceed available balance
      const investmentAmount = ethers.parseEther(initialInvestment);
      if (balance < investmentAmount) {
        throw new Error(
          `Insufficient balance. You have ${formattedBalance} MON, but you're trying to invest ${initialInvestment} MON.`
        );
      }

      // Simulate challenge registration
      console.error(
        `Registering for ${challengeType} challenge with ${duration} duration`
      );
      const challengeId = `CHALLENGE_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Generate a random username if not provided
      const effectiveUsername =
        publicUsername ||
        `MonadUser_${Math.random().toString(36).substring(2, 7)}`;

      // Determine strategies based on challenge type and risk level
      const strategies = determineStrategies(
        challengeType,
        riskLevel,
        specificStrategies
      );
      console.error(`Selected strategies: ${strategies.join(", ")}`);

      // Determine entry fee (if applicable)
      const entryFee = joinPool
        ? calculateEntryFee(duration, initialInvestment)
        : "0";

      // Simulate registration transaction
      let registrationTxHash = "";
      if (joinPool) {
        console.error(`Simulating rewards pool payment: ${entryFee} MON`);
        registrationTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
      }

      // Get current leaderboard data (simulated)
      const leaderboardData = generateSimulatedLeaderboard(
        challengeType,
        duration
      );

      // Calculate potential rewards
      const potentialRewards = calculatePotentialRewards(
        joinPool,
        initialInvestment,
        leaderboardData
      );

      // Estimate performance based on strategy and risk
      const performanceProjection = projectPerformance(
        challengeType,
        riskLevel,
        duration,
        strategies
      );

      // Get active community challenges
      const activeChallenges = getActiveChallenges(duration);

      // Calculate estimated ranking
      const estimatedRanking = estimateRanking(
        initialInvestment,
        riskLevel,
        leaderboardData
      );

      // Simulate initial asset allocation based on strategy
      const initialAllocation = allocateAssets(
        challengeType,
        riskLevel,
        investmentAmount,
        strategies
      );

      // Generate a mockup visualization of the leaderboard (textual description)
      const leaderboardVisualization = visualizeLeaderboard(
        leaderboardData,
        effectiveUsername,
        estimatedRanking
      );

      // Simulate performance history and create a projection
      const performanceHistory = generatePerformanceHistory(duration);

      // Create a table of the best DeFi opportunities on Monad
      const defiOpportunities = identifyDefiOpportunities(
        challengeType,
        riskLevel
      );

      // Calculate Monad vs other chains advantages for selected strategies
      const chainComparison = compareWithOtherChains(challengeType, strategies);

      // Prepare challenge summary
      const challengeSummary = {
        challengeId,
        participant: {
          username: effectiveUsername,
          wallet: walletAddress,
          team: teamName || "Solo Participant",
        },
        challenge: {
          type: challengeType,
          duration,
          riskLevel,
          startedAt: new Date().toISOString(),
          endsAt: calculateEndDate(duration),
          initialInvestment: ethers.formatEther(investmentAmount),
          joinedRewardsPool: joinPool,
          entryFee,
          autoRebalancing: autoRebalance,
          registrationTxHash,
        },
        strategy: {
          selectedStrategies: strategies,
          initialAllocation,
          projectedAPY: performanceProjection.estimatedAPY,
          projectedROI: performanceProjection.estimatedROI,
        },
        ranking: {
          currentParticipants: leaderboardData.length,
          yourEstimatedRank: estimatedRanking,
          topPerformers: leaderboardData.slice(0, 3),
        },
        rewards: {
          totalPoolSize: calculateTotalPoolSize(
            leaderboardData,
            joinPool,
            entryFee
          ),
          estimatedRewards: potentialRewards.estimatedRewards,
          rewardsBreakdown: potentialRewards.breakdown,
        },
        performance: {
          history: performanceHistory,
          projectedValueInOneWeek: performanceProjection.valueInOneWeek,
          projectedValueInOneMonth: performanceProjection.valueInOneMonth,
          riskAssessment: performanceProjection.riskAssessment,
        },
        opportunities: defiOpportunities,
        chainComparison,
      };

      // Format result for display
      const formattedOutput = formatChallengeOutput(
        challengeSummary,
        leaderboardVisualization
      );

      return {
        content: [
          {
            type: "text",
            text: formattedOutput,
          },
        ],
        challengeSummary,
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error during challenge initialization: ${error}`,
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
    console.error("MCP DeFi challenges server started on stdio");
  } catch (error) {
    console.error("Server initialization error:", error);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

type ChallengeType =
  | "yield-farming"
  | "trading"
  | "liquidity-mining"
  | "staking"
  | "all";
type RiskLevel = "low" | "medium" | "high";
type Duration = "daily" | "weekly" | "monthly";

// Interface for comparison objects
interface GasComparison {
  chain: string;
  avgGasFee: string;
  monadSavings: string;
}

interface SpeedComparison {
  chain: string;
  blockTime: string;
  finality: string;
  monadSpeedup: string;
}

interface YieldComparison {
  strategy: string;
  ethereum: string;
  polygon: string;
  arbitrum: string;
  monad: string;
}

// Interface for asset allocation
interface AssetAllocation {
  asset: string;
  percentage: number;
  amount: string;
}

// Interface for leaderboard participants
interface Performer {
  rank: number;
  username: string;
  performance: number;
  initialInvestment: string;
  strategy: string;
  rewardShare: number;
}

// Interface for rewards
interface Reward {
  position: string;
  amount: string;
  chance: string;
}

// Interface for DeFi opportunities
interface DefiOpportunity {
  name: string;
  apy: string;
  risk: string;
  tvl: string;
  type: string;
}

// Interfaces for ChallengeSummary
interface ChallengeSummary {
  challengeId?: string;
  participant: {
    username: string;
    wallet: string;
    team: string;
  };
  challenge: {
    type: string;
    duration: string;
    riskLevel: string;
    startedAt: string;
    endsAt: string;
    initialInvestment: string | number;
    joinedRewardsPool: boolean;
    entryFee?: number | string;
    autoRebalancing: boolean;
    registrationTxHash?: string;
  };
  strategy: {
    selectedStrategies: string[];
    initialAllocation: AssetAllocation[];
    projectedAPY: number;
    projectedROI: number;
  };
  ranking: {
    currentParticipants: number;
    estimatedRank?: number;
    yourEstimatedRank?: number;
    topPerformers: Performer[];
  };
  rewards: {
    totalPoolSize: number;
    estimatedRewards: string;
    rewardsBreakdown: Reward[];
  };
  performance?: {
    history: any[];
    projectedValueInOneWeek: string;
    projectedValueInOneMonth: string;
    riskAssessment: any;
  };
  opportunities: DefiOpportunity[];
  chainComparison: {
    gasComparison: GasComparison[];
    speedComparison: SpeedComparison[];
    yieldComparison: YieldComparison[];
    advantages: string[];
  };
}

function determineStrategies(
  challengeType: ChallengeType,
  riskLevel: RiskLevel,
  specificStrategies?: string[]
): string[] {
  // If specific strategies are provided, use them
  if (specificStrategies && specificStrategies.length > 0) {
    return specificStrategies;
  }

  // Otherwise, determine strategies based on challenge type and risk level
  const strategies = [];

  switch (challengeType) {
    case "yield-farming":
      if (riskLevel === "low") {
        strategies.push("Staking MON", "Stable LP Provision");
      } else if (riskLevel === "medium") {
        strategies.push("Diversified Yield Farming", "Medium-Risk LPs");
      } else {
        strategies.push("High-APY Pools", "Leveraged Yield Farming");
      }
      break;

    case "trading":
      if (riskLevel === "low") {
        strategies.push("Swing Trading Majors", "Limit Order Strategy");
      } else if (riskLevel === "medium") {
        strategies.push("Momentum Trading", "Range Trading");
      } else {
        strategies.push("Scalping", "Breakout Trading");
      }
      break;

    case "liquidity-mining":
      if (riskLevel === "low") {
        strategies.push("Blue Chip Token Pairs", "Stablecoin Pairs");
      } else if (riskLevel === "medium") {
        strategies.push("Mid-Cap Token Pairs", "Incentivized Pools");
      } else {
        strategies.push("New Token Pairs", "High-Yield Incentivized Pools");
      }
      break;

    case "staking":
      if (riskLevel === "low") {
        strategies.push("Network Staking", "Governance Staking");
      } else if (riskLevel === "medium") {
        strategies.push("Protocol Staking", "DeFi Index Staking");
      } else {
        strategies.push("New Protocol Staking", "Locked Staking");
      }
      break;

    case "all":
      if (riskLevel === "low") {
        strategies.push("Diversified Low-Risk", "Balanced Portfolio");
      } else if (riskLevel === "medium") {
        strategies.push("Multi-Strategy Approach", "Rotating Strategies");
      } else {
        strategies.push("Maximum Yield Strategy", "Aggressive Portfolio");
      }
      break;
  }

  return strategies;
}

function calculateEntryFee(
  duration: Duration,
  initialInvestment: string | number
): number {
  const basePercentage = {
    daily: 0.5,
    weekly: 1.5,
    monthly: 3.0,
  }[duration];

  const amount = parseFloat(initialInvestment.toString());
  const percentage = basePercentage - (amount > 10 ? 0.5 : 0); // Reduction for large investments

  return Math.max(0.1, amount * (percentage / 100));
}

function generateSimulatedLeaderboard(
  challengeType: ChallengeType,
  duration: Duration
): Performer[] {
  const participantCount = {
    daily: 25 + Math.floor(Math.random() * 25),
    weekly: 50 + Math.floor(Math.random() * 50),
    monthly: 100 + Math.floor(Math.random() * 100),
  }[duration];

  const leaderboard: Performer[] = [];

  for (let i = 0; i < participantCount; i++) {
    const performance =
      i < participantCount * 0.1
        ? 15 + Math.random() * 25 // Top 10%
        : i < participantCount * 0.3
        ? 8 + Math.random() * 15 // Top 30%
        : i < participantCount * 0.6
        ? 3 + Math.random() * 8 // Top 60%
        : -5 + Math.random() * 10; // Bottom 40%

    leaderboard.push({
      rank: i + 1,
      username: `MonadUser_${Math.random().toString(36).substring(2, 7)}`,
      performance: parseFloat(performance.toFixed(2)),
      initialInvestment: (1 + Math.random() * 9).toFixed(2), // 1-10 MON
      strategy: randomElement(getStrategiesForType(challengeType)),
      rewardShare: 0, // Will be calculated later
    });
  }

  // Sort by performance
  leaderboard.sort((a, b) => b.performance - a.performance);

  // Update ranks
  leaderboard.forEach((participant, index) => {
    participant.rank = index + 1;

    // Calculate reward share for top participants
    if (index < 3) {
      participant.rewardShare = [50, 30, 15][index]; // Top 3: 50%, 30%, 15%
    } else if (index < 10) {
      participant.rewardShare = 5 / 7; // Next 7 share 5%
    } else {
      participant.rewardShare = 0;
    }
  });

  return leaderboard;
}

function getStrategiesForType(challengeType: ChallengeType): string[] {
  // Return possible strategies for each type of challenge
  switch (challengeType) {
    case "yield-farming":
      return [
        "Single Asset Lending",
        "Multi-Asset Lending",
        "Incentivized Pools",
        "Staking Derivatives",
      ];
    case "trading":
      return [
        "Swing Trading",
        "Scalping",
        "Position Trading",
        "Breakout Strategy",
        "Technical Analysis",
      ];
    case "liquidity-mining":
      return [
        "Stable Pairs",
        "High Volatility Pairs",
        "Incentivized Pools",
        "Protocol-Owned Liquidity",
      ];
    case "staking":
      return [
        "Network Staking",
        "Liquid Staking",
        "Governance Staking",
        "Protocol Staking",
      ];
    case "all":
      return [
        "Balanced Portfolio",
        "High-Risk High-Reward",
        "Conservative Growth",
        "Dollar Cost Averaging",
      ];
    default:
      return ["Diversified Strategy", "Focus Strategy", "Opportunistic"];
  }
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function calculatePotentialRewards(
  joinPool: boolean,
  initialInvestment: string | number,
  leaderboard: Array<{
    rank: number;
    username: string;
    performance: number;
    initialInvestment: string;
    strategy: any;
    rewardShare: number;
  }>
) {
  // Calculate potential rewards based on ranking and participation
  if (!joinPool) {
    return {
      estimatedRewards: "0",
      breakdown: [
        {
          position: "N/A",
          amount: "0",
          chance: "N/A",
        },
      ],
    };
  }

  // Estimate rewards pool size
  const poolSize = calculateTotalPoolSize(leaderboard, true, 0);

  // Calculate potential rewards for different positions
  const breakdown = [
    {
      position: "1st Place",
      amount: (poolSize * 0.5).toFixed(4),
      chance: "5%",
    },
    {
      position: "2nd Place",
      amount: (poolSize * 0.3).toFixed(4),
      chance: "10%",
    },
    {
      position: "3rd Place",
      amount: (poolSize * 0.15).toFixed(4),
      chance: "15%",
    },
    {
      position: "Top 10",
      amount: ((poolSize * 0.05) / 7).toFixed(4),
      chance: "30%",
    },
    { position: "Below Top 10", amount: "0", chance: "40%" },
  ];

  // Calculate expected rewards (weighted by probability)
  const expectedReward =
    parseFloat(breakdown[0].amount) * 0.05 +
    parseFloat(breakdown[1].amount) * 0.1 +
    parseFloat(breakdown[2].amount) * 0.15 +
    parseFloat(breakdown[3].amount) * 0.3;

  return {
    estimatedRewards: expectedReward.toFixed(4),
    breakdown,
  };
}

function projectPerformance(
  challengeType: ChallengeType,
  riskLevel: RiskLevel,
  duration: Duration,
  strategies: string[]
): {
  apy: number;
  expectedROI: number;
  volatility: string;
  estimatedAPY: number;
  estimatedROI: number;
  valueInOneWeek: string;
  valueInOneMonth: string;
  riskAssessment: {
    volatility: string;
    impermanentLoss: string;
    smartContractRisk: string;
    liquidityRisk: string;
  };
} {
  // Simulate performance projections based on parameters
  const baseAPY = {
    "yield-farming": { low: 5, medium: 15, high: 40 },
    trading: { low: 10, medium: 25, high: 60 },
    "liquidity-mining": { low: 8, medium: 20, high: 50 },
    staking: { low: 4, medium: 12, high: 30 },
    all: { low: 6, medium: 18, high: 45 },
  }[challengeType][riskLevel];

  // Add random variation
  const apy = baseAPY + (Math.random() * baseAPY * 0.4 - baseAPY * 0.2);

  // Calculate ROI based on duration
  const durationInDays = {
    daily: 1,
    weekly: 7,
    monthly: 30,
  }[duration];

  const dailyROI = apy / 365;
  const expectedROI = dailyROI * durationInDays;

  // Simulate other metrics based on risk level
  const volatilityRatings = {
    low: "Low",
    medium: "Moderate",
    high: "High",
  };

  const volatility = volatilityRatings[riskLevel];

  // These values would be calculated in a real system
  return {
    apy,
    expectedROI,
    volatility,
    estimatedAPY: apy,
    estimatedROI: expectedROI,
    valueInOneWeek: `${(1 + dailyROI * 7).toFixed(4)}x`,
    valueInOneMonth: `${(1 + dailyROI * 30).toFixed(4)}x`,
    riskAssessment: {
      volatility: `${volatility} (${
        riskLevel === "high" ? "7" : riskLevel === "medium" ? "4" : "2"
      }/10)`,
      impermanentLoss: getImpermanentLossRisk(challengeType, riskLevel),
      smartContractRisk: getSmartContractRisk(strategies),
      liquidityRisk: getLiquidityRisk(challengeType),
    },
  };
}

function getRiskRating(riskLevel: RiskLevel): string {
  return {
    low: "Low (3/10)",
    medium: "Moderate (6/10)",
    high: "High (8/10)",
  }[riskLevel];
}

function getImpermanentLossRisk(
  challengeType: ChallengeType,
  riskLevel: RiskLevel
): string {
  if (challengeType === "liquidity-mining") {
    return {
      low: "Low (2/10)",
      medium: "Moderate (5/10)",
      high: "High (8/10)",
    }[riskLevel];
  } else if (challengeType === "yield-farming") {
    return {
      low: "Very Low (1/10)",
      medium: "Low (3/10)",
      high: "Moderate (6/10)",
    }[riskLevel];
  } else {
    return "Minimal (0/10)";
  }
}

function getSmartContractRisk(strategies: string[]): string {
  if (
    strategies.some(
      (s: string) => s.includes("New") || s.includes("High-Yield")
    )
  ) {
    return "High (7/10)";
  } else if (
    strategies.some(
      (s: string) => s.includes("Protocol") || s.includes("Incentivized")
    )
  ) {
    return "Moderate (5/10)";
  } else {
    return "Low (3/10)";
  }
}

function getLiquidityRisk(challengeType: ChallengeType): string {
  switch (challengeType) {
    case "trading":
      return "Moderate (5/10)";
    case "liquidity-mining":
      return "High (7/10)";
    case "yield-farming":
      return "Moderate (4/10)";
    case "staking":
      return "Low (2/10)";
    default:
      return "Moderate (5/10)";
  }
}

function getActiveChallenges(duration: Duration) {
  // Simulate active community challenges
  const baseChallenges = [
    {
      name: "Yield Master Challenge",
      description: "Get the highest yield in farming",
      participants: 120,
      prize: "500 MON",
      endTime: addDays(new Date(), 7),
    },
    {
      name: "Diamond Hands",
      description: "Do not sell any assets during the challenge duration",
      participants: 85,
      prize: "300 MON",
      endTime: addDays(new Date(), 14),
    },
    {
      name: "DeFi Explorer",
      description: "Use at least 5 different DeFi protocols",
      participants: 65,
      prize: "250 MON",
      endTime: addDays(new Date(), 10),
    },
  ];

  const durationDays = { daily: 1, weekly: 7, monthly: 30 }[duration];

  return baseChallenges.filter(
    (challenge) =>
      Math.round(
        (challenge.endTime.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      ) <= durationDays
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function estimateRanking(
  initialInvestment: string | number,
  riskLevel: RiskLevel,
  leaderboard: Performer[]
) {
  // Estimate ranking based on initial investment and risk level
  const amount = parseFloat(initialInvestment.toString());

  // Factors affecting ranking
  const riskFactor = { low: 0.7, medium: 1.0, high: 1.3 }[riskLevel];
  const investmentFactor = Math.min(1.5, Math.max(0.8, amount / 5)); // 5 MON as reference

  // Combine factors to estimate percentile
  const percentile = Math.min(
    0.95,
    Math.max(0.05, riskFactor * investmentFactor * Math.random())
  );

  // Convert percentile to ranking
  const estimatedRank = Math.max(
    1,
    Math.floor((1 - percentile) * leaderboard.length) + 1
  );

  return estimatedRank;
}

function allocateAssets(
  challengeType: ChallengeType,
  riskLevel: RiskLevel,
  investmentAmount: bigint,
  strategies: string[]
) {
  // Simulate initial asset allocation
  const allocation = [];

  switch (challengeType) {
    case "yield-farming":
      if (riskLevel === "low") {
        allocation.push(
          {
            asset: "MON-USDC LP",
            percentage: 50,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(50)) / BigInt(100)
            ),
          },
          {
            asset: "USDC Lending",
            percentage: 30,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(30)) / BigInt(100)
            ),
          },
          {
            asset: "MON Staking",
            percentage: 20,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(20)) / BigInt(100)
            ),
          }
        );
      } else if (riskLevel === "medium") {
        allocation.push(
          {
            asset: "MON-ETH LP",
            percentage: 40,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(40)) / BigInt(100)
            ),
          },
          {
            asset: "ETH Lending",
            percentage: 30,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(30)) / BigInt(100)
            ),
          },
          {
            asset: "MONAD Farming",
            percentage: 30,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(30)) / BigInt(100)
            ),
          }
        );
      } else {
        allocation.push(
          {
            asset: "MON-ALT LP",
            percentage: 50,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(50)) / BigInt(100)
            ),
          },
          {
            asset: "High Yield Farm",
            percentage: 40,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(40)) / BigInt(100)
            ),
          },
          {
            asset: "New Protocol",
            percentage: 10,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(10)) / BigInt(100)
            ),
          }
        );
      }
      break;

    case "trading":
      if (riskLevel === "low") {
        allocation.push(
          {
            asset: "MON",
            percentage: 60,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(60)) / BigInt(100)
            ),
          },
          {
            asset: "ETH",
            percentage: 30,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(30)) / BigInt(100)
            ),
          },
          {
            asset: "USDC",
            percentage: 10,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(10)) / BigInt(100)
            ),
          }
        );
      } else if (riskLevel === "medium") {
        allocation.push(
          {
            asset: "MON",
            percentage: 40,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(40)) / BigInt(100)
            ),
          },
          {
            asset: "Mid-Cap Tokens",
            percentage: 40,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(40)) / BigInt(100)
            ),
          },
          {
            asset: "USDC",
            percentage: 20,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(20)) / BigInt(100)
            ),
          }
        );
      } else {
        allocation.push(
          {
            asset: "Small-Cap Tokens",
            percentage: 60,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(60)) / BigInt(100)
            ),
          },
          {
            asset: "MON",
            percentage: 30,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(30)) / BigInt(100)
            ),
          },
          {
            asset: "USDC",
            percentage: 10,
            amount: ethers.formatEther(
              (investmentAmount * BigInt(10)) / BigInt(100)
            ),
          }
        );
      }
      break;

    // Similar cases...
    default:
      allocation.push(
        {
          asset: "MON",
          percentage: 40,
          amount: ethers.formatEther(
            (investmentAmount * BigInt(40)) / BigInt(100)
          ),
        },
        {
          asset: "Stablecoins",
          percentage: 30,
          amount: ethers.formatEther(
            (investmentAmount * BigInt(30)) / BigInt(100)
          ),
        },
        {
          asset: "Other Assets",
          percentage: 30,
          amount: ethers.formatEther(
            (investmentAmount * BigInt(30)) / BigInt(100)
          ),
        }
      );
  }

  return allocation;
}

function visualizeLeaderboard(
  leaderboard: Performer[],
  username: string,
  estimatedRank: number
) {
  // Create textual visualization of the leaderboard
  let visualization = ``;

  visualization += `🏆 LEADERBOARD (${leaderboard.length} Participants) 🏆\n\n`;
  visualization += `┌───────┬─────────────────────┬────────────┬──────────────┐\n`;
  visualization += `│ RANK  │ USERNAME            │ PERFORMANCE │   STRATEGY   │\n`;
  visualization += `├───────┼─────────────────────┼────────────┼──────────────┤\n`;

  // Display top 5
  for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
    const entry = leaderboard[i];
    visualization += `│ ${entry.rank
      .toString()
      .padStart(5)} │ ${entry.username.padEnd(19)} │ ${
      (entry.performance > 0 ? "+" : "") +
      entry.performance.toFixed(2) +
      "%".padStart(10)
    } │ ${entry.strategy.substring(0, 12).padEnd(12)} │\n`;
  }

  // Add separator lines if necessary
  if (estimatedRank > 5 && estimatedRank < leaderboard.length - 4) {
    visualization += `├───────┼─────────────────────┼────────────┼──────────────┤\n`;
    visualization += `│       │         ...         │            │              │\n`;
  }

  // Add current user if their rank is estimated between 6 and length-5
  if (estimatedRank > 5 && estimatedRank < leaderboard.length - 4) {
    visualization += `├───────┼─────────────────────┼────────────┼──────────────┤\n`;
    visualization += `│ ${estimatedRank
      .toString()
      .padStart(5)} │ ${username.padEnd(19)} │ ${"??.??%".padStart(
      10
    )} │ ${"Your Strategy".padEnd(12)} │\n`;
  }

  // Add separator lines if necessary
  if (estimatedRank > 5 && estimatedRank < leaderboard.length - 4) {
    visualization += `├───────┼─────────────────────┼────────────┼──────────────┤\n`;
    visualization += `│       │         ...         │            │              │\n`;
  }

  // Display last 5 if leaderboard is large enough
  if (leaderboard.length > 10) {
    visualization += `├───────┼─────────────────────┼────────────┼──────────────┤\n`;

    for (
      let i = Math.max(5, leaderboard.length - 5);
      i < leaderboard.length;
      i++
    ) {
      const entry = leaderboard[i];
      visualization += `│ ${entry.rank
        .toString()
        .padStart(5)} │ ${entry.username.padEnd(19)} │ ${
        (entry.performance > 0 ? "+" : "") +
        entry.performance.toFixed(2) +
        "%".padStart(10)
      } │ ${entry.strategy.substring(0, 12).padEnd(12)} │\n`;
    }
  }

  visualization += `└───────┴─────────────────────┴────────────┴──────────────┘\n`;

  return visualization;
}

function generatePerformanceHistory(duration: Duration) {
  // Generate a fictional performance history
  const durationDays = { daily: 1, weekly: 7, monthly: 30 }[duration];
  const history = [];

  // Generate more points for longer durations
  const pointCount = durationDays === 1 ? 24 : durationDays;
  let cumulativePerformance = 0;

  for (let i = 0; i < pointCount; i++) {
    // Calculate timestamp
    const timestamp = new Date();
    if (durationDays === 1) {
      // Hourly history for the day
      timestamp.setHours(timestamp.getHours() - (pointCount - i));
    } else {
      // Daily history for week/month
      timestamp.setDate(timestamp.getDate() - (pointCount - i));
    }

    // Simulate performance change with some volatility
    const change = (Math.random() * 3 - 1) * (durationDays === 1 ? 0.2 : 0.8);
    cumulativePerformance += change;

    history.push({
      timestamp: timestamp.toISOString(),
      performance: cumulativePerformance.toFixed(2),
      change: change.toFixed(2),
    });
  }

  return history;
}

function identifyDefiOpportunities(
  challengeType: ChallengeType,
  riskLevel: RiskLevel
) {
  // Identify the best DeFi opportunities on Monad testnet
  const opportunities = [];

  // Base opportunities based on challenge type
  switch (challengeType) {
    case "yield-farming":
      opportunities.push(
        {
          name: "Monad Lending",
          apy: "8-12%",
          risk: "Low",
          tvl: "$2.5M",
          type: "Lending",
        },
        {
          name: "MON Staking",
          apy: "10-15%",
          risk: "Low",
          tvl: "$5M",
          type: "Staking",
        },
        {
          name: "Yield Aggregator",
          apy: "15-25%",
          risk: "Medium",
          tvl: "$1.8M",
          type: "Aggregator",
        }
      );
      break;

    case "trading":
      opportunities.push(
        {
          name: "MonDEX",
          apy: "Variable",
          risk: "Medium",
          tvl: "$3.2M",
          type: "DEX",
        },
        {
          name: "MonadSwap",
          apy: "Variable",
          risk: "Medium",
          tvl: "$2.8M",
          type: "AMM",
        },
        {
          name: "Futures DEX",
          apy: "High",
          risk: "High",
          tvl: "$1.5M",
          type: "Derivatives",
        }
      );
      break;

    case "liquidity-mining":
      opportunities.push(
        {
          name: "MON-USDC Pool",
          apy: "18-25%",
          risk: "Low",
          tvl: "$2.2M",
          type: "Liquidity Pool",
        },
        {
          name: "MON-ETH Pool",
          apy: "20-30%",
          risk: "Medium",
          tvl: "$1.8M",
          type: "Liquidity Pool",
        },
        {
          name: "New Token Pool",
          apy: "40-100%",
          risk: "High",
          tvl: "$0.5M",
          type: "Incentivized Pool",
        }
      );
      break;

    case "staking":
      opportunities.push(
        {
          name: "MON Validators",
          apy: "8-12%",
          risk: "Low",
          tvl: "$4.5M",
          type: "Network Staking",
        },
        {
          name: "Liquid Staking",
          apy: "9-14%",
          risk: "Low-Medium",
          tvl: "$2.5M",
          type: "Liquid Staking",
        },
        {
          name: "Governance Staking",
          apy: "10-20%",
          risk: "Medium",
          tvl: "$1.2M",
          type: "Governance",
        }
      );
      break;

    default:
      opportunities.push(
        {
          name: "MON Staking",
          apy: "8-12%",
          risk: "Low",
          tvl: "$4.5M",
          type: "Network Staking",
        },
        {
          name: "MON-USDC Pool",
          apy: "18-25%",
          risk: "Low",
          tvl: "$2.2M",
          type: "Liquidity Pool",
        },
        {
          name: "Yield Optimizer",
          apy: "15-25%",
          risk: "Medium",
          tvl: "$1.8M",
          type: "Yield Farming",
        }
      );
  }

  // Filter based on risk level
  const riskToLevel = { low: 1, medium: 2, high: 3 };
  const riskLevel_num = riskToLevel[riskLevel];

  // Add some additional opportunities based on risk level
  if (riskLevel_num >= 2) {
    opportunities.push(
      {
        name: "Leveraged Farming",
        apy: "30-60%",
        risk: "High",
        tvl: "$0.8M",
        type: "Leveraged",
      },
      {
        name: "Options Strategy",
        apy: "25-40%",
        risk: "High",
        tvl: "$0.6M",
        type: "Options",
      }
    );
  }

  if (riskLevel_num >= 3) {
    opportunities.push(
      {
        name: "New Protocol Farm",
        apy: "50-150%",
        risk: "Very High",
        tvl: "$0.3M",
        type: "New Farm",
      },
      {
        name: "Exotic Derivatives",
        apy: "40-100%",
        risk: "Very High",
        tvl: "$0.4M",
        type: "Exotic",
      }
    );
  }

  return opportunities;
}

function compareWithOtherChains(
  challengeType: ChallengeType,
  strategies: string[]
) {
  // Compare Monad advantages against popular other chains
  return {
    gasComparison: [
      { chain: "Ethereum", avgGasFee: "$15-30", monadSavings: "99%" },
      { chain: "Arbitrum", avgGasFee: "$0.30-1.00", monadSavings: "90%" },
      { chain: "Polygon", avgGasFee: "$0.10-0.30", monadSavings: "80%" },
      { chain: "Optimism", avgGasFee: "$0.20-0.80", monadSavings: "85%" },
    ],
    speedComparison: [
      {
        chain: "Ethereum",
        blockTime: "12s",
        finality: "~3 min",
        monadSpeedup: "100x",
      },
      {
        chain: "Arbitrum",
        blockTime: "250ms",
        finality: "~10 min",
        monadSpeedup: "20x",
      },
      {
        chain: "Polygon",
        blockTime: "2s",
        finality: "~30 min",
        monadSpeedup: "60x",
      },
      {
        chain: "Optimism",
        blockTime: "2s",
        finality: "~10 min",
        monadSpeedup: "20x",
      },
    ],
    yieldComparison: [
      {
        strategy: strategies[0],
        ethereum: "10-15%",
        polygon: "15-20%",
        arbitrum: "15-25%",
        monad: "20-30%",
      },
      {
        strategy: strategies[1] || "Alternative",
        ethereum: "5-10%",
        polygon: "10-15%",
        arbitrum: "10-20%",
        monad: "15-25%",
      },
    ],
    advantages: [
      "Transaction speed 10-100x faster than other chains",
      "Transaction fees up to 99% cheaper than Ethereum",
      "Higher DeFi yields thanks to protocol incentives",
      "Better liquidity conditions in main pools",
      "Faster user experience thanks to quasi-instant finality",
    ],
  };
}

function calculateTotalPoolSize(
  leaderboard: Performer[],
  joinPool: boolean,
  entryFee: number | string
) {
  if (!joinPool) return 0;

  const basePool = 100 + Math.floor(leaderboard.length * 2);
  const entryFees = leaderboard.length * 0.02;

  return basePool + entryFees;
}

function calculateEndDate(duration: Duration) {
  const endDate = new Date();

  switch (duration) {
    case "daily":
      endDate.setDate(endDate.getDate() + 1);
      break;
    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;
    case "monthly":
      endDate.setDate(endDate.getDate() + 30);
      break;
  }

  return endDate.toISOString();
}

function formatChallengeOutput(
  challengeSummary: ChallengeSummary,
  leaderboardVisualization: string
) {
  // Format challenge results for display
  let output = `# 🏆 Monad DeFi Challenge - ${challengeSummary.challenge.type.toUpperCase()} 🏆\n\n`;

  // Participant information
  output += `## 👤 Participant\n\n`;
  output += `- **Username**: ${challengeSummary.participant.username}\n`;
  output += `- **Wallet**: ${challengeSummary.participant.wallet}\n`;
  output += `- **Team**: ${challengeSummary.participant.team}\n\n`;

  // Challenge details
  output += `## 🎯 Challenge Details\n\n`;
  output += `- **Type**: ${challengeSummary.challenge.type}\n`;
  output += `- **Duration**: ${challengeSummary.challenge.duration}\n`;
  output += `- **Risk Level**: ${challengeSummary.challenge.riskLevel}\n`;
  output += `- **Start Date**: ${new Date(
    challengeSummary.challenge.startedAt
  ).toLocaleString()}\n`;
  output += `- **End Date**: ${new Date(
    challengeSummary.challenge.endsAt
  ).toLocaleString()}\n`;
  output += `- **Initial Investment**: ${challengeSummary.challenge.initialInvestment} MON\n`;
  output += `- **Rewards Pool**: ${
    challengeSummary.challenge.joinedRewardsPool ? "Yes" : "No"
  }\n`;
  if (challengeSummary.challenge.joinedRewardsPool) {
    output += `- **Entry Fee**: ${challengeSummary.challenge.entryFee} MON\n`;
  }
  output += `- **Auto-Rebalancing**: ${
    challengeSummary.challenge.autoRebalancing ? "Enabled" : "Disabled"
  }\n\n`;

  // Strategy
  output += `## 📊 Strategy\n\n`;
  output += `- **Selected Strategies**: ${challengeSummary.strategy.selectedStrategies.join(
    ", "
  )}\n`;
  output += `- **Projected APY**: ${challengeSummary.strategy.projectedAPY}\n`;
  output += `- **Projected ROI**: ${challengeSummary.strategy.projectedROI}\n\n`;

  // Initial allocation
  output += `### Initial Allocation\n\n`;
  output += `| Asset | Percentage | Amount |\n`;
  output += `|-------|------------|--------|\n`;
  challengeSummary.strategy.initialAllocation.forEach(
    (alloc: AssetAllocation) => {
      output += `| ${alloc.asset} | ${alloc.percentage}% | ${alloc.amount} MON |\n`;
    }
  );
  output += `\n`;

  // Leaderboard
  output += `## 🏆 Leaderboard\n\n`;
  output += `\`\`\`\n${leaderboardVisualization}\`\`\`\n\n`;
  output += `- **Current Participants**: ${challengeSummary.ranking.currentParticipants}\n`;
  output += `- **Your Estimated Rank**: ${challengeSummary.ranking.estimatedRank}\n\n`;

  // Top performers
  output += `### Top Performers\n\n`;
  output += `| Rank | Username | Performance | Strategy |\n`;
  output += `|------|----------|-------------|----------|\n`;
  challengeSummary.ranking.topPerformers.forEach((performer: Performer) => {
    output += `| ${performer.rank} | ${performer.username} | ${
      (performer.performance > 0 ? "+" : "") + performer.performance
    }% | ${performer.strategy} |\n`;
  });

  // Rewards breakdown
  output += `## Rewards Breakdown\n\n`;
  output += `| Position | Amount | Chance |\n`;
  output += `|----------|--------|--------|\n`;
  challengeSummary.rewards.rewardsBreakdown.forEach((reward: Reward) => {
    output += `| ${reward.position} | ${reward.amount} MON | ${reward.chance} |\n`;
  });
  output += `\n`;

  // DeFi opportunities
  output += `## DeFi Opportunities on Monad\n\n`;
  output += `| Protocol | APY | Risk | TVL | Type |\n`;
  output += `|----------|-----|------|-----|------|\n`;
  challengeSummary.opportunities.forEach((opportunity: DefiOpportunity) => {
    output += `| ${opportunity.name} | ${opportunity.apy} | ${opportunity.risk} | ${opportunity.tvl} | ${opportunity.type} |\n`;
  });
  output += `\n`;

  // Chain comparison - Gas fees
  output += `## Cross-Chain Gas Comparison\n\n`;
  output += `| Chain | Avg Gas Fee | Monad Savings |\n`;
  output += `|-------|-------------|---------------|\n`;
  challengeSummary.chainComparison.gasComparison.forEach(
    (comparison: GasComparison) => {
      output += `| ${comparison.chain} | ${comparison.avgGasFee} | ${comparison.monadSavings} |\n`;
    }
  );
  output += `\n`;

  // Chain comparison - Speed
  output += `| Chain | Block Time | Finality | Monad Speedup |\n`;
  output += `|-------|------------|----------|---------------|\n`;
  challengeSummary.chainComparison.speedComparison.forEach(
    (comparison: SpeedComparison) => {
      output += `| ${comparison.chain} | ${comparison.blockTime} | ${comparison.finality} | ${comparison.monadSpeedup} |\n`;
    }
  );
  output += `\n`;

  output += `| Strategy | Ethereum | Polygon | Arbitrum | Monad |\n`;
  output += `|----------|----------|---------|----------|-------|\n`;
  challengeSummary.chainComparison.yieldComparison.forEach(
    (comparison: YieldComparison) => {
      output += `| ${comparison.strategy} | ${comparison.ethereum} | ${comparison.polygon} | ${comparison.arbitrum} | ${comparison.monad} |\n`;
    }
  );
  output += `\n`;

  output += `### Monad Advantages\n\n`;
  challengeSummary.chainComparison.advantages.forEach((advantage: string) => {
    output += `- ${advantage}\n`;
  });
  output += `\n`;

  output += `## 🏁 Next Steps\n\n`;
  output += `1. **Monitor your performance** in the DeFi Challenge dashboard\n`;
  output += `2. **Adjust your strategy** as market conditions change\n`;
  output += `3. **Invite friends** to join the challenge and compete with you\n`;
  output += `4. **Share your results** on social media with hashtag #MonadDeFiChallenge\n\n`;

  output += `Good luck on your DeFi journey on Monad! 🚀`;

  return output;
}

// Utility function to generate a performance ASCII graph
function generatePerformanceASCIIGraph(
  performanceData: Array<{ timestamp: string; value: number }>
) {
  const height = 10;
  const width = 50;

  // Extract values
  const values = performanceData.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Initialize graph with spaces
  const graph = Array(height)
    .fill(null)
    .map(() => Array(width).fill(" "));

  // Fill graph with performance data
  performanceData.forEach((point, i) => {
    const x = Math.floor((i / performanceData.length) * width);
    const normalizedValue = (point.value - min) / range;
    const y = height - 1 - Math.floor(normalizedValue * (height - 1));

    if (y >= 0 && y < height && x >= 0 && x < width) {
      graph[y][x] = "█";
    }
  });

  // Add baseline at 100% (initial value)
  const baselineY =
    height - 1 - Math.floor(((100 - min) / range) * (height - 1));
  if (baselineY >= 0 && baselineY < height) {
    for (let x = 0; x < width; x++) {
      if (graph[baselineY][x] === " ") {
        graph[baselineY][x] = "·";
      }
    }
  }

  // Convert to string
  const graphStr = graph.map((row) => row.join("")).join("\n");

  // Add labels
  const result = `${max.toFixed(1)}% ┌${"─".repeat(
    width
  )}┐\n${graphStr}\n${min.toFixed(1)}% └${"─".repeat(width)}┘`;

  return result;
}
