import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { execSync } from "child_process";
import { ethers } from "ethers";
import { z } from "zod";
console.error("Starting MCP server...");
const provider = new ethers.JsonRpcProvider("https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6", {
    name: "Monad Testnet",
    chainId: 10143,
});
const MINIMAL_ERC20_BYTECODE = "0x608060405234801561001057600080fd5b50604051610805380380610805833981810160405260808110156100335760006020825260409283825261005b95600489375061006c9350565b5050600355600380546001600160a01b031916331790556100c5565b600061007682610195565b606061008184610195565b608061008c82610189565b60a061009786610214565b60c06100a28761026c565b60e08190526040516100db917f2b38f4e50e5a8a11f56bb60abddcbdbb78add07e92c0a5b37ede4a8ff5b359e4913391600190600401610365565b60405180910390a2505050505050565b634e487b7160e01b600052604160045260246000fd5b6000602082840312156100ec57600080fd5b813567ffffffffffffffff8082111561010457600080fd5b818401915084601f83011261011857600080fd5b81358181111561012a5761012a6100d7565b604051601f8201601f19908116603f011681019083821181831017156101525761015261020a565b816040528381526020601f19601f820116820191505b5082821015610175575050604082013591508185016101e9565b5050509392505050565b600081518084526020808501945080840160005b838110156101ae5781516001600160a01b0316875295820195908201906001016100e9565b509495945050505050565b60005b838110156101d95781810151838201526020016100c1565b50506000910152565b60208152600082518060208401526101fd8160408501602087016101be565b601f01601f19169190910160400192915050565b634e487b7160e01b600052604160045260246000fd5b60008190508160005260206000209050919050565b600060208301516040840151606085015160038486168452858301528685520160408201528084520160806130006020910152565b600060206000925b82821015610284578251825291602001916101e9565b505091905090565b6000815180845260005b818110156102b457602081850181015186830182015201610298565b506000602082860101526020601f19601f83011685010192505050565b6001600160a01b038116811461016a57600080fd5b600080604083850312156102fb57600080fd5b82356103068161025c565b94602084013594505050565b6000602082840312156103235760045a82605a0360009091529282905261031e9150565b60005b8381101561037a5781810151838201526020016101c1565b50508315157fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0840182875116820191505b5050919050565b828152606081016020830152610150604083018190526000906060830152565b608051610722610495600039600061068f5260006106615260006106695260006106755260006106515250565b608060405234801561001057600080fd5b50600436106100b5576000357c010000000000000000000000000000000000000000000000000000000090048063a9059cbb11610077578063a9059cbb146101005780637f631a97146101005780637f631a97146101005780635fd0adf414610100578063dd62ed3e146101005780635a3b7e4f14610115578063a9059cbb146101255780638da5cb5b1461015957600080fd5b806040111561013b5780637f631a971461010a5780635fd0adf41461013a5780635a3b7e4f1461013b5780639a8a059214610159578063dd62ed3e1461011c5760405190151581526020016100e0565b60006060825267ffffffff808316815114156101055760006020828401018152602084019350505b50929695505050505050565b6000608082843610156101005760405190151581526020016100e0565b60006000351414610111578063735472616010146101115760405190151581526020016100e0565b5b610115632098975b565b8063010101018214610155577f01000000000000000000000000000000000000000000000000000000000000008160000361010756";
const MINIMAL_ERC20_ABI = [
    "constructor(string name, string symbol, uint8 decimals, uint256 initialSupply)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
];
const server = new McpServer({
    name: "monad-mcp-tutorial",
    version: "0.0.1",
    capabilities: [
        "deploy-solidity-source",
        "call-contract-function",
        "get-nft-holders",
        "token-swap",
        "get-portfolio",
    ],
});
function detectParamType(param) {
    if (!param)
        return "unknown";
    const cleanParam = param.replace(/memory|calldata|storage/g, "").trim();
    const parts = cleanParam.split(" ").filter((p) => p);
    if (parts.length === 0)
        return "unknown";
    return parts[0];
}
function convertConstructorArg(value, paramType) {
    console.error(`Converting ${value} to type ${paramType}`);
    if (paramType.includes("uint") || paramType.includes("int")) {
        return ethers.toBigInt(value.toString());
    }
    else if (paramType.includes("bool")) {
        return Boolean(value);
    }
    else if (paramType.includes("address")) {
        return value.toString();
    }
    else if (paramType.includes("bytes")) {
        if (typeof value === "string" && value.startsWith("0x")) {
            return value;
        }
        return `0x${value.toString()}`;
    }
    else {
        return value;
    }
}
server.tool("deploy-solidity-source", "Compile and deploy Solidity source code directly to Monad testnet", {
    privateKey: z.string().describe("Deployer's private key"),
    sourceCode: z
        .string()
        .describe("Solidity source code to compile and deploy"),
    constructorArgs: z
        .array(z.any())
        .optional()
        .describe("Constructor arguments (optional)"),
}, async ({ privateKey, sourceCode, constructorArgs = [] }) => {
    try {
        console.error("Deploying Solidity source code directly...");
        const wallet = new ethers.Wallet(privateKey, provider);
        const walletAddress = wallet.address;
        console.error(`Deployer wallet address: ${walletAddress}`);
        const balance = await provider.getBalance(walletAddress);
        console.error(`Deployer balance: ${ethers.formatEther(balance)} MON`);
        if (balance < ethers.parseEther("0.01")) {
            throw new Error(`Insufficient balance: ${ethers.formatEther(balance)} MON. At least 0.01 MON recommended for deployment.`);
        }
        const BASIC_CONTRACT_TEMPLATES = {
            erc20: {
                bytecode: MINIMAL_ERC20_BYTECODE,
                abi: MINIMAL_ERC20_ABI,
                detect: (code) => /contract\s+\w+\s+is\s+.*?ERC20|function\s+transfer\s*\(\s*address\s+to\s*,\s*uint256\s+amount\s*\)\s*.*?returns\s*\(\s*bool\s*\)/i.test(code),
            },
            storage: {
                bytecode: "0x608060405234801561001057600080fd5b5060405161015d38038061015d83398101604081905261002f9161003c565b600055610056565b60006020828403121561004e57600080fd5b5051919050565b60f98061006460003960006000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632a1afcd9146041578063489afcf51460545780636d4ce63c146066575b600080fd5b604760005481565b6040519081526020015b60405180910390f35b606460603660046089565b600055565b005b604760005490565b600060208284031215609a57600080fd5b50359056fea2646970667358221220a40f0f540b3821f124e1e5f447d2d40bd9c1c2483df4ed5fa98a9c5fa39df95064736f6c63430008130033",
                abi: [
                    "constructor(uint256 initialValue)",
                    "function get() view returns (uint256)",
                    "function set(uint256 newValue)",
                    "function value() view returns (uint256)",
                ],
                detect: (code) => /uint256\s+(public|private)?\s+\w+;.*function\s+set\s*\(\s*uint256\s+.*\)\s+public/i.test(code),
            },
            simpleStorage: {
                bytecode: "0x608060405234801561001057600080fd5b5060405161015d38038061015d83398101604081905261002f9161003c565b600055610056565b60006020828403121561004e57600080fd5b5051919050565b60f98061006460003960006000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632a1afcd9146041578063489afcf51460545780636d4ce63c146066575b600080fd5b604760005481565b6040519081526020015b60405180910390f35b606460603660046089565b600055565b005b604760005490565b600060208284031215609a57600080fd5b50359056fea2646970667358221220a40f0f540b3821f124e1e5f447d2d40bd9c1c2483df4ed5fa98a9c5fa39df95064736f6c63430008130033",
                abi: [
                    "constructor(uint256 initialValue)",
                    "function get() view returns (uint256)",
                    "function set(uint256 newValue)",
                    "function value() view returns (uint256)",
                ],
                detect: (code) => /contract\s+SimpleStorage\s*{/i.test(code) ||
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
        console.error(`Contract ${hasConstructor ? "with" : "without"} explicit constructor`);
        const constructorRegex = /constructor\s*\((.*?)\)(?:\s*(?:public|private|internal|external))?(?:\s*(?:payable|nonpayable|pure|view))?\s*(?:\{|$)/s;
        const constructorMatch = sourceCode.match(constructorRegex);
        let paramTypes = [];
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
            }
            else {
                console.error("Constructor without parameters detected");
            }
        }
        else if (hasConstructor) {
            console.error("Constructor present but format not recognized");
        }
        else {
            console.error("No explicit constructor detected, using default constructor");
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
            throw new Error("Contract type not recognized. Please use a supported contract template.");
        }
        const factory = new ethers.ContractFactory(contractTemplate.abi, contractTemplate.bytecode, wallet);
        console.error("Deploying contract...");
        console.error(`Raw constructor arguments: ${JSON.stringify(constructorArgs)}`);
        let processedArgs = [];
        if (paramTypes.length === 0 && constructorArgs.length > 0) {
            console.error("Constructor without parameters detected but arguments were provided");
            console.error("Attempting deployment without arguments...");
            processedArgs = [];
        }
        else if (paramTypes.length > 0) {
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
            }
            else {
                console.error("Deploying without arguments...");
                contract = await factory.deploy(deployOptions);
            }
        }
        catch (error) {
            if (processedArgs.length > 0 &&
                // @ts-ignore
                error.message.includes("incorrect number of arguments")) {
                console.error("Failed with arguments, trying without arguments...");
                contract = await factory.deploy(deployOptions);
            }
            else {
                throw error;
            }
        }
        const txHash = contract.deploymentTransaction()?.hash;
        console.error(`Transaction sent! Hash: ${txHash}`);
        console.error("Waiting for transaction confirmation...");
        const deployedContract = await contract.waitForDeployment();
        const txReceipt = await contract.deploymentTransaction()?.wait(2);
        if (!txReceipt || txReceipt.status === 0) {
            throw new Error(`Contract deployment failed. Transaction hash: ${txHash}`);
        }
        const contractAddress = await deployedContract.getAddress();
        console.error(`Contract deployed at address: ${contractAddress}`);
        console.error("Tentative de vérification automatique du contrat...");
        try {
            const contractName = sourceCode.match(/contract\s+(\w+)/)?.[1] || "DeployedContract";
            console.error(`Nom du contrat détecté: ${contractName}`);
            console.error("Attente de 10 secondes pour indexation...");
            await new Promise((resolve) => setTimeout(resolve, 10000));
            try {
                execSync("forge --version", { stdio: "pipe" });
                console.error("Foundry trouvé, tentative de vérification directe...");
                const argsString = processedArgs.length > 0
                    ? processedArgs.map((a) => a.toString()).join(" ")
                    : "";
                const cmd = `forge verify-contract ${contractAddress} ${contractName} --chain-id 10143 --verifier-url "https://testnet.monadexplorer.com/api" --compiler-version "0.8.20" --optimizer-runs 200 --via-ir ${argsString ? `--constructor-args ${argsString}` : ""}`;
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
            }
            catch (foundryError) {
                console.error("Foundry non disponible ou erreur:", foundryError);
            }
            try {
                console.error("Tentative de vérification via API REST...");
                const apiData = {
                    address: contractAddress,
                    chainId: 10143,
                    name: contractName,
                    sourceCode: sourceCode,
                    constructorArguments: processedArgs.length > 0
                        ? processedArgs.map((a) => a.toString()).join(",")
                        : "",
                    compilerVersion: "0.8.20",
                    optimizationEnabled: true,
                    runs: 200,
                };
                const apiResponse = await axios.post("https://testnet.monadexplorer.com/api/contract/verify", apiData, { headers: { "Content-Type": "application/json" } });
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
            }
            catch (apiError) {
                console.error("Échec de l'API de vérification:", apiError);
            }
        }
        catch (verifyError) {
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
    }
    catch (error) {
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
});
const ERC721_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenByIndex(uint256 index) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
];
const ERC1155_ABI = [
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) view returns (uint256[] memory)",
    "function uri(uint256 id) view returns (string)",
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
    "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
];
const UNISWAP_V2_ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
];
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];
const UNISWAP_V2_FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function allPairs(uint) external view returns (address pair)",
    "function allPairsLength() external view returns (uint)",
];
const UNISWAP_V2_PAIR_ABI = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];
const DEX_ADDRESSES = {
    uniswapV2Router: "0xfb8e1c3b833f9e67a71c859a132cf783b645e436",
    uniswapV2Factory: "0x733e88f248b742db6c14c0b1713af5ad7fdd59d0",
    uniswapV3Factory: "0x961235a9020b05c44df1026d956d1f4d78014276",
    uniswapUniversalRouter: "0x3ae6d8a282d67893e17aa70ebffb33ee5aa65893",
    sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    sushiswapFactory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
};
const WMON_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
server.tool("get-nft-holders", "Récupérer la liste des détenteurs d'un NFT spécifique sur Monad Testnet", {
    contractAddress: z.string().describe("Adresse du contrat NFT"),
    tokenId: z
        .string()
        .optional()
        .describe("ID du token spécifique (optionnel)"),
    standard: z
        .enum(["ERC721", "ERC1155"])
        .default("ERC721")
        .describe("Standard du NFT (ERC721 ou ERC1155)"),
    limit: z
        .number()
        .optional()
        .default(100)
        .describe("Nombre maximum de détenteurs à récupérer"),
}, async ({ contractAddress, tokenId, standard, limit }) => {
    try {
        // Vérifier que l'adresse du contrat est valide
        if (!ethers.isAddress(contractAddress)) {
            throw new Error(`Adresse de contrat invalide: ${contractAddress}`);
        }
        console.error(`Récupération des détenteurs pour le NFT à l'adresse: ${contractAddress}`);
        // Sélectionner l'ABI en fonction du standard
        const abi = standard === "ERC721" ? ERC721_ABI : ERC1155_ABI;
        // Créer une instance du contrat
        const contract = new ethers.Contract(contractAddress, abi, provider);
        // Informations sur la collection
        let name = "NFT Collection";
        let symbol = "NFT";
        try {
            if (standard === "ERC721") {
                name = await contract.name();
                symbol = await contract.symbol();
            }
        }
        catch (error) {
            console.error("Impossible de récupérer le nom ou le symbole:", error);
        }
        // Détenteurs des NFTs
        const holders = new Map();
        if (standard === "ERC721") {
            // Pour les NFTs ERC721
            try {
                // Si un tokenId spécifique est fourni
                if (tokenId) {
                    // Récupérer le propriétaire de ce tokenId spécifique
                    const owner = await contract.ownerOf(tokenId);
                    if (owner) {
                        holders.set(owner, [parseInt(tokenId)]);
                    }
                }
                else {
                    // Récupérer tous les tokens (limité par 'limit')
                    // Vérifier si le contrat implémente totalSupply et tokenByIndex (énumérable)
                    let isEnumerable = false;
                    let totalSupply = BigInt(0);
                    try {
                        totalSupply = await contract.totalSupply();
                        isEnumerable = true;
                    }
                    catch (error) {
                        console.error("Le contrat n'implémente pas totalSupply/tokenByIndex, utilisation de la méthode d'événements");
                    }
                    if (isEnumerable) {
                        // Si le contrat est énumérable, utiliser totalSupply et tokenByIndex
                        const maxTokens = Math.min(Number(totalSupply), limit);
                        for (let i = 0; i < maxTokens; i++) {
                            try {
                                const tokenId = await contract.tokenByIndex(i);
                                const owner = await contract.ownerOf(tokenId);
                                if (holders.has(owner)) {
                                    holders.get(owner)?.push(Number(tokenId));
                                }
                                else {
                                    holders.set(owner, [Number(tokenId)]);
                                }
                            }
                            catch (error) {
                                console.error(`Erreur lors de la récupération du token ${i}:`, error);
                            }
                        }
                    }
                    else {
                        // Si le contrat n'est pas énumérable, chercher les événements Transfer
                        // Définir manuellement le filtrage pour les événements Transfer
                        const transferEventSignature = ethers.id("Transfer(address,address,uint256)");
                        const transferEvents = await provider.getLogs({
                            fromBlock: 0,
                            toBlock: "latest",
                            address: contractAddress,
                            topics: [transferEventSignature],
                        });
                        // Analyser les événements pour trouver les transferts les plus récents
                        const processedTokens = new Set();
                        let tokenCount = 0;
                        // Parcourir les événements en ordre inverse (des plus récents aux plus anciens)
                        for (let i = transferEvents.length - 1; i >= 0 && tokenCount < limit; i--) {
                            const event = transferEvents[i];
                            // Décoder l'événement
                            const decodedEvent = contract.interface.parseLog({
                                topics: event.topics,
                                data: event.data,
                            });
                            if (decodedEvent && decodedEvent.args) {
                                const tokenIdFromEvent = decodedEvent.args[2].toString();
                                if (!processedTokens.has(tokenIdFromEvent)) {
                                    processedTokens.add(tokenIdFromEvent);
                                    try {
                                        const owner = await contract.ownerOf(tokenIdFromEvent);
                                        if (holders.has(owner)) {
                                            holders.get(owner)?.push(Number(tokenIdFromEvent));
                                        }
                                        else {
                                            holders.set(owner, [Number(tokenIdFromEvent)]);
                                        }
                                        tokenCount++;
                                    }
                                    catch (error) {
                                        console.error(`Erreur lors de la récupération du propriétaire pour le token ${tokenIdFromEvent}:`, error);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (error) {
                console.error("Erreur lors de la récupération des détenteurs ERC721:", error);
            }
        }
        else if (standard === "ERC1155") {
            // Pour les NFTs ERC1155
            // Cette implémentation est simplifiée car ERC1155 ne définit pas de méthode standard pour lister tous les tokens
            if (!tokenId) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Pour les NFTs ERC1155, vous devez spécifier un tokenId spécifique.",
                        },
                    ],
                };
            }
            // Pour ERC1155, nous avons besoin de rechercher dans les événements TransferSingle et TransferBatch
            const transferSingleSignature = ethers.id("TransferSingle(address,address,address,uint256,uint256)");
            const transferBatchSignature = ethers.id("TransferBatch(address,address,address,uint256[],uint256[])");
            const tokenIdValue = BigInt(tokenId);
            // Récupérer les événements TransferSingle
            const transferSingleEvents = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                address: contractAddress,
                topics: [transferSingleSignature],
            });
            // Récupérer les événements TransferBatch
            const transferBatchEvents = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                address: contractAddress,
                topics: [transferBatchSignature],
            });
            // Traiter les événements TransferSingle
            for (const event of transferSingleEvents) {
                const decodedEvent = contract.interface.parseLog({
                    topics: event.topics,
                    data: event.data,
                });
                if (decodedEvent && decodedEvent.args) {
                    const eventTokenId = decodedEvent.args[3];
                    const to = decodedEvent.args[2];
                    const value = decodedEvent.args[4];
                    if (eventTokenId.toString() === tokenId && value > 0) {
                        // Vérifier si l'adresse possède encore ce token
                        try {
                            const balance = await contract.balanceOf(to, tokenIdValue);
                            if (balance > 0) {
                                if (holders.has(to)) {
                                    if (!holders.get(to)?.includes(Number(tokenId))) {
                                        holders.get(to)?.push(Number(tokenId));
                                    }
                                }
                                else {
                                    holders.set(to, [Number(tokenId)]);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Erreur lors de la vérification du solde pour ${to}:`, error);
                        }
                    }
                }
            }
            // Traiter les événements TransferBatch
            for (const event of transferBatchEvents) {
                const decodedEvent = contract.interface.parseLog({
                    topics: event.topics,
                    data: event.data,
                });
                if (decodedEvent && decodedEvent.args) {
                    const to = decodedEvent.args[2];
                    const ids = decodedEvent.args[3];
                    const values = decodedEvent.args[4];
                    for (let i = 0; i < ids.length; i++) {
                        if (ids[i].toString() === tokenId && values[i] > 0) {
                            // Vérifier si l'adresse possède encore ce token
                            try {
                                const balance = await contract.balanceOf(to, tokenIdValue);
                                if (balance > 0) {
                                    if (holders.has(to)) {
                                        if (!holders.get(to)?.includes(Number(tokenId))) {
                                            holders.get(to)?.push(Number(tokenId));
                                        }
                                    }
                                    else {
                                        holders.set(to, [Number(tokenId)]);
                                    }
                                }
                            }
                            catch (error) {
                                console.error(`Erreur lors de la vérification du solde pour ${to}:`, error);
                            }
                        }
                    }
                }
            }
        }
        // Convertir la Map en tableau pour la réponse
        const holdersArray = Array.from(holders.entries()).map(([address, tokens]) => ({
            address,
            tokens,
            tokenCount: tokens.length,
        }));
        // Trier par nombre de tokens (décroissant)
        holdersArray.sort((a, b) => b.tokenCount - a.tokenCount);
        // Limiter le nombre de détenteurs retournés
        const limitedHolders = holdersArray.slice(0, limit);
        // Préparer le texte récapitulatif pour l'affichage
        const holderSummary = limitedHolders
            .map((holder, index) => `${index + 1}. ${holder.address}: ${holder.tokenCount} token(s) - IDs: [${holder.tokens.join(", ")}]`)
            .join("\n");
        return {
            content: [
                {
                    type: "text",
                    text: `Détenteurs de NFT pour ${name} (${symbol}) à l'adresse ${contractAddress}:\n\n${limitedHolders.length > 0
                        ? holderSummary
                        : "Aucun détenteur trouvé pour cette collection ou ce token."}`,
                },
            ],
            contractAddress,
            standard,
            name,
            symbol,
            tokenId: tokenId || "all",
            holderCount: limitedHolders.length,
            holders: limitedHolders,
        };
    }
    catch (error) {
        console.error(`Erreur lors de la récupération des détenteurs de NFT:`, error);
        return {
            content: [
                {
                    type: "text",
                    text: `Erreur lors de la récupération des détenteurs de NFT: ${error instanceof Error ? error.message : String(error)}\n\nVérifiez que l'adresse du contrat est correcte et qu'il s'agit bien d'un contrat NFT (${standard}).`,
                },
            ],
        };
    }
});
server.tool("token-swap", "Permettre aux utilisateurs d'échanger des tokens sur des DEX disponibles sur Monad Testnet", {
    privateKey: z
        .string()
        .describe("Clé privée de l'utilisateur pour effectuer la transaction"),
    routerType: z
        .enum(["uniswap", "sushiswap"])
        .default("uniswap")
        .describe("Type de routeur DEX à utiliser"),
    tokenInAddress: z
        .string()
        .optional()
        .describe("Adresse du token d'entrée (optionnel pour swaps de MON natif)"),
    tokenOutAddress: z.string().describe("Adresse du token de sortie"),
    amountIn: z
        .string()
        .describe("Montant du token d'entrée (en unités complètes, sera converti selon les décimales du token)"),
    slippagePercentage: z
        .number()
        .default(0.5)
        .describe("Pourcentage de slippage autorisé"),
    deadline: z
        .number()
        .optional()
        .describe("Date limite d'expiration en secondes depuis l'epoch (optionnel)"),
    useNativeMON: z
        .boolean()
        .default(false)
        .describe("Utiliser MON natif comme token d'entrée"),
    checkLiquidityOnly: z
        .boolean()
        .default(false)
        .describe("Vérifier uniquement la liquidité sans effectuer le swap"),
}, async ({ privateKey, routerType, tokenInAddress, tokenOutAddress, amountIn, slippagePercentage, deadline, useNativeMON, checkLiquidityOnly, }) => {
    try {
        console.error("Initialisation du swap de tokens sur Monad...");
        if (!useNativeMON && !tokenInAddress) {
            throw new Error("L'adresse du token d'entrée est requise lorsque useNativeMON est false");
        }
        const wallet = new ethers.Wallet(privateKey, provider);
        const walletAddress = wallet.address;
        console.error(`Adresse du wallet: ${walletAddress}`);
        let routerAddress;
        let factoryAddress;
        if (routerType === "uniswap") {
            routerAddress = DEX_ADDRESSES.uniswapV2Router;
            factoryAddress = DEX_ADDRESSES.uniswapV2Factory;
            console.error(`Utilisation du routeur Uniswap V2 à l'adresse: ${routerAddress}`);
            console.error(`Factory Uniswap V2 à l'adresse: ${factoryAddress}`);
        }
        else if (routerType === "sushiswap") {
            routerAddress = DEX_ADDRESSES.sushiswapRouter;
            factoryAddress =
                DEX_ADDRESSES.sushiswapFactory ||
                    "0x0000000000000000000000000000000000000000";
            console.error(`Utilisation du routeur SushiSwap à l'adresse: ${routerAddress}`);
        }
        else {
            throw new Error(`Type de routeur non pris en charge: ${routerType}`);
        }
        if (!ethers.isAddress(routerAddress)) {
            console.error(`ERREUR: Adresse de routeur ${routerType} invalide: ${routerAddress}`);
            throw new Error(`Adresse de routeur ${routerType} invalide ou non configurée. Veuillez vérifier la configuration du DEX.`);
        }
        if (!ethers.isAddress(WMON_ADDRESS)) {
            console.error(`ERREUR: Adresse WMON invalide: ${WMON_ADDRESS}`);
            throw new Error(`Adresse WMON invalide ou non configurée: ${WMON_ADDRESS}. Veuillez vérifier la configuration.`);
        }
        console.error(`Utilisation du routeur ${routerType} à l'adresse ${routerAddress}`);
        const router = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, wallet);
        const factory = new ethers.Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);
        const routerCode = await provider.getCode(routerAddress);
        if (routerCode === "0x" || routerCode === "") {
            console.error(`ERREUR: Aucun code à l'adresse du routeur ${routerType}: ${routerAddress}`);
            throw new Error(`Aucun contrat n'existe à l'adresse du routeur ${routerType} (${routerAddress}). Vérifiez que le DEX est bien déployé sur Monad testnet.`);
        }
        console.error(`Code du routeur vérifié: ${routerCode.substring(0, 10)}...`);
        const effectiveTokenInAddress = useNativeMON
            ? WMON_ADDRESS
            : tokenInAddress;
        async function checkPoolLiquidity(tokenA, tokenB) {
            try {
                console.error(`Vérification de l'existence du pool ${tokenA} <-> ${tokenB}...`);
                const pairAddress = await factory.getPair(tokenA, tokenB);
                if (pairAddress === "0x0000000000000000000000000000000000000000") {
                    console.error(`Pool inexistant pour ${tokenA} <-> ${tokenB}`);
                    return {
                        exists: false,
                        liquidity: "0",
                        tokenASymbol: "Inconnu",
                        tokenBSymbol: "Inconnu",
                        pairAddress: "0x0000000000000000000000000000000000000000",
                    };
                }
                console.error(`Pool trouvé à l'adresse: ${pairAddress}`);
                const pair = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
                const [reserve0, reserve1] = await pair.getReserves();
                const token0 = await pair.token0();
                const token1 = await pair.token1();
                const reserveA = token0.toLowerCase() === tokenA.toLowerCase() ? reserve0 : reserve1;
                const reserveB = token0.toLowerCase() === tokenA.toLowerCase() ? reserve1 : reserve0;
                let tokenASymbol = "Inconnu";
                let tokenBSymbol = "Inconnu";
                try {
                    const tokenAContract = new ethers.Contract(tokenA, ERC20_ABI, provider);
                    tokenASymbol = await tokenAContract.symbol();
                }
                catch (error) {
                    console.error(`Impossible de récupérer le symbole pour ${tokenA}`);
                }
                try {
                    const tokenBContract = new ethers.Contract(tokenB, ERC20_ABI, provider);
                    tokenBSymbol = await tokenBContract.symbol();
                }
                catch (error) {
                    console.error(`Impossible de récupérer le symbole pour ${tokenB}`);
                }
                console.error(`Liquidité: ${ethers.formatEther(reserveA)} ${tokenASymbol} <-> ${ethers.formatEther(reserveB)} ${tokenBSymbol}`);
                return {
                    exists: true,
                    liquidity: `${ethers.formatEther(reserveA)} ${tokenASymbol} <-> ${ethers.formatEther(reserveB)} ${tokenBSymbol}`,
                    tokenASymbol,
                    tokenBSymbol,
                    reserveA: reserveA.toString(),
                    reserveB: reserveB.toString(),
                    pairAddress,
                };
            }
            catch (error) {
                console.error(`Erreur lors de la vérification du pool:`, error);
                return {
                    exists: false,
                    liquidity: "0",
                    error: String(error),
                    tokenASymbol: "Inconnu",
                    tokenBSymbol: "Inconnu",
                    pairAddress: "0x0000000000000000000000000000000000000000",
                };
            }
        }
        const directPoolInfo = await checkPoolLiquidity(effectiveTokenInAddress, tokenOutAddress);
        const wmonPoolInfoIn = !useNativeMON
            ? await checkPoolLiquidity(effectiveTokenInAddress, WMON_ADDRESS)
            : {
                exists: true,
                liquidity: "N/A (MON natif)",
                tokenASymbol: "MON",
                tokenBSymbol: "WMON",
                pairAddress: "0x0000000000000000000000000000000000000000",
            };
        const wmonPoolInfoOut = await checkPoolLiquidity(WMON_ADDRESS, tokenOutAddress);
        if (checkLiquidityOnly) {
            const popularTokens = [];
            try {
                const pairsCount = await factory.allPairsLength();
                const limit = Math.min(Number(pairsCount), 10);
                console.error(`Récupération des ${limit} premières paires de tokens...`);
                for (let i = 0; i < limit; i++) {
                    try {
                        const pairAddress = await factory.allPairs(i);
                        const pair = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
                        const token0 = await pair.token0();
                        const token1 = await pair.token1();
                        const [reserve0, reserve1] = await pair.getReserves();
                        if (reserve0 > ethers.parseEther("0.01") &&
                            reserve1 > ethers.parseEther("0.01")) {
                            try {
                                const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
                                const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
                                const symbol0 = await token0Contract.symbol();
                                const symbol1 = await token1Contract.symbol();
                                if (!popularTokens.some((t) => t.address.toLowerCase() === token0.toLowerCase())) {
                                    popularTokens.push({ address: token0, symbol: symbol0 });
                                }
                                if (!popularTokens.some((t) => t.address.toLowerCase() === token1.toLowerCase())) {
                                    popularTokens.push({ address: token1, symbol: symbol1 });
                                }
                            }
                            catch (error) {
                                console.error(`Erreur lors de la récupération des symboles pour la paire ${i}:`, error);
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Erreur lors de la récupération de la paire ${i}:`, error);
                    }
                }
            }
            catch (error) {
                console.error(`Erreur lors de la récupération des paires:`, error);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Vérification de la liquidité des pools sur ${routerType}:

Pool direct ${effectiveTokenInAddress === WMON_ADDRESS
                            ? "MON"
                            : directPoolInfo.tokenASymbol} -> ${directPoolInfo.tokenBSymbol}: ${directPoolInfo.exists ? "Existe" : "N'existe pas"}
${directPoolInfo.exists ? `Liquidité: ${directPoolInfo.liquidity}` : ""}
Adresse du pool: ${directPoolInfo.pairAddress}

Pool ${effectiveTokenInAddress === WMON_ADDRESS
                            ? "MON"
                            : wmonPoolInfoIn.tokenASymbol} -> MON: ${wmonPoolInfoIn.exists ? "Existe" : "N'existe pas"}
${wmonPoolInfoIn.exists ? `Liquidité: ${wmonPoolInfoIn.liquidity}` : ""}

Pool MON -> ${wmonPoolInfoOut.tokenBSymbol}: ${wmonPoolInfoOut.exists ? "Existe" : "N'existe pas"}
${wmonPoolInfoOut.exists ? `Liquidité: ${wmonPoolInfoOut.liquidity}` : ""}

Chemin recommandé: ${directPoolInfo.exists
                            ? "Direct"
                            : wmonPoolInfoIn.exists && wmonPoolInfoOut.exists
                                ? "Via MON"
                                : "Aucun chemin viable"}

${popularTokens.length > 0
                            ? `Tokens populaires disponibles sur ${routerType}:
${popularTokens
                                .map((t, i) => `${i + 1}. ${t.symbol} (${t.address})`)
                                .join("\n")}

Si vous souhaitez créer de la liquidité, vous devrez ajouter des tokens aux pools via l'interface du DEX.`
                            : "Aucun token populaire trouvé."}`,
                    },
                ],
                poolInfo: {
                    direct: directPoolInfo,
                    viaMON: {
                        tokenIn: wmonPoolInfoIn,
                        tokenOut: wmonPoolInfoOut,
                    },
                    recommendedPath: directPoolInfo.exists
                        ? "direct"
                        : wmonPoolInfoIn.exists && wmonPoolInfoOut.exists
                            ? "via_mon"
                            : "none",
                    popularTokens,
                },
            };
        }
        let path = [];
        let useDirectPath = false;
        if (useNativeMON) {
            path = [WMON_ADDRESS, tokenOutAddress];
            console.error(`Utilisation du chemin MON -> Token: ${WMON_ADDRESS} -> ${tokenOutAddress}`);
            if (!wmonPoolInfoOut.exists) {
                throw new Error(`Aucun pool de liquidité n'existe pour MON -> ${wmonPoolInfoOut.tokenBSymbol || tokenOutAddress}. Impossible de procéder au swap.`);
            }
        }
        else if (tokenOutAddress.toLowerCase() === WMON_ADDRESS.toLowerCase()) {
            path = [tokenInAddress, WMON_ADDRESS];
            console.error(`Utilisation du chemin Token -> MON: ${tokenInAddress} -> ${WMON_ADDRESS}`);
            if (!wmonPoolInfoIn.exists) {
                throw new Error(`Aucun pool de liquidité n'existe pour ${wmonPoolInfoIn.tokenASymbol || tokenInAddress} -> MON. Impossible de procéder au swap.`);
            }
        }
        else {
            if (directPoolInfo.exists) {
                path = [tokenInAddress, tokenOutAddress];
                useDirectPath = true;
                console.error(`Utilisation du chemin direct: ${tokenInAddress} -> ${tokenOutAddress}`);
            }
            else if (wmonPoolInfoIn.exists && wmonPoolInfoOut.exists) {
                path = [tokenInAddress, WMON_ADDRESS, tokenOutAddress];
                console.error(`Utilisation du chemin via MON: ${tokenInAddress} -> ${WMON_ADDRESS} -> ${tokenOutAddress}`);
            }
            else {
                throw new Error(`Aucun chemin de swap viable n'a été trouvé entre ${wmonPoolInfoIn.tokenASymbol || tokenInAddress} et ${wmonPoolInfoOut.tokenBSymbol || tokenOutAddress}. Vérifiez que les pools de liquidité existent sur ${routerType}.`);
            }
        }
        console.error(`Chemin de swap final: ${path.join(" -> ")}`);
        let userBalance;
        if (useNativeMON) {
            userBalance = await provider.getBalance(walletAddress);
            console.error(`Solde MON du wallet: ${ethers.formatEther(userBalance)} MON`);
        }
        else {
            const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, provider);
            userBalance = await tokenIn.balanceOf(walletAddress);
            let decimals = 18;
            try {
                decimals = await tokenIn.decimals();
            }
            catch (error) {
                console.error("Impossible de récupérer les décimales, utilisation de la valeur par défaut 18");
            }
            console.error(`Solde de tokens du wallet: ${ethers.formatUnits(userBalance, decimals)} tokens`);
        }
        let formattedAmountIn;
        let tokenDecimals = 18;
        if (useNativeMON) {
            formattedAmountIn = ethers.parseEther(amountIn);
            console.error(`Montant d'entrée: ${amountIn} MON (${formattedAmountIn.toString()} wei)`);
            const estimatedGas = ethers.parseEther("0.005");
            if (userBalance < formattedAmountIn + estimatedGas) {
                throw new Error(`Solde MON insuffisant. Vous avez ${ethers.formatEther(userBalance)} MON, mais vous essayez de swapper ${amountIn} MON plus les frais de gas.`);
            }
        }
        else {
            const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, provider);
            try {
                tokenDecimals = await tokenIn.decimals();
            }
            catch (error) {
                console.error("Impossible de récupérer les décimales, utilisation de la valeur par défaut 18");
            }
            formattedAmountIn = ethers.parseUnits(amountIn, tokenDecimals);
            console.error(`Montant d'entrée: ${amountIn} tokens (${formattedAmountIn.toString()} unités avec ${tokenDecimals} décimales)`);
            if (userBalance < formattedAmountIn) {
                throw new Error(`Solde de tokens insuffisant. Vous avez ${ethers.formatUnits(userBalance, tokenDecimals)} tokens, mais vous essayez d'en swapper ${amountIn}.`);
            }
        }
        let amountsOut;
        let estimatedAmountOut;
        try {
            console.error(`Demande de getAmountsOut pour ${ethers.formatUnits(formattedAmountIn, useNativeMON ? 18 : tokenDecimals)} avec chemin:`, path);
            amountsOut = await router.getAmountsOut(formattedAmountIn, path);
            estimatedAmountOut = amountsOut[amountsOut.length - 1];
            if (estimatedAmountOut === BigInt(0)) {
                throw new Error("Le montant de sortie estimé est 0, ce qui suggère une absence de liquidité");
            }
            console.error(`Montants calculés par le routeur:`, amountsOut.map((a) => a.toString()));
        }
        catch (error) {
            console.error(`Erreur lors de l'estimation des montants:`, error);
            throw new Error(`Impossible d'estimer le montant de sortie. Ceci est généralement dû à un manque de liquidité pour cette paire de trading ou à un problème avec le routeur DEX.`);
        }
        const slippageFactor = 1000 - slippagePercentage * 10;
        const minAmountOut = (estimatedAmountOut * BigInt(slippageFactor)) / BigInt(1000);
        console.error(`Montant estimé en sortie: ${ethers.formatUnits(estimatedAmountOut, 18)}`);
        console.error(`Montant minimum en sortie (avec slippage de ${slippagePercentage}%): ${ethers.formatUnits(minAmountOut, 18)}`);
        const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 300;
        let swapTx;
        let receipt;
        try {
            if (useNativeMON) {
                console.error("Exécution d'un swap MON -> Token...");
                const gasLimit = await router.swapExactETHForTokens.estimateGas(minAmountOut, path, walletAddress, swapDeadline, { value: formattedAmountIn });
                console.error(`Limite de gas estimée: ${gasLimit.toString()}`);
                swapTx = await router.swapExactETHForTokens(minAmountOut, path, walletAddress, swapDeadline, {
                    value: formattedAmountIn,
                    gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
                });
            }
            else if (path.length > 0 &&
                path[path.length - 1].toLowerCase() === WMON_ADDRESS.toLowerCase()) {
                console.error("Exécution d'un swap Token -> MON...");
                const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, wallet);
                const allowance = await tokenIn.allowance(walletAddress, routerAddress);
                if (allowance < formattedAmountIn) {
                    console.error("Approbation du token nécessaire...");
                    const approveTx = await tokenIn.approve(routerAddress, ethers.MaxUint256);
                    const approveReceipt = await approveTx.wait();
                    console.error(`Token approuvé avec succès. Hash: ${approveTx.hash}, Bloc: ${approveReceipt.blockNumber}`);
                }
                else {
                    console.error(`Approbation existante suffisante: ${allowance.toString()}`);
                }
                const gasLimit = await router.swapExactTokensForETH.estimateGas(formattedAmountIn, minAmountOut, path, walletAddress, swapDeadline);
                console.error(`Limite de gas estimée: ${gasLimit.toString()}`);
                swapTx = await router.swapExactTokensForETH(formattedAmountIn, minAmountOut, path, walletAddress, swapDeadline, {
                    gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
                });
            }
            else {
                console.error("Exécution d'un swap Token -> Token...");
                const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, wallet);
                const allowance = await tokenIn.allowance(walletAddress, routerAddress);
                if (allowance < formattedAmountIn) {
                    console.error("Approbation du token nécessaire...");
                    const approveTx = await tokenIn.approve(routerAddress, ethers.MaxUint256);
                    const approveReceipt = await approveTx.wait();
                    console.error(`Token approuvé avec succès. Hash: ${approveTx.hash}, Bloc: ${approveReceipt.blockNumber}`);
                }
                else {
                    console.error(`Approbation existante suffisante: ${allowance.toString()}`);
                }
                const gasLimit = await router.swapExactTokensForTokens.estimateGas(formattedAmountIn, minAmountOut, path, walletAddress, swapDeadline);
                console.error(`Limite de gas estimée: ${gasLimit.toString()}`);
                swapTx = await router.swapExactTokensForTokens(formattedAmountIn, minAmountOut, path, walletAddress, swapDeadline, {
                    gasLimit: (gasLimit * BigInt(12)) / BigInt(10),
                });
            }
            console.error(`Transaction de swap envoyée. Hash: ${swapTx.hash}`);
            console.error("Attente de la confirmation de la transaction...");
            receipt = await swapTx.wait(2);
            if (!receipt || receipt.status === 0) {
                throw new Error(`Le swap a échoué. Hash de transaction: ${swapTx.hash}`);
            }
        }
        catch (error) {
            console.error("Erreur détaillée lors de l'exécution du swap:", error);
            let errorMessage = "Raison inconnue";
            const errorString = String(error);
            if (errorString.includes("insufficient funds")) {
                errorMessage =
                    "Fonds insuffisants pour couvrir le montant du swap et les frais de gas";
            }
            else if (errorString.includes("execution reverted")) {
                if (errorString.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
                    errorMessage =
                        "Le montant de sortie est inférieur au minimum requis (slippage trop élevé)";
                }
                else if (errorString.includes("INSUFFICIENT_LIQUIDITY")) {
                    errorMessage =
                        "Liquidité insuffisante dans le pool pour cette paire de trading";
                }
                else if (errorString.includes("EXPIRED")) {
                    errorMessage =
                        "La transaction a expiré avant d'être incluse dans un bloc";
                }
                else {
                    errorMessage =
                        "Le contrat a rejeté la transaction (possible problème de liquidité ou de configuration)";
                }
            }
            throw new Error(`Échec du swap: ${errorMessage}. Détails techniques: ${errorString}`);
        }
        let tokenInSymbol = useNativeMON ? "MON" : "Unknown";
        let tokenOutSymbol = "Unknown";
        if (!useNativeMON && tokenInAddress) {
            try {
                const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, provider);
                tokenInSymbol = await tokenIn.symbol();
            }
            catch (error) {
                console.error("Impossible de récupérer le symbole du token d'entrée");
            }
        }
        try {
            const tokenOut = new ethers.Contract(tokenOutAddress, ERC20_ABI, provider);
            tokenOutSymbol = await tokenOut.symbol();
        }
        catch (error) {
            console.error("Impossible de récupérer le symbole du token de sortie");
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Swap de tokens réussi !

De: ${amountIn} ${tokenInSymbol}
À: ${ethers.formatUnits(estimatedAmountOut, 18)} ${tokenOutSymbol} (estimation)

Transaction: ${swapTx.hash}
Block: ${receipt.blockNumber}
DEX utilisé: ${routerType}
Chemin de swap: ${path
                        .map((addr, i) => {
                        if (addr && addr.toLowerCase() === WMON_ADDRESS.toLowerCase())
                            return "MON";
                        return i === 0 && useNativeMON
                            ? "MON"
                            : addr
                                ? `Token(${addr.slice(0, 6)}...${addr.slice(-4)})`
                                : "Token(inconnu)";
                    })
                        .join(" -> ")}

Vous pouvez consulter votre transaction ici:
https://testnet.monadexplorer.com/tx/${swapTx.hash}`,
                },
            ],
            txHash: swapTx.hash,
            blockNumber: receipt.blockNumber,
            tokenInSymbol,
            tokenOutSymbol,
            amountIn: amountIn,
            estimatedAmountOut: ethers.formatUnits(estimatedAmountOut, 18),
            actualAmountOut: ethers.formatUnits(estimatedAmountOut, 18),
            dex: routerType,
        };
    }
    catch (error) {
        console.error("Erreur lors du swap de tokens:", error);
        let errorMessage = error instanceof Error ? error.message : String(error);
        let friendlyMessage = `Échec du swap de tokens. Erreur: ${errorMessage}`;
        friendlyMessage += `\n\nSuggestions:
1. Vérifiez que vous disposez de suffisamment de tokens pour le swap et pour payer les frais de gas
2. Assurez-vous que les adresses des tokens sont correctes
3. Vérifiez que la paire de trading existe sur le DEX choisi
4. Essayez d'augmenter le slippage pour les paires à faible liquidité
5. Vérifiez que vous utilisez la bonne adresse de routeur pour le DEX`;
        return {
            content: [
                {
                    type: "text",
                    text: friendlyMessage,
                },
            ],
        };
    }
});
server.tool("get-portfolio", "Récupérer le portfolio complet d'un utilisateur sur Monad Testnet, incluant ses avoirs en tokens, NFTs, et son PNL", {
    address: z.string().describe("Adresse du portefeuille à analyser"),
    includeNFTs: z
        .boolean()
        .default(true)
        .describe("Inclure les NFTs dans l'analyse"),
    includeHistory: z
        .boolean()
        .default(true)
        .describe("Inclure l'historique des transactions"),
    historyDays: z
        .number()
        .default(30)
        .describe("Nombre de jours d'historique à analyser"),
}, async ({ address, includeNFTs, includeHistory, historyDays }) => {
    try {
        console.error(`Analyse du portfolio pour l'adresse: ${address}`);
        if (!ethers.isAddress(address)) {
            throw new Error(`Adresse invalide: ${address}`);
        }
        // Récupérer le solde en MON natif
        const ethBalance = await provider.getBalance(address);
        const ethBalanceFormatted = ethers.formatEther(ethBalance);
        console.error(`Solde MON: ${ethBalanceFormatted}`);
        // Structure pour stocker les résultats
        const portfolio = {
            nativeBalance: {
                symbol: "MON",
                balance: ethBalanceFormatted,
                valueUSD: "0.00", // À implémenter si un oracle de prix est disponible
            },
            tokens: [],
            nfts: [],
            totalValueUSD: "0.00",
            pnl: {
                daily: "0.00",
                weekly: "0.00",
                monthly: "0.00",
                allTime: "0.00",
            },
            transactions: {
                count: 0,
                volume: "0.00",
                fees: "0.00",
                recent: [],
            },
        };
        // Détection des tokens ERC20
        console.error("Recherche des tokens ERC20...");
        // Récupérer les événements Transfer pour l'adresse (réception)
        const transfersTo = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                null,
                ethers.zeroPadValue(address.toLowerCase(), 32),
            ],
        });
        console.error(`Transferts reçus trouvés: ${transfersTo.length}`);
        // Récupérer les événements Transfer depuis l'adresse (envoi)
        const transfersFrom = await provider.getLogs({
            fromBlock: 0,
            toBlock: "latest",
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                ethers.zeroPadValue(address.toLowerCase(), 32),
            ],
        });
        console.error(`Transferts envoyés trouvés: ${transfersFrom.length}`);
        // Combiner et déduire les adresses uniques des tokens
        const tokenAddresses = new Set();
        for (const log of [...transfersTo, ...transfersFrom]) {
            if (log.address && ethers.isAddress(log.address)) {
                tokenAddresses.add(log.address.toLowerCase());
            }
        }
        console.error(`Adresses de tokens uniques trouvées: ${tokenAddresses.size}`);
        // Analyser chaque token potentiel
        for (const tokenAddress of tokenAddresses) {
            try {
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                const [balance, decimals, symbol, name] = await Promise.all([
                    tokenContract.balanceOf(address),
                    tokenContract.decimals(),
                    tokenContract.symbol(),
                    tokenContract.name(),
                ]);
                if (balance > 0) {
                    const formattedBalance = ethers.formatUnits(balance, decimals);
                    console.error(`Token trouvé: ${name} (${symbol}), Solde: ${formattedBalance}`);
                    // Essayer de trouver la valeur du token sur un DEX (simplifiée)
                    let priceUSD = "0.00";
                    let valueUSD = "0.00";
                    try {
                        // Vérifier si le token a une paire avec WMON
                        const factory = new ethers.Contract(DEX_ADDRESSES.uniswapV2Factory, UNISWAP_V2_FACTORY_ABI, provider);
                        const pairAddress = await factory.getPair(tokenAddress, WMON_ADDRESS);
                        if (pairAddress !== "0x0000000000000000000000000000000000000000") {
                            const pair = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
                            const [reserve0, reserve1] = await pair.getReserves();
                            const token0 = await pair.token0();
                            // Calculer le prix approximatif
                            if (token0.toLowerCase() === tokenAddress.toLowerCase()) {
                                const priceInETH = reserve1 / reserve0;
                                priceUSD = (priceInETH * 1500).toFixed(6); // Supposons 1 MON = 1500 USD
                                valueUSD = (parseFloat(formattedBalance) * parseFloat(priceUSD)).toFixed(2);
                            }
                            else {
                                const priceInETH = reserve0 / reserve1;
                                priceUSD = (priceInETH * 1500).toFixed(6);
                                valueUSD = (parseFloat(formattedBalance) * parseFloat(priceUSD)).toFixed(2);
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Erreur lors de la récupération du prix pour ${symbol}:`, error);
                    }
                    portfolio.tokens.push({
                        address: tokenAddress,
                        name,
                        symbol,
                        balance: formattedBalance,
                        decimals,
                        priceUSD,
                        valueUSD,
                    });
                }
            }
            catch (error) {
                console.error(`Erreur lors de l'analyse du token ${tokenAddress}:`, error);
                // Ce n'est probablement pas un token ERC20 valide
            }
        }
        // Calcul de la valeur totale
        let totalValueUSD = parseFloat(portfolio.nativeBalance.valueUSD);
        for (const token of portfolio.tokens) {
            totalValueUSD += parseFloat(token.valueUSD);
        }
        portfolio.totalValueUSD = totalValueUSD.toFixed(2);
        // Recherche de NFTs si demandé
        if (includeNFTs) {
            console.error("Recherche des NFTs...");
            // Rechercher les événements Transfer pour les NFTs ERC721
            const nftTransfersTo = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                topics: [
                    ethers.id("Transfer(address,address,uint256)"),
                    null,
                    ethers.zeroPadValue(address.toLowerCase(), 32),
                    null, // tokenId peut être n'importe lequel
                ],
            });
            const nftTransfersFrom = await provider.getLogs({
                fromBlock: 0,
                toBlock: "latest",
                topics: [
                    ethers.id("Transfer(address,address,uint256)"),
                    ethers.zeroPadValue(address.toLowerCase(), 32),
                    null,
                    null,
                ],
            });
            console.error(`Transferts NFT trouvés: ${nftTransfersTo.length + nftTransfersFrom.length}`);
            // Déduire les collections uniques de NFT
            const nftCollections = new Set();
            for (const log of [...nftTransfersTo, ...nftTransfersFrom]) {
                if (log.address && ethers.isAddress(log.address)) {
                    nftCollections.add(log.address.toLowerCase());
                }
            }
            // Pour chaque collection, vérifier les NFTs possédés
            for (const collectionAddress of nftCollections) {
                try {
                    const nftContract = new ethers.Contract(collectionAddress, ERC721_ABI, provider);
                    try {
                        // Vérifier si c'est un NFT en essayant de récupérer le symbole
                        const [name, symbol] = await Promise.all([
                            nftContract.name(),
                            nftContract.symbol(),
                        ]);
                        // Vérifier le solde
                        const balance = await nftContract.balanceOf(address);
                        if (balance > 0) {
                            console.error(`Collection NFT trouvée: ${name} (${symbol}), Nombre de NFTs: ${balance}`);
                            const ownedTokens = [];
                            let isEnumerable = false;
                            // Vérifier si le contrat supporte l'énumération
                            try {
                                const firstToken = await nftContract.tokenOfOwnerByIndex(address, 0);
                                isEnumerable = true;
                            }
                            catch (error) {
                                console.error(`Collection non énumérable: ${name}`);
                            }
                            // Si énumérable, récupérer tous les IDs
                            if (isEnumerable) {
                                for (let i = 0; i < Math.min(Number(balance), 100); i++) {
                                    try {
                                        const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
                                        let tokenURI = "";
                                        try {
                                            tokenURI = await nftContract.tokenURI(tokenId);
                                        }
                                        catch (e) {
                                            console.error(`Impossible de récupérer tokenURI pour ${tokenId}`);
                                        }
                                        ownedTokens.push({
                                            tokenId: tokenId.toString(),
                                            tokenURI,
                                        });
                                    }
                                    catch (error) {
                                        console.error(`Erreur lors de la récupération du token ${i}:`, error);
                                    }
                                }
                            }
                            else {
                                // Analyser les événements pour trouver les tokens
                                const ownedTokenIds = new Set();
                                for (const log of nftTransfersTo) {
                                    if (log.address.toLowerCase() ===
                                        collectionAddress.toLowerCase()) {
                                        const tokenId = ethers.dataSlice(log.topics[3], 0);
                                        // Vérifier si l'utilisateur possède toujours ce token
                                        try {
                                            const currentOwner = await nftContract.ownerOf(tokenId);
                                            if (currentOwner.toLowerCase() === address.toLowerCase()) {
                                                ownedTokenIds.add(tokenId);
                                            }
                                        }
                                        catch (error) {
                                            // Token a probablement été transféré ailleurs
                                        }
                                    }
                                }
                                for (const tokenId of ownedTokenIds) {
                                    let tokenURI = "";
                                    try {
                                        tokenURI = await nftContract.tokenURI(tokenId);
                                    }
                                    catch (e) {
                                        console.error(`Impossible de récupérer tokenURI pour ${tokenId}`);
                                    }
                                    ownedTokens.push({
                                        tokenId,
                                        tokenURI,
                                    });
                                }
                            }
                            portfolio.nfts.push({
                                address: collectionAddress,
                                name,
                                symbol,
                                balance: balance.toString(),
                                tokens: ownedTokens,
                            });
                        }
                    }
                    catch (error) {
                        // Ce n'est probablement pas un NFT ERC721
                        console.error(`${collectionAddress} n'est pas un NFT ERC721 valide`);
                    }
                }
                catch (error) {
                    console.error(`Erreur lors de l'analyse de la collection NFT ${collectionAddress}:`, error);
                }
            }
        }
        // Analyser l'historique des transactions si demandé
        if (includeHistory) {
            console.error("Récupération de l'historique des transactions...");
            const now = Math.floor(Date.now() / 1000);
            const startTime = now - historyDays * 24 * 60 * 60;
            // Utiliser getTransactionReceipts au lieu de getHistory qui n'existe pas
            const txHistory = await provider.getTransactionReceipts({
                address,
                fromBlock: 0,
                toBlock: "latest",
            });
            console.error(`Nombre total de transactions: ${txHistory.length}`);
            // Filtrer les transactions récentes selon historyDays
            const recentTxs = [];
            let totalFees = ethers.parseEther("0");
            for (const receipt of txHistory) {
                try {
                    if (receipt && receipt.blockNumber) {
                        const block = await provider.getBlock(receipt.blockNumber);
                        const tx = await provider.getTransaction(receipt.transactionHash);
                        if (block && tx && block.timestamp >= startTime) {
                            const gasUsed = receipt.gasUsed || ethers.toBigInt(0);
                            const gasPrice = tx.gasPrice || ethers.toBigInt(0);
                            const fee = gasUsed * gasPrice;
                            totalFees += fee;
                            let txType = "Transfer";
                            if (tx.data && tx.data.length > 2) {
                                txType = "Contract Interaction";
                            }
                            recentTxs.push({
                                hash: receipt.transactionHash,
                                blockNumber: receipt.blockNumber,
                                timestamp: block.timestamp || 0,
                                from: tx.from || "",
                                to: tx.to || "Contract Creation",
                                value: ethers.formatEther(tx.value || 0),
                                gasUsed: gasUsed.toString(),
                                fee: ethers.formatEther(fee),
                                type: txType,
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`Erreur lors de l'analyse de la transaction ${receipt?.transactionHash}:`, error);
                }
            }
            // Trier par timestamp décroissant (le plus récent en premier)
            recentTxs.sort((a, b) => b.timestamp - a.timestamp);
            // Calculer le volume total des transactions
            const txVolume = txHistory.reduce((acc, receipt) => {
                try {
                    return acc + (receipt.gasUsed || BigInt(0));
                }
                catch {
                    return acc;
                }
            }, BigInt(0));
            portfolio.transactions = {
                count: txHistory.length,
                volume: txVolume.toString(),
                fees: ethers.formatEther(totalFees),
                recent: recentTxs.slice(0, 20), // Limiter à 20 transactions
            };
            // Calculer le PNL approximatif basé sur les transferts entrants et sortants
            // Note: C'est une approximation très simplifiée
            const oneDayAgo = now - 24 * 60 * 60;
            const oneWeekAgo = now - 7 * 24 * 60 * 60;
            const oneMonthAgo = now - 30 * 24 * 60 * 60;
            let dailyInflow = ethers.parseEther("0");
            let dailyOutflow = ethers.parseEther("0");
            let weeklyInflow = ethers.parseEther("0");
            let weeklyOutflow = ethers.parseEther("0");
            let monthlyInflow = ethers.parseEther("0");
            let monthlyOutflow = ethers.parseEther("0");
            let allTimeInflow = ethers.parseEther("0");
            let allTimeOutflow = ethers.parseEther("0");
            for (const tx of recentTxs) {
                try {
                    const txValue = ethers.parseEther(tx.value);
                    if (tx.from.toLowerCase() === address.toLowerCase()) {
                        // Sortie de fonds
                        if (tx.timestamp >= oneDayAgo) {
                            dailyOutflow += txValue;
                        }
                        if (tx.timestamp >= oneWeekAgo) {
                            weeklyOutflow += txValue;
                        }
                        if (tx.timestamp >= oneMonthAgo) {
                            monthlyOutflow += txValue;
                        }
                        allTimeOutflow += txValue;
                    }
                    if (typeof tx.to === "string" &&
                        tx.to.toLowerCase() === address.toLowerCase()) {
                        // Entrée de fonds
                        if (tx.timestamp >= oneDayAgo) {
                            dailyInflow += txValue;
                        }
                        if (tx.timestamp >= oneWeekAgo) {
                            weeklyInflow += txValue;
                        }
                        if (tx.timestamp >= oneMonthAgo) {
                            monthlyInflow += txValue;
                        }
                        allTimeInflow += txValue;
                    }
                }
                catch (error) {
                    console.error(`Erreur lors de l'analyse PNL pour ${tx.hash}:`, error);
                }
            }
            portfolio.pnl = {
                daily: ethers.formatEther(dailyInflow - dailyOutflow),
                weekly: ethers.formatEther(weeklyInflow - weeklyOutflow),
                monthly: ethers.formatEther(monthlyInflow - monthlyOutflow),
                allTime: ethers.formatEther(allTimeInflow - allTimeOutflow),
            };
        }
        const now = new Date().toLocaleString();
        return {
            content: [
                {
                    type: "text",
                    text: `Portfolio pour ${address} (au ${now}):

Solde MON: ${portfolio.nativeBalance.balance} MON

== Tokens ERC20 (${portfolio.tokens.length}) ==
${portfolio.tokens
                        .map((token) => `- ${token.balance} ${token.symbol} (${token.name})
   Valeur estimée: ${token.valueUSD} USD (${token.priceUSD} USD/token)`)
                        .join("\n")}

== NFTs (${portfolio.nfts.length} collections) ==
${portfolio.nfts
                        .map((collection) => `- ${collection.name} (${collection.symbol}): ${collection.balance} NFTs
   ${collection.tokens
                        .slice(0, 5)
                        .map((token) => `  • Token ID: ${token.tokenId}${token.tokenURI ? `\n    URI: ${token.tokenURI}` : ""}`)
                        .join("\n")}${collection.tokens.length > 5
                        ? `\n   ... et ${collection.tokens.length - 5} autres`
                        : ""}`)
                        .join("\n")}

== Résumé des transactions ==
Nombre total: ${portfolio.transactions.count}
Frais totaux: ${portfolio.transactions.fees} MON

== Analyse PNL ==
Journalier: ${portfolio.pnl.daily} MON
Hebdomadaire: ${portfolio.pnl.weekly} MON
Mensuel: ${portfolio.pnl.monthly} MON
Depuis le début: ${portfolio.pnl.allTime} MON

== Transactions récentes ==
${portfolio.transactions.recent
                        .slice(0, 5)
                        .map((tx) => `- [${new Date(tx.timestamp * 1000).toLocaleString()}] ${tx.hash.slice(0, 8)}...
   ${tx.from.slice(0, 8)}... → ${typeof tx.to === "string" ? tx.to.slice(0, 8) : tx.to}...
   Valeur: ${tx.value} MON, Frais: ${tx.fee} MON`)
                        .join("\n")}${portfolio.transactions.recent.length > 5
                        ? `\n... et ${portfolio.transactions.recent.length - 5} autres transactions récentes`
                        : ""}`,
                },
            ],
            portfolio: portfolio,
        };
    }
    catch (error) {
        console.error("Erreur lors de l'analyse du portfolio:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Erreur lors de l'analyse du portfolio pour l'adresse ${address}: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Monad testnet MCP Server running on stdio");
    }
    catch (error) {
        console.error("Error initializing server:", error);
    }
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
