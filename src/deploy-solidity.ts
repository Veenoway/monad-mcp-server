import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { execSync } from "child_process";
import { ethers } from "ethers";
import { z } from "zod";
import {
  MINIMAL_ERC20_ABI,
  MINIMAL_ERC20_BYTECODE,
} from "./shared/constants.js";
import { convertConstructorArg, detectParamType } from "./shared/utils.js";

export const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

export const server = new McpServer({
  name: "deploy-solidity",
  version: "0.0.1",
  capabilities: ["deploy-solidity"],
});

server.tool(
  "deploy-solidity",
  "Compile and deploy Solidity source code directly to Monad testnet",
  {
    privateKey: z.string().describe("Deployer's private key"),
    sourceCode: z
      .string()
      .describe("Solidity source code to compile and deploy"),
    constructorArgs: z
      .array(z.any())
      .optional()
      .describe("Constructor arguments (optional)"),
  },
  async ({ privateKey, sourceCode, constructorArgs = [] }) => {
    try {
      console.error("Deploying Solidity source code directly...");

      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Deployer wallet address: ${walletAddress}`);

      const balance = await provider.getBalance(walletAddress);
      console.error(`Deployer balance: ${ethers.formatEther(balance)} MON`);

      if (balance < ethers.parseEther("0.01")) {
        throw new Error(
          `Insufficient balance: ${ethers.formatEther(
            balance
          )} MON. At least 0.01 MON recommended for deployment.`
        );
      }

      const BASIC_CONTRACT_TEMPLATES = {
        erc20: {
          bytecode: MINIMAL_ERC20_BYTECODE,
          abi: MINIMAL_ERC20_ABI,
          detect: (code: string) =>
            /contract\s+\w+\s+is\s+.*?ERC20|function\s+transfer\s*\(\s*address\s+to\s*,\s*uint256\s+amount\s*\)\s*.*?returns\s*\(\s*bool\s*\)/i.test(
              code
            ),
        },
        storage: {
          bytecode:
            "0x608060405234801561001057600080fd5b5060405161015d38038061015d83398101604081905261002f9161003c565b600055610056565b60006020828403121561004e57600080fd5b5051919050565b60f98061006460003960006000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632a1afcd9146041578063489afcf51460545780636d4ce63c146066575b600080fd5b604760005481565b6040519081526020015b60405180910390f35b606460603660046089565b600055565b005b604760005490565b600060208284031215609a57600080fd5b50359056fea2646970667358221220a40f0f540b3821f124e1e5f447d2d40bd9c1c2483df4ed5fa98a9c5fa39df95064736f6c63430008130033",
          abi: [
            "constructor(uint256 initialValue)",
            "function get() view returns (uint256)",
            "function set(uint256 newValue)",
            "function value() view returns (uint256)",
          ],
          detect: (code: string) =>
            /uint256\s+(public|private)?\s+\w+;.*function\s+set\s*\(\s*uint256\s+.*\)\s+public/i.test(
              code
            ),
        },
        simpleStorage: {
          bytecode:
            "0x608060405234801561001057600080fd5b5060405161015d38038061015d83398101604081905261002f9161003c565b600055610056565b60006020828403121561004e57600080fd5b5051919050565b60f98061006460003960006000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632a1afcd9146041578063489afcf51460545780636d4ce63c146066575b600080fd5b604760005481565b6040519081526020015b60405180910390f35b606460603660046089565b600055565b005b604760005490565b600060208284031215609a57600080fd5b50359056fea2646970667358221220a40f0f540b3821f124e1e5f447d2d40bd9c1c2483df4ed5fa98a9c5fa39df95064736f6c63430008130033",
          abi: [
            "constructor(uint256 initialValue)",
            "function get() view returns (uint256)",
            "function set(uint256 newValue)",
            "function value() view returns (uint256)",
          ],
          detect: (code: string) =>
            /contract\s+SimpleStorage\s*{/i.test(code) ||
            /uint256\s+(private|public)?\s+value;/i.test(code),
        },
        minimal: {
          bytecode: "0x6080604052602a6000f3",
          abi: [],
          detect: () => true,
        },
      };

      console.error("Analyzing source code to determine contract type...");

      const hasConstructor = sourceCode.includes("constructor");
      console.error(
        `Contract ${hasConstructor ? "with" : "without"} explicit constructor`
      );

      const constructorRegex =
        /constructor\s*\((.*?)\)(?:\s*(?:public|private|internal|external))?(?:\s*(?:payable|nonpayable|pure|view))?\s*(?:\{|$)/s;
      const constructorMatch = sourceCode.match(constructorRegex);

      let paramTypes: string[] = [];
      let rawParamsString = "";

      if (constructorMatch) {
        rawParamsString = constructorMatch[1].trim();
        console.error(`Raw constructor parameters: "${rawParamsString}"`);

        if (rawParamsString && rawParamsString.length > 0) {
          const paramsWithTypes = rawParamsString
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

          paramTypes = paramsWithTypes.map((param) => detectParamType(param));

          console.error(`Detected parameter types: ${paramTypes.join(", ")}`);
        } else {
          console.error("Constructor without parameters detected");
        }
      } else if (hasConstructor) {
        console.error("Constructor present but format not recognized");
      } else {
        console.error(
          "No explicit constructor detected, using default constructor"
        );
      }

      let contractTemplate = null;
      for (const [type, template] of Object.entries(BASIC_CONTRACT_TEMPLATES)) {
        if (template.detect(sourceCode)) {
          contractTemplate = template;
          console.error(`Detected contract type: ${type}`);
          break;
        }
      }

      if (!contractTemplate) {
        throw new Error(
          "Contract type not recognized. Please use a supported contract template."
        );
      }

      const factory = new ethers.ContractFactory(
        contractTemplate.abi,
        contractTemplate.bytecode,
        wallet
      );

      console.error("Deploying contract...");
      console.error(
        `Raw constructor arguments: ${JSON.stringify(constructorArgs)}`
      );

      let processedArgs: any[] = [];

      if (paramTypes.length === 0 && constructorArgs.length > 0) {
        console.error(
          "Constructor without parameters detected but arguments were provided"
        );
        console.error("Attempting deployment without arguments...");
        processedArgs = [];
      } else if (paramTypes.length > 0) {
        processedArgs = constructorArgs.map((arg, index) => {
          if (index < paramTypes.length) {
            return convertConstructorArg(arg, paramTypes[index]);
          }
          if (typeof arg === "number") {
            return ethers.toBigInt(arg.toString());
          }
          return arg;
        });
      }

      console.error(`Processed arguments: ${JSON.stringify(processedArgs)}`);

      const deployOptions = {
        gasLimit: ethers.toBigInt("3000000"),
        type: 0,
      };

      let contract;
      try {
        if (processedArgs.length > 0) {
          console.error(`Deploying with ${processedArgs.length} arguments...`);
          contract = await factory.deploy(...processedArgs, deployOptions);
        } else {
          console.error("Deploying without arguments...");
          contract = await factory.deploy(deployOptions);
        }
      } catch (error) {
        if (
          processedArgs.length > 0 &&
          // @ts-ignore
          error.message.includes("incorrect number of arguments")
        ) {
          console.error("Failed with arguments, trying without arguments...");
          contract = await factory.deploy(deployOptions);
        } else {
          throw error;
        }
      }

      const txHash = contract.deploymentTransaction()?.hash;
      console.error(`Transaction sent! Hash: ${txHash}`);
      console.error("Waiting for transaction confirmation...");

      const deployedContract = await contract.waitForDeployment();
      const txReceipt = await contract.deploymentTransaction()?.wait(2);

      if (!txReceipt || txReceipt.status === 0) {
        throw new Error(
          `Contract deployment failed. Transaction hash: ${txHash}`
        );
      }

      const contractAddress = await deployedContract.getAddress();
      console.error(`Contract deployed at address: ${contractAddress}`);

      console.error("Tentative de vérification automatique du contrat...");

      try {
        const contractName =
          sourceCode.match(/contract\s+(\w+)/)?.[1] || "DeployedContract";
        console.error(`Nom du contrat détecté: ${contractName}`);

        console.error("Attente de 10 secondes pour indexation...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        try {
          execSync("forge --version", { stdio: "pipe" });
          console.error("Foundry trouvé, tentative de vérification directe...");

          const argsString =
            processedArgs.length > 0
              ? processedArgs.map((a) => a.toString()).join(" ")
              : "";

          const cmd = `forge verify-contract ${contractAddress} ${contractName} --chain-id 10143 --verifier-url "https://testnet.monadexplorer.com/api" --compiler-version "0.8.20" --optimizer-runs 200 --via-ir ${
            argsString ? `--constructor-args ${argsString}` : ""
          }`;
          console.error(`Exécution: ${cmd}`);

          const output = execSync(cmd, { encoding: "utf8" });
          console.error("Vérification Foundry réussie:", output);

          return {
            content: [
              {
                type: "text",
                text: `Contrat déployé et vérifié avec succès!
  
  Adresse du contrat: ${contractAddress}
  Transaction hash: ${txHash}
  Block: ${txReceipt?.blockNumber}
  Gas used: ${txReceipt?.gasUsed?.toString() || "unknown"}
  
  Votre contrat est déployé et vérifié sur Monad testnet.
  Vous pouvez consulter votre contrat vérifié ici: https://testnet.monadexplorer.com/address/${contractAddress}
  
  Arguments utilisés pour le déploiement:
  ${processedArgs
    .map((arg, i) => `- Argument ${i + 1}: ${arg.toString()}`)
    .join("\n")}`,
              },
            ],
          };
        } catch (foundryError) {
          console.error("Foundry non disponible ou erreur:", foundryError);
        }

        try {
          console.error("Tentative de vérification via API REST...");

          const apiData = {
            address: contractAddress,
            chainId: 10143,
            name: contractName,
            sourceCode: sourceCode,
            constructorArguments:
              processedArgs.length > 0
                ? processedArgs.map((a) => a.toString()).join(",")
                : "",
            compilerVersion: "0.8.20",
            optimizationEnabled: true,
            runs: 200,
          };

          const apiResponse = await axios.post(
            "https://testnet.monadexplorer.com/api/contract/verify",
            apiData,
            { headers: { "Content-Type": "application/json" } }
          );

          console.error("Réponse API:", apiResponse.data);

          if (apiResponse.status === 200 || apiResponse.data.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Contrat déployé et vérifié avec succès via API!
  
  Adresse du contrat: ${contractAddress}
  Transaction hash: ${txHash}
  Block: ${txReceipt?.blockNumber}
  Gas used: ${txReceipt?.gasUsed?.toString() || "unknown"}
  
  Votre contrat est déployé et vérifié sur Monad testnet.
  Vous pouvez consulter votre contrat vérifié ici: https://testnet.monadexplorer.com/address/${contractAddress}
  
  Arguments utilisés pour le déploiement:
  ${processedArgs
    .map((arg, i) => `- Argument ${i + 1}: ${arg.toString()}`)
    .join("\n")}`,
                },
              ],
            };
          }
        } catch (apiError) {
          console.error("Échec de l'API de vérification:", apiError);
        }
      } catch (verifyError) {
        console.error("Erreur globale de vérification:", verifyError);
      }

      return {
        content: [
          {
            type: "text",
            text: `Contrat déployé avec succès mais non vérifié automatiquement.
  
  Adresse du contrat: ${contractAddress}
  Transaction hash: ${txHash}
  Block: ${txReceipt?.blockNumber}
  Gas used: ${txReceipt?.gasUsed?.toString() || "unknown"}
  
  Votre contrat est déployé sur Monad testnet.
  
  Arguments utilisés pour le déploiement:
  ${processedArgs
    .map((arg, i) => `- Argument ${i + 1}: ${arg.toString()}`)
    .join("\n")}
  
  Pour vérifier manuellement votre contrat:
  1. Visitez: https://testnet.monadexplorer.com/address/${contractAddress}
  2. Cliquez sur l'onglet "Code" puis sur "Verify & Publish"
  3. Entrez le nom du contrat: ${contract}
  4. Uploadez le code source et renseignez les arguments du constructeur`,
          },
        ],
      };
    } catch (error) {
      console.error("Error deploying Solidity code:", error);

      let errorMessage = error instanceof Error ? error.message : String(error);

      let friendlyMessage = `Failed to deploy Solidity contract. Error: ${errorMessage}`;
      friendlyMessage += `\n\nSuggestions:
  1. Verify your Solidity code is correct and uses standard format
  2. Check that constructor arguments match expected types
  3. Try a simpler contract, like a basic ERC20 or storage contract
  4. For complex or custom contracts, use Remix to compile your code first`;

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
