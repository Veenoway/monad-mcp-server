import { ethers } from "ethers";

// Types pour le challenge DeFi
export type ChallengeType =
  | "yield-farming"
  | "trading"
  | "liquidity-mining"
  | "staking"
  | "all";

export type RiskLevel = "low" | "medium" | "high";
export type Duration = "daily" | "weekly" | "monthly";

export interface GasComparison {
  chain: string;
  avgGasFee: string;
  monadSavings: string;
}

export interface SpeedComparison {
  chain: string;
  blockTime: string;
  finality: string;
  monadSpeedup: string;
}

export interface YieldComparison {
  strategy: string;
  ethereum: string;
  polygon: string;
  arbitrum: string;
  monad: string;
}

export interface AssetAllocation {
  asset: string;
  percentage: number;
  amount: string;
}

export interface Performer {
  rank: number;
  username: string;
  performance: number;
  initialInvestment: string;
  strategy: string;
  rewardShare: number;
}

export interface Reward {
  position: string;
  amount: string;
  chance: string;
}

export interface DefiOpportunity {
  name: string;
  apy: string;
  risk: string;
  tvl: string;
  type: string;
}

export interface ChallengeSummary {
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

// Types pour l'agent trader AI
export interface IERC20 extends ethers.BaseContract {
  approve(
    spender: string,
    amount: bigint | string
  ): Promise<ethers.ContractTransaction>;
  balanceOf(account: string): Promise<bigint>;
  transfer(
    to: string,
    amount: bigint | string
  ): Promise<ethers.ContractTransaction>;
  allowance(owner: string, spender: string): Promise<bigint>;
}

export interface IUniswapRouter extends ethers.BaseContract {
  swapExactTokensForTokens(
    amountIn: bigint | string,
    amountOutMin: bigint | string,
    path: string[],
    to: string,
    deadline: number,
    options?: any
  ): Promise<ethers.ContractTransaction>;

  swapExactETHForTokens(
    amountOutMin: bigint | string,
    path: string[],
    to: string,
    deadline: number,
    options?: any
  ): Promise<ethers.ContractTransaction>;

  swapExactTokensForETH(
    amountIn: bigint | string,
    amountOutMin: bigint | string,
    path: string[],
    to: string,
    deadline: number,
    options?: any
  ): Promise<ethers.ContractTransaction>;
}

export interface TraderTransaction {
  txHash: string;
  timestamp: string;
  action: string;
  amount: string | number;
  price: number | string;
  gasUsed: string;
  profit: string;
  status: string;
}

export interface TransactionReceiptResponse {
  blockNumber?: number;
  hash?: string;
  gasUsed?: bigint;
  status?: number;
}

// Types de résultats pour l'agent trader
export type AITraderRiskLevel = "conservative" | "moderate" | "aggressive";

export interface CreateResult {
  success: boolean;
  agentId: string;
  message: string;
  address: string;
  status: string;
  initialCapital: number;
  riskLevel: AITraderRiskLevel;
  initialTrade?: {
    success: boolean;
    action: string;
    amount: number;
    txHash: string;
  };
}

export interface StartResult {
  success: boolean;
  agentId: string;
  action: string;
  amount?: number;
  confidence?: number;
  txHash: string | null;
  message: string;
  indicators?: any;
}

export interface StopResult {
  success: boolean;
  agentId: string;
  message: string;
  status: string;
}

export interface ImproveResult {
  success: boolean;
  agentId: string;
  message: string;
  metrics?: {
    successRate: number;
    averageProfit: number;
    sharpeRatio: number;
    iterations: number;
  };
  newParams?: any;
}

export interface StatusResult {
  success: boolean;
  agentId: string;
  address: string;
  balance: string;
  status: string;
  transactions: number;
  riskLevel: AITraderRiskLevel;
  learningMetrics: any;
  strategyParams: any;
  lastImprovement: string;
}
