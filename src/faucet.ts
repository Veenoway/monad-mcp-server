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
  name: "monad-faucet",
  version: "0.0.1",
  capabilities: ["monad-faucet"],
});

server.tool(
  "monad-faucet",
  "Obtenir 0.2 MON sur Monad Testnet pour tester vos applications",
  {
    walletAddress: z
      .string()
      .describe("Adresse du wallet qui recevra les tokens"),
  },
  async ({ walletAddress }, extra) => {
    try {
      if (!ethers.isAddress(walletAddress)) {
        throw new Error(`Adresse de wallet invalide: ${walletAddress}`);
      }

      console.error(`Préparation de l'envoi de MON vers ${walletAddress}...`);

      const faucetPrivateKey = "PRIVATE_KEY";
      const senderWallet = new ethers.Wallet(faucetPrivateKey, provider);
      const senderAddress = senderWallet.address;

      const senderBalance = await provider.getBalance(senderAddress);
      console.error(
        `Solde du wallet émetteur (${senderAddress}): ${ethers.formatEther(
          senderBalance
        )} MON`
      );

      const amountToSend = ethers.parseEther("0.2");

      if (senderBalance < amountToSend) {
        throw new Error(
          `Solde insuffisant: votre wallet a ${ethers.formatEther(
            senderBalance
          )} MON, mais l'envoi nécessite 0.2 MON`
        );
      }

      console.error(
        `Envoi de 0.2 MON depuis ${senderAddress} vers ${walletAddress}...`
      );

      const tx = await senderWallet.sendTransaction({
        to: walletAddress,
        value: amountToSend,
        gasLimit: ethers.toBigInt("300000"),
      });

      console.error(`Transaction envoyée: ${tx.hash}`);

      const receipt = await provider.waitForTransaction(tx.hash);

      if (!receipt || receipt.status === 0) {
        throw new Error(`La transaction a échoué: ${tx.hash}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ 0.2 MON envoyés avec succès à ${walletAddress}\nTransaction: ${tx.hash}\nEnvoyé depuis: ${senderAddress}`,
          },
        ],
      };
    } catch (error) {
      console.error("Erreur:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Erreur lors de l'envoi des tokens: ${error}`,
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
