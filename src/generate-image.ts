import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { ethers } from "ethers";
import FormData from "form-data";
import { z } from "zod";
import { NFT_FACTORY_ABI, NFT_FACTORY_ADDRESS } from "./shared/constants.js";

console.error("Démarrage du serveur MCP...");

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "generate-image-mint-nft",
  version: "0.0.1",
  capabilities: ["image-nft-generation"],
});

server.tool(
  "image-nft-generation",
  "Génère une image à partir d'un prompt textuel et le mint directement en NFT",
  {
    prompt: z.string().describe("Description de l'image à générer"),
    userAddress: z.string().describe("Wallet to send NFT"),
  },
  // @ts-ignore - Type complexe de la réponse
  async ({ prompt, userAddress }, _extra) => {
    try {
      console.error(`Génération d'image pour le prompt: "${prompt}"`);

      const trimmedPrompt = prompt.slice(0, 1000);

      const requestBody = {
        model: "dall-e-2",
        prompt: trimmedPrompt,
        n: 1,
        size: "1024x1024",
      };

      const response = await axios.post(
        "https://api.openai.com/v1/images/generations",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer sk-KEY`,
          },
        }
      );

      if (!response.data?.data?.[0]?.url) {
        throw new Error("Réponse inattendue de DALL-E");
      }

      const imageUrl = response.data.data[0].url;

      console.error("Téléchargement de l'image générée...");
      const imageBlob = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const imageBuffer = Buffer.from(imageBlob.data);

      console.error("Upload de l'image sur IPFS via Pinata...");
      const formData = new FormData();
      formData.append("file", imageBuffer, {
        filename: "nft-image.png",
        contentType: "image/png",
      });
      formData.append(
        "pinataMetadata",
        JSON.stringify({
          name: `generated-nft-${Date.now()}`,
        })
      );

      const pinataUpload = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxBodyLength: Infinity,
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT || "JWT PINATA"}`,
            ...formData.getHeaders(),
          },
        }
      );

      const imageIpfsHash = pinataUpload.data.IpfsHash;
      const ipfsImageUrl = `ipfs://${imageIpfsHash}`;

      console.error(`Image uploadée sur IPFS: ${ipfsImageUrl}`);

      // Génération des métadonnées du NFT
      console.error("Création et upload des métadonnées NFT...");
      const metadata = {
        name: `Image IA - ${new Date().toISOString().split("T")[0]}`,
        description: `Image générée à partir du prompt: "${prompt}"`,
        image: ipfsImageUrl,
        attributes: [
          {
            trait_type: "Généré par",
            value: "VeenoX AI",
          },
          {
            trait_type: "Date",
            value: new Date().toISOString(),
          },
        ],
      };

      const metadataUpload = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          pinataContent: metadata,
          pinataMetadata: {
            name: `nft-metadata-${Date.now()}.json`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT || "JWT_PINATA"}`,
            "Content-Type": "application/json",
          },
        }
      );

      const metadataIpfsHash = metadataUpload.data.IpfsHash;
      const tokenURI = `ipfs://${metadataIpfsHash}`;

      console.error(`Métadonnées uploadées: ${tokenURI}`);

      // MINT DU NFT
      console.error("Mint du NFT sur Monad Testnet...");

      const deployerWallet = new ethers.Wallet(
        "5d5185d7a8ead54c253633730eb0c78905d0426dbf12972d3ac0359e15207a82"!,
        provider
      );
      const nftContract = new ethers.Contract(
        NFT_FACTORY_ADDRESS,
        NFT_FACTORY_ABI,
        deployerWallet
      );

      const mintTx = await nftContract.mint(tokenURI, userAddress, {
        gasLimit: 500_000,
      });

      await mintTx.wait();

      console.error(`NFT minté avec succès: TX ${mintTx.hash}`);

      return {
        content: [
          {
            type: "text",
            text: `✅ Image générée et mintée en NFT pour **${userAddress}** !

- **Prompt**: "${prompt}"
- **IPFS Image**: [Voir l'image](https://gateway.pinata.cloud/ipfs/${imageIpfsHash})
- **Token URI**: ${tokenURI}
- **Transaction**: [Voir sur Explorer Monad](https://testnet.monadexplorer.com/tx/${mintTx.hash})
          `,
          },
        ],
      };
    } catch (error: any) {
      console.error(
        "Erreur:",
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
      return {
        content: [
          {
            type: "text",
            text: `❌ Erreur durant la génération et le mint: ${
              error.message || JSON.stringify(error)
            }`,
          },
        ],
      };
    }
  }
);

// Lancement du serveur
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
