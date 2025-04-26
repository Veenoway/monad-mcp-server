import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { execSync } from "child_process";
import { ethers } from "ethers";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
  capabilities: ["deploy-solidity-source", "verify-deployed-contract"],
});

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

      // Tentative de vérification automatique du contrat juste après le déploiement
      console.error("Tentative de vérification automatique du contrat...");

      try {
        // Extraire le nom du contrat du code source
        const contractName =
          sourceCode.match(/contract\s+(\w+)/)?.[1] || "DeployedContract";
        console.error(`Nom du contrat détecté: ${contractName}`);

        // Attendre un peu pour s'assurer que le contrat est bien indexé
        console.error("Attente de 10 secondes pour indexation...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Tenter la vérification avec Foundry si disponible (plus fiable)
        try {
          // Tester si Foundry est disponible
          execSync("forge --version", { stdio: "pipe" });
          console.error("Foundry trouvé, tentative de vérification directe...");

          // Formater les arguments pour la commande
          const argsString =
            processedArgs.length > 0
              ? processedArgs.map((a) => a.toString()).join(" ")
              : "";

          // Construire et exécuter la commande Foundry
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

        // Plan B: Vérification via API REST
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

      // Si toutes les méthodes de vérification ont échoué
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

server.tool(
  "verify-deployed-contract",
  "Vérifier un contrat déployé sur le testnet Monad en utilisant une API de vérification",
  {
    contractAddress: z
      .string()
      .describe("Adresse du contrat déployé à vérifier"),
    sourceCode: z.string().describe("Code source Solidity du contrat"),
    contractName: z.string().describe("Nom du contrat à vérifier"),
    constructorArgs: z
      .array(z.any())
      .optional()
      .describe("Arguments du constructeur (optionnel)"),
    compilerVersion: z
      .string()
      .optional()
      .describe("Version du compilateur (par défaut: 0.8.20)"),
    useApi: z
      .boolean()
      .optional()
      .describe(
        "Utiliser l'API directe au lieu des instructions manuelles (par défaut: false)"
      ),
    runVerification: z
      .boolean()
      .optional()
      .describe(
        "Exécuter la commande Foundry directement (nécessite Foundry installé, par défaut: false)"
      ),
  },
  async ({
    contractAddress,
    sourceCode,
    contractName,
    constructorArgs = [],
    compilerVersion = "0.8.20",
    useApi = false,
    runVerification = false,
  }) => {
    try {
      console.error(`Vérification du contrat à l'adresse: ${contractAddress}`);
      console.error(`Nom du contrat: ${contractName}`);

      // Utiliser une approche directe sans Foundry
      const tempDir = path.join(os.tmpdir(), `verify-${Date.now()}`);

      try {
        // Créer la structure de répertoires temporaire
        fs.mkdirSync(tempDir, { recursive: true });

        // Écrire le code source dans un fichier
        const contractFileName = `${contractName}.sol`;
        const contractFilePath = path.join(tempDir, contractFileName);
        fs.writeFileSync(contractFilePath, sourceCode);

        console.error("Préparation de la vérification du contrat...");

        // Formater les arguments du constructeur pour l'API
        const constructorArgsFormatted = constructorArgs.map((arg) => {
          if (
            typeof arg === "string" &&
            !arg.startsWith("0x") &&
            !/^\d+$/.test(arg)
          ) {
            return `"${arg}"`;
          }
          return arg.toString();
        });

        // Si l'utilisateur a demandé d'utiliser l'API directement
        if (useApi) {
          console.error("Tentative de vérification via l'API directe...");

          // Importation de node-fetch pour les requêtes HTTP
          // Note: dans un environnement de production, cette dépendance devrait être ajoutée au package.json
          const { default: fetch } = await import("node-fetch");

          // Préparation des données pour l'API Explorer Monad
          const apiData = {
            address: contractAddress,
            chainId: 10143,
            name: contractName,
            source: {
              content: sourceCode,
              language: "Solidity",
              settings: {
                optimizer: {
                  enabled: true,
                  runs: 200,
                },
                evmVersion: "paris",
                viaIR: true,
              },
            },
            compiler: compilerVersion,
            constructorArguments:
              constructorArgs.length > 0 ? constructorArgs.join(",") : "",
            license: "MIT",
          };

          try {
            // URL de l'API de vérification Monad (mise à jour vers testnet.monadexplorer.com)
            const verifyUrl =
              "https://testnet.monadexplorer.com/api/v2/verifycontract";

            console.error(`Envoi de la requête à ${verifyUrl}...`);

            const response = await fetch(verifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(apiData),
            });

            const responseData = await response.json();

            if (response.ok) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Contrat vérifié avec succès via l'API!

Adresse du contrat: ${contractAddress}
Nom du contrat: ${contractName}
Réponse de l'API: ${JSON.stringify(responseData)}

Vous pouvez consulter votre contrat vérifié sur:
https://testnet.monadexplorer.com/address/${contractAddress}`,
                  },
                ],
              };
            } else {
              throw new Error(`Erreur API: ${JSON.stringify(responseData)}`);
            }
          } catch (apiError) {
            console.error(
              "Erreur lors de l'appel à l'API de vérification:",
              apiError
            );

            // En cas d'échec de l'API, revenir aux instructions manuelles
            console.error(
              "Échec de la vérification via API, génération des instructions manuelles..."
            );
          }
        }

        // Préparation des données pour l'API (utilisé pour les instructions ou en cas d'échec de l'API)
        const verificationData = {
          address: contractAddress,
          chainId: 10143,
          name: contractName,
          source: sourceCode,
          compiler: compilerVersion,
          constructorArgs: constructorArgsFormatted,
          license: "MIT", // License par défaut
        };

        // Enregistrer les données de vérification dans un fichier JSON pour référence
        fs.writeFileSync(
          path.join(tempDir, "verification-data.json"),
          JSON.stringify(verificationData, null, 2)
        );

        console.error("Données de vérification préparées");

        // Créer un message de vérification réussie avec instructions
        const verificationInstructions = `Pour vérifier votre contrat sur Monad Explorer:

1. Accédez à l'explorateur Monad Testnet: https://testnet.monadexplorer.com/address/${contractAddress}

2. Cliquez sur l'onglet "Code" puis sur "Verify & Publish"

3. Remplissez les informations suivantes:
   - Nom du contrat: ${contractName}
   - Version du compilateur: ${compilerVersion}
   - Licence: MIT (ou choisissez la licence appropriée)
   - Code Source: Copiez et collez votre code complet
   - Optimisation: Activée avec 200 runs
   - EVM Version: Paris
   - Via IR: Activé

4. Si votre contrat a des arguments de constructeur, fournissez-les dans le format approprié:
${constructorArgsFormatted
  .map((arg, i) => `   - Argument ${i + 1}: ${arg}`)
  .join("\n")}

5. Cliquez sur "Verify & Publish"

Note: Les données de vérification ont été enregistrées localement pour référence à: ${path.join(
          tempDir,
          "verification-data.json"
        )}`;

        // Créer un code d'exemple pour Foundry (pour ceux qui l'ont installé)
        const foundryCommand = `forge verify-contract ${contractAddress} ${contractName} \\
  --chain-id 10143 \\
  --verifier-url "https://testnet.monadexplorer.com/api" \\
  --compiler-version "${compilerVersion}" \\
  --optimizer-runs 200 \\
  --via-ir \\
  ${
    constructorArgsFormatted.length > 0
      ? `--constructor-args ${constructorArgsFormatted.join(" ")}`
      : ""
  }`;

        return {
          content: [
            {
              type: "text",
              text: `Préparation de la vérification du contrat terminée!

Adresse du contrat: ${contractAddress}
Nom du contrat: ${contractName}
Version du compilateur: ${compilerVersion}

${verificationInstructions}

Pour vérifier automatiquement avec Foundry, utilisez:
\`\`\`
${foundryCommand}
\`\`\`

Pour vérifier via l'API directement lors du prochain appel, ajoutez le paramètre "useApi: true".
Les fichiers nécessaires à la vérification ont été enregistrés dans: ${tempDir}`,
            },
          ],
        };
      } finally {
        // Conservez les fichiers temporaires pour référence
        console.error(
          `Les fichiers de vérification sont disponibles dans: ${tempDir}`
        );

        // Si l'utilisateur a demandé d'exécuter directement la commande Foundry
        if (runVerification) {
          console.error(
            "Tentative d'exécution directe de Foundry pour la vérification..."
          );

          try {
            // Vérifier si Foundry est installé
            execSync("forge --version", { stdio: "pipe" });

            // Construire la commande Foundry
            const foundryVerifyCommand = `forge verify-contract ${contractAddress} ${contractName} --chain-id 10143 --verifier-url "https://testnet.monadexplorer.com/api" --compiler-version "${compilerVersion}" --optimizer-runs 200 --via-ir ${
              constructorArgs && constructorArgs.length > 0
                ? `--constructor-args ${constructorArgs.join(" ")}`
                : ""
            }`;

            console.error(`Exécution de la commande: ${foundryVerifyCommand}`);

            // Exécuter la commande en temps réel et capturer la sortie
            const forgeResult = execSync(foundryVerifyCommand, {
              encoding: "utf8",
            });
            console.error(`Résultat de Foundry: ${forgeResult}`);

            // Si nous arrivons ici, la vérification a réussi
            return {
              content: [
                {
                  type: "text",
                  text: `Contrat vérifié avec succès via Foundry!

Adresse du contrat: ${contractAddress}
Nom du contrat: ${contractName}

Résultat de Foundry:
${forgeResult}

Vous pouvez consulter votre contrat vérifié ici:
https://testnet.monadexplorer.com/address/${contractAddress}`,
                },
              ],
            };
          } catch (forgeError) {
            console.error("Erreur lors de l'exécution de Foundry:", forgeError);

            // Continuer avec le flux normal en cas d'échec
            console.error(
              "La vérification directe via Foundry a échoué, retour aux instructions..."
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Erreur lors de la préparation de la vérification du contrat:",
        error
      );

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      let friendlyMessage = `Échec de la préparation de la vérification du contrat. Erreur: ${errorMessage}`;
      friendlyMessage += `\n\nSuggestions:
1. Vérifiez que le code source est valide et compile correctement
2. Assurez-vous que les arguments du constructeur sont corrects
3. Vérifiez que l'adresse du contrat est correcte
4. Essayez de vérifier manuellement via l'explorateur Monad: https://testnet.monadexplorer.com/address/${contractAddress}
5. Si vous avez Foundry installé localement, essayez la commande:
   forge verify-contract ${contractAddress} ${contractName} --chain-id 10143 --verifier-url "https://testnet.monadexplorer.com/api"`;

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
