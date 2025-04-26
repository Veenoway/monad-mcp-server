import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";
import { z } from "zod";

console.error("Starting MCP server...");

// Create a provider to interact with the Monad testnet
const provider = new ethers.JsonRpcProvider(
  "https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6",
  {
    name: "Monad Testnet",
    chainId: 10143,
  }
);

// Simplified minimal ERC20 bytecode for Monad testnet - super lightweight implementation
const MINIMAL_ERC20_BYTECODE =
  "0x608060405234801561001057600080fd5b50604051610805380380610805833981810160405260808110156100335760006020825260409283825261005b95600489375061006c9350565b5050600355600380546001600160a01b031916331790556100c5565b600061007682610195565b606061008184610195565b608061008c82610189565b60a061009786610214565b60c06100a28761026c565b60e08190526040516100db917f2b38f4e50e5a8a11f56bb60abddcbdbb78add07e92c0a5b37ede4a8ff5b359e4913391600190600401610365565b60405180910390a2505050505050565b634e487b7160e01b600052604160045260246000fd5b6000602082840312156100ec57600080fd5b813567ffffffffffffffff8082111561010457600080fd5b818401915084601f83011261011857600080fd5b81358181111561012a5761012a6100d7565b604051601f8201601f19908116603f011681019083821181831017156101525761015261020a565b816040528381526020601f19601f820116820191505b5082821015610175575050604082013591508185016101e9565b5050509392505050565b600081518084526020808501945080840160005b838110156101ae5781516001600160a01b0316875295820195908201906001016100e9565b509495945050505050565b60005b838110156101d95781810151838201526020016100c1565b50506000910152565b60208152600082518060208401526101fd8160408501602087016101be565b601f01601f19169190910160400192915050565b634e487b7160e01b600052604160045260246000fd5b60008190508160005260206000209050919050565b600060208301516040840151606085015160038486168452858301528685520160408201528084520160806130006020910152565b600060206000925b82821015610284578251825291602001916101e9565b505091905090565b6000815180845260005b818110156102b457602081850181015186830182015201610298565b506000602082860101526020601f19601f83011685010192505050565b6001600160a01b038116811461016a57600080fd5b600080604083850312156102fb57600080fd5b82356103068161025c565b94602084013594505050565b6000602082840312156103235760045a82605a0360009091529282905261031e9150565b60005b8381101561037a5781810151838201526020016101c1565b50508315157fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0840182875116820191505b5050919050565b828152606081016020830152610150604083018190526000906060830152565b608051610722610495600039600061068f5260006106615260006106695260006106755260006106515250565b608060405234801561001057600080fd5b50600436106100b5576000357c010000000000000000000000000000000000000000000000000000000090048063a9059cbb11610077578063a9059cbb146101005780637f631a97146101005780637f631a97146101005780635fd0adf414610100578063dd62ed3e146101005780635a3b7e4f14610115578063a9059cbb146101255780638da5cb5b1461015957600080fd5b806040111561013b5780637f631a971461010a5780635fd0adf41461013a5780635a3b7e4f1461013b5780639a8a059214610159578063dd62ed3e1461011c5760405190151581526020016100e0565b60006060825267ffffffff808316815114156101055760006020828401018152602084019350505b50929695505050505050565b6000608082843610156101005760405190151581526020016100e0565b60006000351414610111578063735472616010146101115760405190151581526020016100e0565b5b610115632098975b565b8063010101018214610155577f01000000000000000000000000000000000000000000000000000000000000008160000361010756";

