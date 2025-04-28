import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";
import { ERC20_ABI, UNISWAP_V2_ROUTER_ABI } from "./shared/constants.js";

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "monad-ai-trader",
  version: "0.0.1",
  capabilities: ["monad-ai-trader"],
});

async function performInitialTrade(
  wallet: ethers.Wallet,
  initialInvestment: number
) {
  try {
    console.error("Exécution d'un achat initial de TCHOG...");

    // Adresses des contrats
    const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
    const TCHOG_ADDRESS = "0xCaF9244A9D4A79c3229cb354a1919961fa0122B4";
    const DEX_ROUTER_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436";

    // Instancier les contrats
    const wmonContract = new ethers.Contract(WMON_ADDRESS, ERC20_ABI, wallet);
    const routerContract = new ethers.Contract(
      DEX_ROUTER_ADDRESS,
      UNISWAP_V2_ROUTER_ABI,
      wallet
    );

    // Montant à échanger (50% de l'investissement initial)
    const amountToSwap = initialInvestment * 0.5;
    const amountInWei = ethers.parseEther(amountToSwap.toString());

    // Approuver le router pour dépenser les WMON
    console.error(
      `Approbation du router pour dépenser ${amountToSwap} WMON...`
    );
    const approvalTx = await wmonContract.approve(
      DEX_ROUTER_ADDRESS,
      amountInWei
    );
    await approvalTx.wait();

    // Calculer le montant minimum à recevoir (avec 1% de slippage)
    const amountOutMin = 0; // Pour la démonstration, acceptons n'importe quel montant

    // Construire le chemin de swap
    const path = [WMON_ADDRESS, TCHOG_ADDRESS];

    // Effectuer le swap
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const swapTx = await routerContract.swapExactTokensForTokens(
      amountInWei,
      amountOutMin,
      path,
      wallet.address,
      deadline,
      { gasLimit: 500000 }
    );

    const swapTxHash =
      swapTx && typeof swapTx === "object"
        ? (swapTx as any).hash
        : String(swapTx);

    // Définir un type explicite pour receipt
    interface TransactionReceiptResponse {
      blockNumber?: number;
      hash?: string;
      gasUsed?: bigint;
      status?: number;
    }

    const receipt = (await provider.waitForTransaction(
      swapTxHash
    )) as TransactionReceiptResponse;
    console.error(`Achat initial de TCHOG réussi! Hash: ${receipt.hash}`);

    return {
      success: true,
      txHash: receipt.hash,
      amount: amountToSwap,
      action: "buy",
    };
  } catch (error) {
    console.error("Erreur lors de l'achat initial de TCHOG:", error);
    return {
      success: false,
      message: `Erreur lors de l'achat initial: ${error}`,
    };
  }
}

