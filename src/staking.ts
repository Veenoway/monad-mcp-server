import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";

const APR_MON_ADDRESS = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";

const APR_MON_ABI = [
  "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
  "function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId)",
  "function redeem(uint256 requestId, address receiver) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function convertToShares(uint256 assets) external view returns (uint256)",
  "function withdrawalWaitTime() external view returns (uint256)",
];

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "monad-staking",
  version: "0.0.1",
  capabilities: ["monad-staking"],
});

server.tool(
  "monad-staking",
  "Staker des tokens MON sur Monad Testnet",
  {
    privateKey: z
      .string()
      .describe("Clé privée du wallet qui va staker les tokens"),
    amount: z.string().describe("Montant de MON à staker (en MON)"),
  },
  async ({ privateKey, amount }, extra) => {
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      const amountToStake = ethers.parseEther(amount);
      console.error(
        `Preparing to stake ${amount} MON from ${walletAddress}...`
      );

      const balance = await provider.getBalance(walletAddress);
      if (balance < amountToStake) {
        throw new Error(
          `Solde insuffisant: ${ethers.formatEther(
            balance
          )} MON disponible, ${amount} MON requis`
        );
      }

      const aprMonCode = await provider.getCode(APR_MON_ADDRESS);
      if (aprMonCode === "0x" || aprMonCode === "") {
        throw new Error(
          `APR_MON contract is not deployed at address ${APR_MON_ADDRESS}`
        );
      }
      console.error(`APR_MON contract code: ${aprMonCode.substring(0, 20)}...`);

      const contractBalance = await provider.getBalance(APR_MON_ADDRESS);
      console.error(
        `Contract MON balance: ${ethers.formatEther(contractBalance)} MON`
      );

      const aprMonContract = new ethers.Contract(
        APR_MON_ADDRESS,
        APR_MON_ABI,
        wallet
      );

      const currentAprMonBalance = await aprMonContract.balanceOf(
        walletAddress
      );
      console.error(
        `Current aprMON balance: ${ethers.formatEther(
          currentAprMonBalance
        )} aprMON`
      );

      const sharesToReceive = await aprMonContract.convertToShares(
        amountToStake
      );
      console.error(
        `You will receive ${ethers.formatEther(sharesToReceive)} aprMON`
      );

      try {
        const isPaused = await aprMonContract.paused();
        console.error(`Contract paused: ${isPaused}`);
        if (isPaused) {
          throw new Error("Staking is currently paused");
        }
      } catch (error) {
        console.error("Unable to check contract state:", error);
      }

      let gasEstimate;
      try {
        gasEstimate = await aprMonContract.deposit.estimateGas(
          amountToStake,
          walletAddress,
          {
            value: amountToStake,
          }
        );
        console.error(`Gas estimate: ${gasEstimate.toString()}`);
      } catch (error) {
        console.error("Error estimating gas:", error);
        throw new Error("Unable to estimate gas needed for transaction");
      }

      const depositTx = await aprMonContract.deposit(
        amountToStake,
        walletAddress,
        {
          value: amountToStake,
          gasLimit: (gasEstimate * BigInt(15)) / BigInt(10),
        }
      );
      console.error(`Deposit transaction sent: ${depositTx.hash}`);

      const receipt = await depositTx.wait();
      if (!receipt || receipt.status === 0) {
        throw new Error(`Deposit transaction failed: ${depositTx.hash}`);
      }

      const aprMonBalance = await aprMonContract.balanceOf(walletAddress);

      return {
        content: [
          {
            type: "text",
            text: `✅ ${amount} MON have been successfully staked from ${walletAddress}\nTransaction: ${
              depositTx.hash
            }\naprMON balance: ${ethers.formatEther(aprMonBalance)} aprMON`,
          },
        ],
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error during staking: ${error}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "monad-unstaking",
  "Unstake MON tokens from Monad Testnet",
  {
    privateKey: z
      .string()
      .describe("Private key of the wallet that will unstake the tokens"),
    amount: z.string().describe("Amount of aprMON to unstake (in aprMON)"),
  },
  async ({ privateKey, amount }, extra) => {
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      const amountToUnstake = ethers.parseEther(amount);
      console.error(
        `Preparing to unstake ${amount} aprMON from ${walletAddress}...`
      );

      const aprMonContract = new ethers.Contract(
        APR_MON_ADDRESS,
        APR_MON_ABI,
        wallet
      );

      const aprMonBalance = await aprMonContract.balanceOf(walletAddress);
      if (aprMonBalance < amountToUnstake) {
        throw new Error(
          `Insufficient balance: ${ethers.formatEther(
            aprMonBalance
          )} aprMON available, ${amount} aprMON required`
        );
      }

      const requestTx = await aprMonContract.requestRedeem(
        amountToUnstake,
        walletAddress,
        walletAddress
      );
      console.error(`Unstake request sent: ${requestTx.hash}`);

      const requestReceipt = await requestTx.wait();
      if (!requestReceipt || requestReceipt.status === 0) {
        throw new Error(`Unstake request failed: ${requestTx.hash}`);
      }

      let requestId;
      try {
        requestId = requestReceipt.logs
          .filter(
            (log: ethers.Log) =>
              log.topics[0] ===
              ethers.id("RequestRedeem(address,address,uint256,uint256)")
          )
          .map((log: ethers.Log) => {
            const decoded = aprMonContract.interface.decodeEventLog(
              "RequestRedeem",
              log.data,
              log.topics
            );
            return decoded.requestId;
          })[0];
      } catch (error) {
        console.error("Unable to get request ID from events:", error);
      }

      if (!requestId) {
        console.error(
          "Request ID could not be retrieved, but the request was sent successfully"
        );
        return {
          content: [
            {
              type: "text",
              text: `✅ Unstake request for ${amount} aprMON successfully sent from ${walletAddress}\nTransaction: ${requestTx.hash}\n\n⚠️ The unstaked MON will appear in your wallet in about 10 minutes.\n\nNote: The request ID could not be retrieved, but this does not affect the unstaking process.`,
            },
          ],
        };
      }

      console.error(`Request ID: ${requestId.toString()}`);

      const waitTime = await aprMonContract.withdrawalWaitTime();
      console.error(`Withdrawal wait time: ${waitTime.toString()} blocks`);
      console.error(`Waiting for ${waitTime.toString()} blocks...`);
      await new Promise((resolve) =>
        setTimeout(resolve, Number(waitTime) * 12000)
      ); // ~12s per block

      const redeemTx = await aprMonContract.redeem(requestId, walletAddress);
      console.error(`Unstake transaction sent: ${redeemTx.hash}`);

      const redeemReceipt = await redeemTx.wait();
      if (!redeemReceipt || redeemReceipt.status === 0) {
        throw new Error(`Unstake failed: ${redeemTx.hash}`);
      }

      const newAprMonBalance = await aprMonContract.balanceOf(walletAddress);

      return {
        content: [
          {
            type: "text",
            text: `✅ Unstake request for ${amount} aprMON successfully sent from ${walletAddress}\nTransaction: ${
              redeemTx.hash
            }\nNew aprMON balance: ${ethers.formatEther(
              newAprMonBalance
            )} aprMON\n\n⚠️ The unstaked MON will appear in your wallet in about 10 minutes.`,
          },
        ],
      };
    } catch (error) {
      console.error("Error:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error during unstaking: ${error}`,
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
    console.error("Serveur MCP Monad staking lancé sur stdio");
  } catch (error) {
    console.error("Erreur d'initialisation du serveur:", error);
  }
}

main().catch((error) => {
  console.error("Erreur fatale dans main():", error);
  process.exit(1);
});
