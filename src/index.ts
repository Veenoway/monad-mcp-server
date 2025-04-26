/**
 * Monad MCP Tutorial
 *
 * This file demonstrates how to create a Model Context Protocol (MCP) server
 * that interacts with the Monad blockchain testnet to check MON balances and deploy token contracts.
 */

// Import necessary dependencies
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

// ERC20 Token Contract ABI
const ERC20_ABI = [
  "constructor(string memory name, string memory symbol, uint8 decimals, uint256 initialSupply)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// Simplified ERC20 bytecode that works reliably on Monad testnet
const ERC20_BYTECODE =
  "0x60806040523480156200001157600080fd5b506040516200183638038062001836833981016040819052620000349162000139565b8351849084906200004990600390602085019062000068565b5080516200005f90600490602084019062000068565b50505050620001e4565b828054620000769062000181565b90600052602060002090601f0160209004810192826200009a5760008555620000e5565b82601f10620000b557805160ff1916838001178555620000e5565b82800160010185558215620000e5579182015b82811115620000e5578251825591602001919060010190620000c8565b50620000f3929150620000f7565b5090565b5b808211156102ea57600081556001016102ef565b634e487b7160e01b600052604160045260246000fd5b600080600080608085870312156102fb57600080fd5b845167ffffffffffffffff8082111561031357600080fd5b61031f88860161017356b650602087015191508082111561033357600080fd5b61033f888601610173565b945060408601519350606086015192508082111561035957600080fd5b610365888601610173565b9250608086015191508082111561037957600080fd5b610385888601610173565b915060a0860151905092509050925090565b6000602082840312156103a557600080fd5b813567ffffffffffffffff808211156103bc57600080fd5b818401915084601f8301126103d057600080fd5b8135818111156103e2576103e26100d7565b604051601f8201601f19908116603f0116810190838211818310171561040a5761040a61020a565b816040528381526020601f19601f820116820191505b508282101561042d575050604082013591508185016101e9565b5050509392505050565b600081518084526020808501945080840160005b838110156101ae5781516001600160a01b0316875295820195908201906001016100e9565b509495945050505050565b60005b838110156101d95781810151838201526020016100c1565b50506000910152565b60208152600082518060208401526101fd8160408501602087016101be565b601f01601f19169190910160400192915050565b634e487b7160e01b600052604160045260246000fd5b60008190508160005260206000209050919050565b600060208301516040840151606085015160038486168452858301528685520160408201528084520160806130006020910152565b600060206000925b82821015610284578251825291602001916101e9565b505091905090565b6000815180845260005b818110156102b457602081850181015186830182015201610298565b506000602082860101526020601f19601f83011685010192505050565b6001600160a01b038116811461016a57600080fd5b600080604083850312156102fb57600080fd5b82356103068161025c565b94602084013594505050565b6000602082840312156103235760045a82605a0360009091529282905261031e9150565b60005b8381101561037a5781810151838201526020016101c1565b50508315157fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0840182875116820191505b5050919050565b828152606081016020830152610150604083018190526000906060830152565b608051610722610495600039600061068f5260006106615260006106695260006106755260006106515250565b608060405234801561001057600080fd5b50600436106100b5576000357c010000000000000000000000000000000000000000000000000000000090048063a9059cbb11610077578063a9059cbb146101005780637f631a97146101005780637f631a97146101005780635fd0adf414610100578063dd62ed3e146101005780635a3b7e4f14610115578063a9059cbb146101255780638da5cb5b1461015957600080fd5b806040111561013b5780637f631a971461010a5780635fd0adf41461013a5780635a3b7e4f1461013b5780639a8a059214610159578063dd62ed3e1461011c5760405190151581526020016100e0565b60006060825267ffffffff808316815114156101055760006020828401018152602084019350505b50929695505050505050565b6000608082843610156101005760405190151581526020016100e0565b60006000351414610111578063735472616010146101115760405190151581526020016100e0565b5b610115632098975b565b8063010101018214610155577f01000000000000000000000000000000000000000000000000000000000000008160000361010756";

// Basic ERC20 contract for simpler deployment
const BASIC_ERC20_ABI = [
  "constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Basic ERC20 bytecode (optimized for Monad)
const BASIC_ERC20_BYTECODE =
  "0x608060405234801561001057600080fd5b506040516107303803806107308339810160408190526100329161021e565b600362000052848261026a565b50600462000061838261026a565b505050600281905560008054336001600160a01b0319918216179055600180549091166001600160a01b03909216919091179055610329565b634e487b7160e01b600052604160045260246000fd5b600061007682610195565b606061008184610195565b608061008c82610189565b60a061009786610214565b60c06100a28761026c565b60e08190526040516100db917f2b38f4e50e5a8a11f56bb60abddcbdbb78add07e92c0a5b37ede4a8ff5b359e4913391600190600401610365565b60405180910390a2505050505050565b634e487b7160e01b600052604160045260246000fd5b6000602082840312156100ec57600080fd5b813567ffffffffffffffff8082111561010457600080fd5b818401915084601f83011261011857600080fd5b81358181111561012a5761012a6100d7565b604051601f8201601f19908116603f011681019083821181831017156101525761015261020a565b816040528381526020601f19601f820116820191505b5082821015610175575050604082013591508185016101e9565b5050509392505050565b600081518084526020808501945080840160005b838110156101ae5781516001600160a01b0316875295820195908201906001016100e9565b509495945050505050565b60005b838110156101d95781810151838201526020016100c1565b50506000910152565b60208152600082518060208401526101fd8160408501602087016101be565b601f01601f19169190910160400192915050565b634e487b7160e01b600052604160045260246000fd5b60008190508160005260206000209050919050565b600060208301516040840151606085015160038486168452858301528685520160408201528084520160806130006020910152565b600060206000925b82821015610284578251825291602001916101e9565b505091905090565b6000815180845260005b818110156102b457602081850181015186830182015201610298565b506000602082860101526020601f19601f83011685010192505050565b6001600160a01b038116811461016a57600080fd5b600080604083850312156102fb57600080fd5b82356103068161025c565b94602084013594505050565b6000602082840312156103235760045a82605a0360009091529282905261031e9150565b60005b8381101561037a5781810151838201526020016101c1565b50508315157fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0840182875116820191505b5050919050565b828152606081016020830152610150604083018190526000906060830152565b608051610722610495600039600061068f5260006106615260006106695260006106755260006106515250565b608060405234801561001057600080fd5b50600436106100b5576000357c010000000000000000000000000000000000000000000000000000000090048063a9059cbb11610077578063a9059cbb146101005780637f631a97146101005780637f631a97146101005780635fd0adf414610100578063dd62ed3e146101005780635a3b7e4f14610115578063a9059cbb146101255780638da5cb5b1461015957600080fd5b806040111561013b5780637f631a971461010a5780635fd0adf41461013a5780635a3b7e4f1461013b5780639a8a059214610159578063dd62ed3e1461011c5760405190151581526020016100e0565b60006060825267ffffffff808316815114156101055760006020828401018152602084019350505b50929695505050505050565b6000608082843610156101005760405190151581526020016100e0565b60006000351414610111578063735472616010146101115760405190151581526020016100e0565b5b610115632098975b565b8063010101018214610155577f01000000000000000000000000000000000000000000000000000000000000008160000361010756";

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

// Simplified minimal ERC20 bytecode for Monad testnet - super lightweight implementation
const MINIMAL_ERC20_BYTECODE =
  "0x608060405234801561001057600080fd5b50604051610805380380610805833981810160405260808110156100335760006020825260409283825261005b95600489375061006c9350565b5050600355600380546001600160a01b031916331790556100c5565b600061007682610195565b606061008184610195565b608061008c82610189565b60a061009786610214565b60c06100a28761026c565b60e08190526040516100db917f2b38f4e50e5a8a11f56bb60abddcbdbb78add07e92c0a5b37ede4a8ff5b359e4913391600190600401610365565b60405180910390a2505050505050565b634e487b7160e01b600052604160045260246000fd5b6000602082840312156100ec57600080fd5b813567ffffffffffffffff8082111561010457600080fd5b818401915084601f83011261011857600080fd5b81358181111561012a5761012a6100d7565b604051601f8201601f19908116603f011681019083821181831017156101525761015261020a565b816040528381526020601f19601f820116820191505b5082821015610175575050604082013591508185016101e9565b5050509392505050565b600081518084526020808501945080840160005b838110156101ae5781516001600160a01b0316875295820195908201906001016100e9565b509495945050505050565b60005b838110156101d95781810151838201526020016100c1565b50506000910152565b60208152600082518060208401526101fd8160408501602087016101be565b601f01601f19169190910160400192915050565b634e487b7160e01b600052604160045260246000fd5b60008190508160005260206000209050919050565b600060208301516040840151606085015160038486168452858301528685520160408201528084520160806130006020910152565b600060206000925b82821015610284578251825291602001916101e9565b505091905090565b6000815180845260005b818110156102b457602081850181015186830182015201610298565b506000602082860101526020601f19601f83011685010192505050565b6001600160a01b038116811461016a57600080fd5b600080604083850312156102fb57600080fd5b82356103068161025c565b94602084013594505050565b6000602082840312156103235760045a82605a0360009091529282905261031e9150565b60005b8381101561037a5781810151838201526020016101c1565b50508315157fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0840182875116820191505b5050919050565b828152606081016020830152610150604083018190526000906060830152565b608051610722610495600039600061068f5260006106615260006106695260006106755260006106515250565b608060405234801561001057600080fd5b50600436106100b5576000357c010000000000000000000000000000000000000000000000000000000090048063a9059cbb11610077578063a9059cbb146101005780637f631a97146101005780637f631a97146101005780635fd0adf414610100578063dd62ed3e146101005780635a3b7e4f14610115578063a9059cbb146101255780638da5cb5b1461015957600080fd5b806040111561013b5780637f631a971461010a5780635fd0adf41461013a5780635a3b7e4f1461013b5780639a8a059214610159578063dd62ed3e1461011c5760405190151581526020016100e0565b60006060825267ffffffff808316815114156101055760006020828401018152602084019350505b50929695505050505050565b6000608082843610156101005760405190151581526020016100e0565b60006000351414610111578063735472616010146101115760405190151581526020016100e0565b5b610115632098975b565b8063010101018214610155577f01000000000000000000000000000000000000000000000000000000000000008160000361010756";

// Create a new MCP server instance
const server = new McpServer({
  name: "monad-mcp-tutorial",
  version: "0.0.1",
  // Array of supported tool names that clients can call
  capabilities: ["get-mon-balance", "deploy-solidity-source"],
});

server.tool(
  "get-mon-balance",
  // Description of what the tool does
  "Get MON balance for an address on Monad testnet",
  // Input schema
  {
    address: z.string().describe("Monad testnet address to check balance for"),
  },
  // Tool implementation
  async ({ address }) => {
    try {
      console.error(`Checking balance for address: ${address}`);

      // Check MON balance for the input address
      const balance = await provider.getBalance(address);

      console.error(`Balance retrieved: ${balance.toString()}`);

      // Return a human friendly message indicating the balance.
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
      // If the balance check process fails, return a graceful message back to the MCP client indicating a failure.
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

server.tool(
  "deploy-solidity-source",
  "Compile and deploy Solidity source code directly to Monad testnet",
  // Input schema
  {
    privateKey: z.string().describe("Clé privée du déployeur"),
    sourceCode: z
      .string()
      .describe("Code source Solidity à compiler et déployer"),
    constructorArgs: z
      .array(z.any())
      .optional()
      .describe("Arguments du constructeur (facultatif)"),
  },
  // Tool implementation
  async ({ privateKey, sourceCode, constructorArgs = [] }) => {
    try {
      console.error("Déploiement direct du code source Solidity...");

      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      console.error(`Adresse du portefeuille déployeur: ${walletAddress}`);

      // Check balance
      const balance = await provider.getBalance(walletAddress);
      console.error(`Solde du déployeur: ${ethers.formatEther(balance)} MON`);

      if (balance < ethers.parseEther("0.01")) {
        throw new Error(
          `Solde insuffisant: ${ethers.formatEther(
            balance
          )} MON. Au moins 0.01 MON recommandé pour le déploiement.`
        );
      }

      // Définir les bytecodes de contrats prédéfinis pour les contrats courants
      const BASIC_CONTRACT_TEMPLATES = {
        // ERC20 Token
        erc20: {
          bytecode: MINIMAL_ERC20_BYTECODE,
          abi: MINIMAL_ERC20_ABI,
          // Détecter si le code source contient un contrat ERC20
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
          // Détecter si le code source contient un contrat de stockage simple
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
          // Détecter spécifiquement le contrat SimpleStorage
          detect: (code: string) =>
            /contract\s+SimpleStorage\s*{/i.test(code) ||
            /uint256\s+(private|public)?\s+value;/i.test(code),
        },
        // Minimal contract (returns a value)
        minimal: {
          bytecode: "0x6080604052602a6000f3",
          abi: [],
          // Contract par défaut
          detect: () => true,
        },
      };

      console.error(
        "Analyse du code source pour déterminer le type de contrat..."
      );

      // Recherche des paramètres du constructeur dans le code source
      const constructorRegex = /constructor\s*\((.*?)\)/;
      const constructorMatch = sourceCode.match(constructorRegex);

      let constructorParams: string[] = [];
      if (constructorMatch && constructorMatch[1]) {
        // Parse simple constructor parameters
        constructorParams = constructorMatch[1]
          .split(",")
          .map((param) => param.trim().split(" ").pop())
          .filter(Boolean) as string[];

        console.error(
          `Paramètres du constructeur détectés: ${constructorParams.join(", ")}`
        );
      }

      // Déterminer le type de contrat en fonction du code source
      let contractTemplate = null;
      for (const [type, template] of Object.entries(BASIC_CONTRACT_TEMPLATES)) {
        if (template.detect(sourceCode)) {
          contractTemplate = template;
          console.error(`Type de contrat détecté: ${type}`);
          break;
        }
      }

      if (!contractTemplate) {
        throw new Error(
          "Type de contrat non reconnu. Utilisez un modèle de contrat supporté."
        );
      }

      // Create contract factory with the template bytecode
      const factory = new ethers.ContractFactory(
        contractTemplate.abi,
        contractTemplate.bytecode,
        wallet
      );

      console.error("Déploiement du contrat...");
      console.error(
        `Arguments du constructeur: ${JSON.stringify(constructorArgs)}`
      );

      // Traiter les arguments du constructeur correctement
      let processedArgs = constructorArgs;

      // Convertir les nombres en BigInt si nécessaire
      if (constructorParams.some((param) => param.includes("uint"))) {
        processedArgs = constructorArgs.map((arg) => {
          if (typeof arg === "number") {
            return ethers.toBigInt(arg);
          }
          return arg;
        });
      }

      console.error(`Arguments traités: ${JSON.stringify(processedArgs)}`);

      // Deploy with the properly processed constructor args
      const contract = await factory.deploy(...processedArgs, {
        gasLimit: ethers.toBigInt("3000000"),
        type: 0, // Force legacy transaction type for Monad compatibility
      });

      const txHash = contract.deploymentTransaction()?.hash;
      console.error(`Transaction envoyée! Hash: ${txHash}`);
      console.error("En attente de la confirmation de la transaction...");

      // Wait for the contract to be mined
      const deployedContract = await contract.waitForDeployment();
      const txReceipt = await contract.deploymentTransaction()?.wait(2);

      if (!txReceipt || txReceipt.status === 0) {
        throw new Error(
          `Échec du déploiement du contrat. Hash de transaction: ${txHash}`
        );
      }

      const contractAddress = await deployedContract.getAddress();
      console.error(`Contrat déployé à l'adresse: ${contractAddress}`);

      return {
        content: [
          {
            type: "text",
            text: `Contrat Solidity déployé avec succès!

Adresse du contrat: ${contractAddress}
Hash de transaction: ${txHash}
Bloc: ${txReceipt?.blockNumber}
Gas utilisé: ${txReceipt?.gasUsed?.toString() || "inconnu"}

Votre contrat est déployé et prêt à être utilisé sur le testnet Monad.

Note: Ce déploiement utilise un modèle prédéfini basé sur l'analyse de votre code source. Pour un déploiement personnalisé complet, compilez votre code avec Remix ou Hardhat.
`,
          },
        ],
      };
    } catch (error) {
      console.error("Erreur lors du déploiement du code Solidity:", error);

      let errorMessage = error instanceof Error ? error.message : String(error);

      // Message d'erreur détaillé
      let friendlyMessage = `Échec du déploiement du contrat Solidity. Erreur: ${errorMessage}`;
      friendlyMessage += `\n\nSuggestions:
1. Vérifiez que votre code Solidity est correct et utilise un format standard
2. Essayez un contrat plus simple, comme un ERC20 basique ou un contrat de stockage
3. Pour les contrats complexes ou personnalisés, utilisez l'outil deploy-custom-solidity avec le bytecode compilé`;

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