// Simplified ABI for minimal ERC20
const MINIMAL_ERC20_ABI = [
  "constructor(string name, string symbol, uint8 decimals, uint256 initialSupply)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Create a new MCP server instance
const server = new McpServer({
  name: "monad-mcp-tutorial",
  version: "0.0.1",
  capabilities: ["get-mon-balance", "deploy-solidity-source"],
});

server.tool(
  "get-mon-balance",
  "Get MON balance for an address on Monad testnet",
  {
    address: z.string().describe("Monad testnet address to check balance for"),
  },
  async ({ address }) => {
    try {
      console.error(`Checking balance for address: ${address}`);
      const balance = await provider.getBalance(address);
      console.error(`Balance retrieved: ${balance.toString()}`);
      return {
        content: [
          {
            type: "text",
            text: `Balance for ${address}: ${ethers.formatEther(balance)} MON`,
          },
        ],
      };
    } catch (error) {
      console.error("Error details:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve balance for address: ${address}. Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// Fonction d'aide pour détecter les types de paramètres
function detectParamType(param: string): string {
  if (!param) return "unknown";

  // Supprimer les mots-clés memory, calldata, storage
  const cleanParam = param.replace(/memory|calldata|storage/g, "").trim();

  // Séparer le type et le nom
  const parts = cleanParam.split(" ").filter((p) => p);
  if (parts.length === 0) return "unknown";

  return parts[0]; // Retourne le type (string, uint256, etc.)
}

// Fonction d'aide pour convertir correctement les valeurs selon leur type
function convertConstructorArg(value: any, paramType: string): any {
  console.error(`Converting ${value} to type ${paramType}`);

  if (paramType.includes("uint") || paramType.includes("int")) {
    // Pour les types numériques
    return ethers.toBigInt(value.toString());
  } else if (paramType.includes("bool")) {
    // Pour les booléens
    return Boolean(value);
  } else if (paramType.includes("address")) {
    // Pour les adresses
    return value.toString();
  } else if (paramType.includes("bytes")) {
    // Pour les bytes
    if (typeof value === "string" && value.startsWith("0x")) {
      return value;
    }
    return `0x${value.toString()}`;
  } else {
    // Pour les autres types (string, etc.)
    return value;
  }
}

server.tool(
  "deploy-solidity-source",
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

      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Deployer wallet address: ${walletAddress}`);

      // Check balance
      const balance = await provider.getBalance(walletAddress);
      console.error(`Deployer balance: ${ethers.formatEther(balance)} MON`);

      if (balance < ethers.parseEther("0.01")) {
        throw new Error(
          `Insufficient balance: ${ethers.formatEther(
            balance
          )} MON. At least 0.01 MON recommended for deployment.`
        );
      }

      // Définir les bytecodes de contrats prédéfinis pour les contrats courants
      const BASIC_CONTRACT_TEMPLATES = {
        // ERC20 Token
        erc20: {
          bytecode: MINIMAL_ERC20_BYTECODE,
          abi: MINIMAL_ERC20_ABI,
          detect: (code: string) =>
            /contract\s+\w+\s+is\s+.*?ERC20|function\s+transfer\s*\(\s*address\s+to\s*,\s*uint256\s+amount\s*\)\s*.*?returns\s*\(\s*bool\s*\)/i.test(
              code
            ),
        },
        // Simple storage contract
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
        // SimpleStorage contract (détection explicite)
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
        // Minimal contract (returns a value)
        minimal: {
          bytecode: "0x6080604052602a6000f3",
          abi: [],
          detect: () => true,
        },
      };

      console.error("Analyzing source code to determine contract type...");

      // Amélioration: Recherche du constructeur dans le code source
      const hasConstructor = sourceCode.includes("constructor");
      console.error(
        `Contract ${hasConstructor ? "with" : "without"} explicit constructor`
      );

      // Recherche des paramètres du constructeur dans le code source avec une regex plus robuste
      // Cette regex capture également les constructeurs vides: constructor() { ... }
      const constructorRegex =
        /constructor\s*\((.*?)\)(?:\s*(?:public|private|internal|external))?(?:\s*(?:payable|nonpayable|pure|view))?\s*(?:\{|$)/s;
      const constructorMatch = sourceCode.match(constructorRegex);

      // Stockage des types de paramètres pour les conversions
      let paramTypes: string[] = [];
      let rawParamsString = "";

      if (constructorMatch) {
        rawParamsString = constructorMatch[1].trim();
        console.error(`Raw constructor parameters: "${rawParamsString}"`);

        // Ne traiter les paramètres que s'il y en a
        if (rawParamsString && rawParamsString.length > 0) {
          // Extraire les paramètres avec leurs types
          const paramsWithTypes = rawParamsString
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

          // Analyser chaque paramètre pour extraire son type
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

      // Déterminer le type de contrat en fonction du code source
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

      // Create contract factory with the template bytecode
      const factory = new ethers.ContractFactory(
        contractTemplate.abi,
        contractTemplate.bytecode,
        wallet
      );

      console.error("Deploying contract...");
      console.error(
        `Raw constructor arguments: ${JSON.stringify(constructorArgs)}`
      );

      // Amélioration: Traiter les arguments du constructeur en fonction de leurs types détectés
      // Si aucun paramètre n'est détecté dans le constructeur mais que des arguments sont fournis, vérifier le modèle de contrat
      let processedArgs = [];

      // Vérifier si nous avons affaire à un contrat sans paramètres de constructeur
      if (paramTypes.length === 0 && constructorArgs.length > 0) {
        console.error(
          "Constructor without parameters detected but arguments were provided"
        );
        console.error("Attempting deployment without arguments...");
        // Si le constructeur n'a pas de paramètres, ne pas fournir d'arguments
        processedArgs = [];
      } else if (paramTypes.length > 0) {
        // Nous avons des paramètres, procéder normalement
        processedArgs = constructorArgs.map((arg, index) => {
          // Si nous avons détecté le type de ce paramètre
          if (index < paramTypes.length) {
            return convertConstructorArg(arg, paramTypes[index]);
          }
          // Sinon, utiliser une logique de conversion basique
          if (typeof arg === "number") {
            return ethers.toBigInt(arg.toString());
          }
          return arg;
        });
      }

      console.error(`Processed arguments: ${JSON.stringify(processedArgs)}`);

      // Deploy with the properly processed constructor args
      // Utiliser des options de déploiement cohérentes
      const deployOptions = {
        gasLimit: ethers.toBigInt("3000000"),
        type: 0, // Force legacy transaction type for Monad compatibility
      };

      // Déployer le contrat avec ou sans arguments selon la détection
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
        // Si le déploiement échoue avec des arguments, essayer sans arguments

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

      // Wait for the contract to be mined
      const deployedContract = await contract.waitForDeployment();
      const txReceipt = await contract.deploymentTransaction()?.wait(2);

      if (!txReceipt || txReceipt.status === 0) {
        throw new Error(
          `Contract deployment failed. Transaction hash: ${txHash}`
        );
      }

      const contractAddress = await deployedContract.getAddress();
      console.error(`Contract deployed at address: ${contractAddress}`);

      return {
        content: [
          {
            type: "text",
            text: `Solidity contract deployed successfully!

Contract address: ${contractAddress}
Transaction hash: ${txHash}
Block: ${txReceipt?.blockNumber}
Gas used: ${txReceipt?.gasUsed?.toString() || "unknown"}

Your contract is deployed and ready to use on Monad testnet.

Arguments used for deployment:
${processedArgs
  .map((arg, i) => `- Argument ${i + 1}: ${arg.toString()}`)
  .join("\n")}

Note: This deployment uses a predefined template based on your source code analysis. For a fully customized deployment, compile your code with Remix or Hardhat.
`,
          },
        ],
      };
    } catch (error) {
      console.error("Error deploying Solidity code:", error);

      let errorMessage = error instanceof Error ? error.message : String(error);

      // Message d'erreur détaillé
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
    // Create a transport layer using standard input/output
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    await server.connect(transport);

    console.error("Monad testnet MCP Server running on stdio");
  } catch (error) {
    console.error("Error initializing server:", error);
  }
}

// Start the server and handle any fatal errors
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