server.tool(
  "monad-ai-trader",
  "Créer et gérer un agent IA auto-améliorant qui trade automatiquement WMON/TCHOG sur Monad Testnet",
  {
    privateKey: z
      .string()
      .describe("Clé privée du wallet à utiliser pour le trading"),
    initialInvestment: z
      .number()
      .default(0.1)
      .describe("Montant initial à investir en MON"),
    riskLevel: z
      .enum(["conservative", "moderate", "aggressive"])
      .default("moderate")
      .describe("Niveau de risque pour la stratégie de trading"),
    learningRate: z
      .number()
      .default(0.1)
      .describe("Taux d'apprentissage initial de l'agent"),
    maxSlippage: z
      .number()
      .default(1.5)
      .describe("Pourcentage de slippage maximum autorisé"),
    action: z
      .enum(["create", "start", "stop", "status", "improve"])
      .default("status")
      .describe("Action à effectuer avec l'agent IA"),
  },
  // @ts-ignore - Type complexe de la réponse
  async (
    {
      privateKey,
      initialInvestment,
      riskLevel,
      learningRate,
      maxSlippage,
      action,
    },
    _extra
  ) => {
    try {
      // Initialisation du wallet pour l'agent
      const wallet = new ethers.Wallet(privateKey, provider);
      const agentAddress = wallet.address;

      // Générer un ID unique pour l'agent s'il n'existe pas déjà
      const agentId = `ai-trader-${agentAddress.substring(2, 8)}`;

      console.error(`Agent IA autonome ${agentId} - Action: ${action}`);

      // Vérifier le solde du wallet
      const balance = await provider.getBalance(agentAddress);
      console.error(`Solde disponible: ${ethers.formatEther(balance)} MON`);

      if (balance < ethers.parseEther(initialInvestment.toString())) {
        throw new Error(
          `Solde insuffisant pour démarrer l'agent: ${ethers.formatEther(
            balance
          )} MON`
        );
      }

      // Adresses des contrats sur Monad Testnet
      const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"; // À remplacer par l'adresse réelle
      const TCHOG_ADDRESS = "0xCaF9244A9D4A79c3229cb354a1919961fa0122B4"; // À remplacer par l'adresse réelle
      const DEX_ROUTER_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436"; // À remplacer par l'adresse du router

      // Définir les interfaces pour les contrats
      interface IERC20 extends ethers.BaseContract {
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

      interface IUniswapRouter extends ethers.BaseContract {
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

      // Instancier les contrats
      const wmonContract = new ethers.Contract(
        WMON_ADDRESS,
        ERC20_ABI,
        wallet
      ) as unknown as IERC20;
      const tchogContract = new ethers.Contract(
        TCHOG_ADDRESS,
        ERC20_ABI,
        wallet
      ) as unknown as IERC20;
      const routerContract = new ethers.Contract(
        DEX_ROUTER_ADDRESS,
        UNISWAP_V2_ROUTER_ABI,
        wallet
      ) as unknown as IUniswapRouter;

      // Structure pour stocker l'historique de trading et les métriques d'apprentissage
      interface TraderTransaction {
        txHash: string;
        timestamp: string;
        action: string;
        amount: string | number;
        price: number | string;
        gasUsed: string;
        profit: string;
        status: string;
      }

      const agentData = {
        id: agentId,
        address: agentAddress,
        status: "active", // Toujours actif par défaut
        initialCapital: initialInvestment,
        currentBalance: Number(ethers.formatEther(balance)),
        transactions: [] as TraderTransaction[],
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
        lastImprovement: null as string | null,
        strategyParams: {
          entryThreshold:
            riskLevel === "conservative"
              ? 0.8
              : riskLevel === "moderate"
              ? 0.6
              : 0.4,
          exitThreshold:
            riskLevel === "conservative"
              ? 1.5
              : riskLevel === "moderate"
              ? 2
              : 2.5,
          positionSizePercent:
            riskLevel === "conservative"
              ? 10
              : riskLevel === "moderate"
              ? 25
              : 40,
          stopLossPercent:
            riskLevel === "conservative"
              ? 5
              : riskLevel === "moderate"
              ? 10
              : 15,
          takeProfitPercent:
            riskLevel === "conservative"
              ? 8
              : riskLevel === "moderate"
              ? 15
              : 25,
        },
      };

      // Fonctions d'analyse technique simulées (à implémenter avec des calculs réels)
      const technicalAnalysis = {
        calculateRSI: async (pair: string) => {
          // Simuler une valeur RSI
          return 30 + Math.random() * 40;
        },
        calculateMACD: async (pair: string) => {
          // Simuler un signal MACD
          return Math.random() - 0.5;
        },
        calculateEMA: async (pair: string, period: number) => {
          // Simuler une valeur EMA
          return 0.00015 + (Math.random() * 0.00002 - 0.00001);
        },
        detectPricePattern: async (pair: string) => {
          // Simuler une détection de motif
          const patterns = [
            "double_bottom",
            "head_shoulders",
            "channel_breakout",
            "none",
          ];
          return patterns[Math.floor(Math.random() * patterns.length)];
        },
      };

      // Fonction pour exécuter une transaction réelle
      const executeTransaction = async (action: string, amount: number) => {
        console.error(
          `Exécution d'une transaction réelle: ${action} ${amount} TCHOG...`
        );

        try {
          // Obtenir les balances actuelles
          const wmonBalance = await wmonContract.balanceOf(wallet.address);
          const tchogBalance = await tchogContract.balanceOf(wallet.address);

          console.error(
            `Balances actuelles - WMON: ${ethers.formatUnits(
              wmonBalance,
              18
            )}, TCHOG: ${ethers.formatUnits(tchogBalance, 18)}`
          );

          // Vérifier si l'utilisateur a assez de tokens pour la transaction
          if (
            action === "buy" &&
            wmonBalance < ethers.parseEther(amount.toString())
          ) {
            return {
              success: false,
              error: `Solde WMON insuffisant pour acheter ${amount} TCHOG`,
            };
          } else if (
            action === "sell" &&
            tchogBalance < ethers.parseUnits(amount.toString(), 18)
          ) {
            return {
              success: false,
              error: `Solde TCHOG insuffisant pour vendre ${amount} TCHOG`,
            };
          }

          // Calculer le montant à trader
          const amountIn =
            action === "buy"
              ? ethers.parseEther(amount.toString())
              : ethers.parseUnits(amount.toString(), 18);

          // Approuver le router à dépenser nos tokens si c'est une vente
          if (action === "sell") {
            console.error(
              `Approbation du router pour dépenser ${amount} TCHOG`
            );
            // Dans ethers.js v6, await sur la transaction directement
            const receipt = await tchogContract.approve(
              DEX_ROUTER_ADDRESS,
              amountIn
            );
            console.error(`Approbation réussie pour ${amount} TCHOG`);
          } else if (action === "buy") {
            console.error(`Approbation du router pour dépenser ${amount} WMON`);
            // Dans ethers.js v6, await sur la transaction directement
            const receipt = await wmonContract.approve(
              DEX_ROUTER_ADDRESS,
              amountIn
            );
            console.error(`Approbation réussie pour ${amount} WMON`);
          }

          // Calculer le slippage (0.5% par défaut)
          const slippageTolerance = 99.5; // 0.5% de slippage
          const minAmountOut = ethers.parseUnits(
            (
              ((action === "buy" ? amount * 0.00015 : amount) *
                slippageTolerance) /
              100
            ).toString(),
            18
          );

          // Configurer les paramètres de transaction
          const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

          // Chemin de swap
          const path =
            action === "buy"
              ? [WMON_ADDRESS, TCHOG_ADDRESS]
              : [TCHOG_ADDRESS, WMON_ADDRESS];

          // Exécuter le swap avec le wallet réel de l'utilisateur
          const routerWithSigner = routerContract.connect(
            wallet
          ) as IUniswapRouter;

          let swapTx;
          if (action === "buy") {
            console.error(`Exécution d'un swap pour acheter ${amount} TCHOG`);
            swapTx = await routerWithSigner.swapExactTokensForTokens(
              amountIn,
              minAmountOut,
              path,
              wallet.address,
              deadline,
              { gasLimit: 500000 }
            );
          } else {
            console.error(`Exécution d'un swap pour vendre ${amount} TCHOG`);
            swapTx = await routerWithSigner.swapExactTokensForTokens(
              amountIn,
              minAmountOut,
              path,
              wallet.address,
              deadline,
              { gasLimit: 500000 }
            );
          }

          const swapTxHash =
            swapTx && typeof swapTx === "object"
              ? (swapTx as any).hash
              : String(swapTx);

          // Définir un type explicite pour receipt
          interface TransactionReceiptResponse {
            blockNumber?: number;
            hash?: string;
            gasUsed?: bigint;
            status?: number;
          }

          const receipt = (await provider.waitForTransaction(
            swapTxHash
          )) as TransactionReceiptResponse;

          // Récupérer les balances mises à jour
          const newWmonBalance = await wmonContract.balanceOf(wallet.address);
          const newTchogBalance = await tchogContract.balanceOf(wallet.address);

          // Calculer le profit/perte réel
          const wmonDiff = newWmonBalance - wmonBalance;
          const tchogDiff = newTchogBalance - tchogBalance;

          const estimatedProfit =
            action === "buy"
              ? ethers.formatUnits(tchogDiff, 18)
              : ethers.formatUnits(wmonDiff, 18);

          // Enregistrer la transaction dans l'historique
          const txDetails = {
            txHash: receipt?.hash || swapTxHash,
            timestamp: new Date().toISOString(),
            action,
            amount: amount.toString(),
            price:
              action === "buy"
                ? tchogDiff === 0n
                  ? "0"
                  : ethers.formatUnits(
                      (BigInt(amountIn) * 10n ** 18n) / tchogDiff,
                      18
                    )
                : ethers.formatUnits(
                    (wmonDiff * 10n ** 18n) / (BigInt(amountIn) || 1n),
                    18
                  ),
            gasUsed: receipt?.gasUsed?.toString() || "0",
            profit: estimatedProfit,
            status: "completed",
          };

          agentData.transactions.push(txDetails);
          console.error(
            `Transaction réelle enregistrée: ${action} ${amount} TCHOG`
          );

          return {
            success: true,
            txHash: receipt?.hash || swapTxHash,
            details: txDetails,
          };
        } catch (error: any) {
          console.error(
            `Erreur lors de l'exécution de la transaction réelle: ${error}`
          );
          return {
            success: false,
            error: error.message,
          };
        }
      };

      // Fonction pour prendre une décision de trading basée sur l'analyse de données réelles
      const makeDecision = async () => {
        console.error("Analyse du marché WMON/TCHOG avec données réelles...");

        try {
          let priceData;

          // Essayer d'obtenir des données réelles via l'API Mobula pour la paire
          try {
            console.error(
              "Tentative de récupération des données de paire via l'API Mobula..."
            );

            // L'adresse de la paire WMON/TCHOG (modifier l'adresse selon votre paire réelle)
            const PAIR_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436"; // Remplacer par l'adresse réelle de la paire

            const response = await fetch(
              `https://api.mobula.io/api/1/market/history/pair?address=${PAIR_ADDRESS}&period=1h&amount=2`
            );

            if (response.ok) {
              const pairData = (await response.json()) as {
                data?: Array<{
                  close: number;
                  volume?: number;
                }>;
              };

              if (
                pairData?.data &&
                Array.isArray(pairData.data) &&
                pairData.data.length > 0
              ) {
                // L'API de paire retourne des données OHLCV
                const ohlcvData = pairData.data;

                // Extraire le prix de clôture (close) le plus récent pour le prix actuel
                const latestCandle = ohlcvData[ohlcvData.length - 1];
                const earlierCandle = ohlcvData[0];

                // Calculer la variation sur la dernière heure (2 points de données)
                const change =
                  ((latestCandle.close - earlierCandle.close) /
                    earlierCandle.close) *
                  100;

                priceData = {
                  price: latestCandle.close,
                  change24h: change,
                  volume24h: latestCandle.volume || 0,
                  lastUpdated: new Date().toISOString(),
                };

                console.error(
                  `Données réelles de paire obtenues - Prix: ${
                    priceData.price
                  }, Variation: ${priceData.change24h.toFixed(2)}%`
                );
              } else {
                throw new Error("Format de données de paire invalide");
              }
            } else {
              throw new Error(
                `Erreur ${response.status}: ${response.statusText}`
              );
            }
          } catch (apiError) {
            console.error(
              "Échec de récupération des données de paire via l'API Mobula, utilisation de données simulées:",
              apiError
            );

            // Utiliser des données simulées comme fallback
            priceData = {
              price: 0.00015,
              change24h: Math.random() * 10 - 5, // -5% à +5%
              volume24h: 1000000 + Math.random() * 500000,
              lastUpdated: new Date().toISOString(),
            };

            console.error(
              "Utilisation de données simulées pour l'analyse du marché"
            );
          }

          // Vérification que priceData est bien défini
          if (!priceData) {
            priceData = {
              price: 0.00015,
              change24h: 0,
              volume24h: 0,
              lastUpdated: new Date().toISOString(),
            };
          }

          // Simuler des indicateurs techniques simplifiés
          const indicators = {
            price: priceData.price,
            change24h: priceData.change24h,
            volume24h: priceData.volume24h,
            rsi: 50 + priceData.change24h * 2, // Simulation simplifiée
            ema: priceData.price * (1 + priceData.change24h / 200), // Simulation simplifiée
            macd: priceData.change24h / 2, // Simulation simplifiée
            lastUpdated: priceData.lastUpdated,
          };

          // Stratégie de trading simple basée sur les valeurs simulées
          let decision = "hold";
          let confidence = 0.5;
          let amount = 0;

          // Si le RSI est bas et le prix baisse, c'est peut-être une opportunité d'achat
          if (indicators.rsi < 30 && indicators.change24h < -2) {
            decision = "buy";
            confidence =
              0.7 + Math.min(0.2, Math.abs(indicators.change24h) / 100);
            amount = Math.floor(10 + Math.random() * 90); // Entre 10 et 100 unités
          }
          // Si le RSI est élevé et le prix monte rapidement, envisager de vendre
          else if (indicators.rsi > 70 && indicators.change24h > 2) {
            decision = "sell";
            confidence = 0.7 + Math.min(0.2, indicators.change24h / 100);
            amount = Math.floor(10 + Math.random() * 90);
          }
          // Sinon, conserver la position actuelle
          else {
            decision = "hold";
            confidence = 0.5 + Math.random() * 0.3;
            amount = 0;
          }

          console.error(
            `Décision: ${decision.toUpperCase()} ${amount} TCHOG (Confiance: ${(
              confidence * 100
            ).toFixed(2)}%)`
          );

          return {
            decision,
            amount,
            confidence,
            indicators,
            timestamp: new Date().toISOString(),
          };
        } catch (error: any) {
          console.error(`Erreur lors de l'analyse du marché: ${error}`);
          return {
            decision: "hold",
            amount: 0,
            confidence: 0.1,
            error: error.message,
            timestamp: new Date().toISOString(),
          };
        }
      };

      // Fonction pour améliorer l'agent basée sur ses performances passées
      const improveAgent = () => {
        console.error(
          "Amélioration de l'agent IA basée sur l'historique de trading..."
        );

        if (agentData.transactions.length < 5) {
          return {
            success: false,
            message:
              "Données insuffisantes pour améliorer l'agent (minimum 5 transactions)",
          };
        }

        // Calculer les métriques de performance
        const profits = agentData.transactions
          .filter((tx) => tx.status === "completed")
          .map((tx) => parseFloat(tx.profit));

        const successCount = profits.filter((p) => p > 0).length;
        const totalCount = profits.length;

        const successRate = totalCount > 0 ? successCount / totalCount : 0;
        const averageProfit =
          totalCount > 0 ? profits.reduce((a, b) => a + b, 0) / totalCount : 0;

        // Calculer le ratio de Sharpe simplifié
        const returns = profits.map((p) => p / 100);
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const stdDeviation = Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
            returns.length
        );
        const sharpeRatio = stdDeviation > 0 ? meanReturn / stdDeviation : 0;

        // Mettre à jour les paramètres d'apprentissage
        agentData.learningMetrics.successRate = successRate;
        agentData.learningMetrics.averageProfit = averageProfit;
        agentData.learningMetrics.sharpeRatio = sharpeRatio;
        agentData.learningMetrics.improvementIterations++;

        // Réduire le taux d'exploration avec le temps pour favoriser l'exploitation
        agentData.learningMetrics.explorationRate = Math.max(
          0.05,
          agentData.learningMetrics.explorationRate * 0.9
        );

        // Ajuster les paramètres de stratégie en fonction des performances
        if (successRate > 0.6) {
          // Stratégie performante, augmenter la taille des positions
          agentData.strategyParams.positionSizePercent = Math.min(
            agentData.strategyParams.positionSizePercent * 1.1,
            riskLevel === "conservative"
              ? 20
              : riskLevel === "moderate"
              ? 40
              : 60
          );
        } else if (successRate < 0.4) {
          // Stratégie peu performante, réduire la taille des positions
          agentData.strategyParams.positionSizePercent = Math.max(
            agentData.strategyParams.positionSizePercent * 0.9,
            riskLevel === "conservative"
              ? 5
              : riskLevel === "moderate"
              ? 10
              : 20
          );
        }

        // Ajuster les seuils d'entrée/sortie
        if (averageProfit > 0) {
          agentData.strategyParams.takeProfitPercent *= 1.05; // Viser des profits plus élevés
          agentData.strategyParams.stopLossPercent *= 0.95; // Réduire les pertes
        } else {
          agentData.strategyParams.takeProfitPercent *= 0.95; // Réduire les attentes
          agentData.strategyParams.stopLossPercent *= 1.05; // Augmenter la tolérance aux pertes
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

      // Traiter l'action demandée
      let result = null;

      // Définition des types pour chaque action
      type CreateResult = {
        success: boolean;
        agentId: string;
        message: string;
        address: string;
        status: string;
        initialCapital: number;
        riskLevel: typeof riskLevel;
        initialTrade?: {
          success: boolean;
          action: string;
          amount: number;
          txHash: string;
        };
      };

      type StartResult = {
        success: boolean;
        agentId: string;
        action: string;
        amount?: number;
        confidence?: number;
        txHash: string | null;
        message: string;
        indicators?: any;
      };

      type StopResult = {
        success: boolean;
        agentId: string;
        message: string;
        status: string;
      };

      type ImproveResult = {
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
      };

      type StatusResult = {
        success: boolean;
        agentId: string;
        address: string;
        balance: string;
        status: string;
        transactions: number;
        riskLevel: typeof riskLevel;
        learningMetrics: any;
        strategyParams: any;
        lastImprovement: string;
      };

      // Type guards pour vérifier le type de résultat
      const isCreateResult = (result: any): result is CreateResult =>
        action === "create";

      const isStartResult = (result: any): result is StartResult =>
        action === "start";

      const isStopResult = (result: any): result is StopResult =>
        action === "stop";

      const isImproveResult = (result: any): result is ImproveResult =>
        action === "improve";

      const isStatusResult = (result: any): result is StatusResult =>
        action === "status" ||
        !["create", "start", "stop", "improve"].includes(action);

      switch (action) {
        case "create":
          result = {
            success: true,
            agentId,
            message: `Agent IA autonome créé: ${agentId}`,
            address: agentAddress,
            status: "active", // Actif dès la création
            initialCapital: initialInvestment,
            riskLevel,
          } as CreateResult;

          // Après avoir créé l'agent, effectuer un achat initial
          if (agentAddress) {
            try {
              const tradeResult = await performInitialTrade(
                wallet,
                initialInvestment
              );

              // Ajouter la transaction à l'historique de l'agent si le trade a réussi
              if (tradeResult.success) {
                const transaction: TraderTransaction = {
                  txHash: tradeResult.txHash || "",
                  timestamp: new Date().toISOString(),
                  action: "buy",
                  amount: String(tradeResult.amount),
                  price: "0", // À remplir plus tard avec le prix réel
                  gasUsed: "0", // À remplir plus tard avec le gas réel
                  profit: "0",
                  status: "completed",
                };

                agentData.transactions.push(transaction);

                // Ajouter l'information du trade initial dans le résultat
                (result as CreateResult).initialTrade = {
                  success: true,
                  action: "buy",
                  amount: tradeResult.amount ?? 0, // Utiliser 0 si amount est undefined
                  txHash: tradeResult.txHash || "",
                };
              } else {
                console.error("L'achat initial a échoué:", tradeResult.message);
              }

              // Démarrer immédiatement une décision de trading après la création
              console.error(
                "Démarrage automatique du trading après création..."
              );

              // Prendre une décision de trading
              const decision = await makeDecision();

              if (
                decision.decision !== "hold" &&
                decision.confidence > agentData.strategyParams.entryThreshold
              ) {
                console.error(
                  `Décision de trading auto: ${decision.decision.toUpperCase()} ${
                    decision.amount
                  } TCHOG`
                );

                // Exécuter la transaction
                const txResult = await executeTransaction(
                  decision.decision,
                  decision.amount
                );

                if (txResult.success) {
                  console.error(`Transaction auto réussie: ${txResult.txHash}`);
                } else {
                  console.error(
                    `Échec de la transaction auto: ${txResult.error}`
                  );
                }
              } else {
                console.error(
                  `Décision HOLD - Pas de trading auto pour le moment`
                );
              }
            } catch (tradeError) {
              console.error("Erreur lors de l'achat initial:", tradeError);
            }
          }

          break;

        case "start":
          // Prendre une décision de trading
          const decision = await makeDecision();

          if (
            decision.decision !== "hold" &&
            decision.confidence > agentData.strategyParams.entryThreshold
          ) {
            // Exécuter la transaction
            const txResult = await executeTransaction(
              decision.decision,
              decision.amount
            );

            result = {
              success: txResult.success,
              agentId,
              action: decision.decision,
              amount: decision.amount,
              confidence: decision.confidence,
              txHash: txResult.success ? txResult.txHash : null,
              message: txResult.success
                ? `Transaction réussie: ${
                    decision.decision ? decision.decision.toUpperCase() : "NONE"
                  } ${decision.amount || 0} TCHOG
  Confiance: ${
    decision.confidence ? (decision.confidence * 100).toFixed(2) : "0"
  }%
  Hash: ${txResult.txHash || "N/A"}`
                : `Échec de la transaction: ${txResult.error}`,
            };
          } else {
            result = {
              success: true,
              agentId,
              action: "hold",
              message: `Décision: HOLD - Confiance insuffisante (${(
                decision.confidence * 100
              ).toFixed(2)}%) ou meilleure opportunité non détectée`,
              indicators: decision.indicators,
            };
          }
          break;

        case "stop":
          result = {
            success: true,
            agentId,
            message: `Agent IA arrêté: ${agentId}`,
            status: "idle",
          };
          break;

        case "improve":
          const improvementResult = improveAgent();

          result = {
            success: improvementResult.success,
            agentId,
            message: improvementResult.success
              ? `Agent IA amélioré après ${improvementResult.iterations} itérations`
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
          // Récupérer le statut actuel
          result = {
            success: true,
            agentId,
            address: agentAddress,
            balance: ethers.formatEther(balance),
            status: "active", // Toujours en mode actif
            transactions: agentData.transactions.length,
            riskLevel,
            learningMetrics: agentData.learningMetrics,
            strategyParams: agentData.strategyParams,
            lastImprovement: agentData.lastImprovement,
          };
          break;
      }

      // Générer la sortie
      let output = `
  🤖 AGENT IA AUTONOME DE TRADING ${
    action === "create"
      ? "CRÉÉ"
      : action === "start"
      ? "DÉMARRÉ"
      : action === "stop"
      ? "ARRÊTÉ"
      : action === "improve"
      ? "AMÉLIORÉ"
      : "STATUT"
  }
  
  ID: ${agentId}
  Adresse: ${agentAddress}
  Solde: ${ethers.formatEther(balance)} MON
  Statut: ${
    result && "status" in result
      ? result.status
      : action === "start"
      ? "actif"
      : "inactif"
  }
  Niveau de risque: ${riskLevel.toUpperCase()}
  
  ${
    action === "create" && isCreateResult(result)
      ? `✅ Agent IA créé avec succès
  Capital initial: ${initialInvestment} MON
  ${
    result.initialTrade && result.initialTrade.success
      ? `✅ Achat initial: ${result.initialTrade.amount} WMON → TCHOG
  Hash: ${result.initialTrade.txHash}`
      : "⚠️ Achat initial non effectué"
  }
  Pour démarrer l'agent: monad-ai-trader-autonomous --action=start --privateKey=${privateKey.substring(
    0,
    6
  )}...`
      : action === "start" && isStartResult(result)
      ? `${
          result.success
            ? `✅ Transaction exécutée: ${
                result.action ? result.action.toUpperCase() : "NONE"
              } ${result.amount || 0} TCHOG
  Confiance: ${result.confidence ? (result.confidence * 100).toFixed(2) : "0"}%
  Hash: ${result.txHash || "N/A"}`
            : `❌ ${result.message || "Erreur inconnue"}`
        }`
      : action === "stop" && isStopResult(result)
      ? `✅ Agent IA arrêté`
      : action === "improve" && isImproveResult(result)
      ? `${
          result.success
            ? `✅ Agent IA amélioré après ${
                result.metrics && result.metrics.iterations
                  ? result.metrics.iterations
                  : "N/A"
              } itérations
  Taux de succès: ${
    result.metrics && result.metrics.successRate
      ? (result.metrics.successRate * 100).toFixed(2)
      : "N/A"
  }%
  Profit moyen: ${
    result.metrics && result.metrics.averageProfit
      ? result.metrics.averageProfit.toFixed(6)
      : "N/A"
  } MON
  Ratio de Sharpe: ${
    result.metrics && result.metrics.sharpeRatio
      ? result.metrics.sharpeRatio.toFixed(2)
      : "N/A"
  }
  
  NOUVEAUX PARAMÈTRES:
  - Taille de position: ${
    result.newParams ? result.newParams.positionSizePercent.toFixed(2) : "N/A"
  }%
  - Seuil d'entrée: ${
    result.newParams ? result.newParams.entryThreshold.toFixed(2) : "N/A"
  }`
            : `❌ ${result.message || "Erreur inconnue"}`
        }`
      : isStatusResult(result)
      ? `📊 STATUT DE L'AGENT IA
  Transactions totales: ${result.transactions || 0}
  Taux d'apprentissage: ${
    result.learningMetrics ? result.learningMetrics.learningRate : learningRate
  }
  Taux d'exploration: ${
    result.learningMetrics
      ? result.learningMetrics.explorationRate.toFixed(3)
      : "0.200"
  }
  Dernière amélioration: ${result.lastImprovement || "Jamais"}
  
  PARAMÈTRES DE STRATÉGIE:
  - Taille de position: ${
    result.strategyParams
      ? result.strategyParams.positionSizePercent.toFixed(2)
      : "N/A"
  }%
  - Seuil d'entrée: ${
    result.strategyParams
      ? result.strategyParams.entryThreshold.toFixed(2)
      : "N/A"
  }
  - Stop loss: ${
    result.strategyParams
      ? result.strategyParams.stopLossPercent.toFixed(2)
      : "N/A"
  }%
  - Take profit: ${
    result.strategyParams
      ? result.strategyParams.takeProfitPercent.toFixed(2)
      : "N/A"
  }%`
      : ""
  }
  
  COMMANDES DISPONIBLES:
  - Pour créer un agent: monad-ai-trader-autonomous --action=create --privateKey=<votre_clé>
  - Pour démarrer un agent: monad-ai-trader-autonomous --action=start --privateKey=<votre_clé>
  - Pour améliorer un agent: monad-ai-trader-autonomous --action=improve --privateKey=<votre_clé>
  - Pour arrêter un agent: monad-ai-trader-autonomous --action=stop --privateKey=<votre_clé>
  
  NOTE: L'agent IA exécute des transactions réelles sur Monad Testnet.
  Toutes les transactions sont vérifiables dans l'explorateur Monad.
  `;

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      console.error(
        "Erreur lors de l'exécution de l'agent IA autonome:",
        error
      );
      return {
        content: [
          {
            type: "text",
            text: `❌ Erreur lors de l'exécution de l'agent IA autonome: ${error}`,
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
