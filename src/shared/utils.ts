import { ethers } from "ethers";

/**
 * Détecte le type de paramètre à partir d'une chaîne de caractères
 */
export function detectParamType(param: string): string {
  if (!param) return "unknown";

  const cleanParam = param.replace(/memory|calldata|storage/g, "").trim();

  const parts = cleanParam.split(" ").filter((p) => p);
  if (parts.length === 0) return "unknown";

  return parts[0];
}

/**
 * Convertit une valeur en fonction du type de paramètre
 */
export function convertConstructorArg(value: any, paramType: string): any {
  console.error(`Converting ${value} to type ${paramType}`);

  if (paramType.includes("uint") || paramType.includes("int")) {
    return ethers.toBigInt(value.toString());
  } else if (paramType.includes("bool")) {
    return Boolean(value);
  } else if (paramType.includes("address")) {
    return value.toString();
  } else if (paramType.includes("bytes")) {
    if (typeof value === "string" && value.startsWith("0x")) {
      return value;
    }
    return `0x${value.toString()}`;
  } else {
    return value;
  }
}

export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Détermine le niveau de risque
 */
export function determineRiskLevel(score: number): string {
  if (score < 35) return "🟢 Faible risque";
  if (score < 70) return "🟠 Risque moyen";
  return "🔴 Risque élevé";
}

/**
 * Détection des modèles de proxy dans un bytecode
 */
export function detectProxyPattern(bytecode: string): string[] {
  const patterns = [];

  // Recherche du modèle EIP-1967
  if (
    bytecode.includes("5c60da1b") || // implementation slot
    bytecode.includes(
      "360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    )
  ) {
    patterns.push("EIP-1967 Proxy");
  }

  // Recherche du modèle Transparent Proxy
  if (
    bytecode.includes("5c19a95c") || // admin slot
    bytecode.includes("delegatecall")
  ) {
    patterns.push("Transparent Proxy");
  }

  // Recherche du modèle UUPS Proxy
  if (
    bytecode.includes("52d1902d") || // UUPSUpgradeable interface
    bytecode.includes("upgradeTo")
  ) {
    patterns.push("UUPS Proxy");
  }

  return patterns;
}

/**
 * Détection des standards de contrat dans un bytecode
 */
export function detectContractStandards(bytecode: string): string[] {
  const standards = [];

  // ERC-20
  if (
    bytecode.includes("a9059cbb") || // transfer
    bytecode.includes("dd62ed3e") || // allowance
    bytecode.includes("095ea7b3") || // approve
    bytecode.includes("70a08231") // balanceOf
  ) {
    standards.push("ERC-20");
  }

  // ERC-721
  if (
    bytecode.includes("6352211e") || // ownerOf
    bytecode.includes("42842e0e") || // safeTransferFrom
    bytecode.includes("b88d4fde") // safeTransferFrom with data
  ) {
    standards.push("ERC-721");
  }

  // ERC-1155
  if (
    bytecode.includes("f242432a") || // safeTransferFrom
    bytecode.includes("2eb2c2d6") || // safeBatchTransferFrom
    bytecode.includes("00fdd58e") // balanceOf
  ) {
    standards.push("ERC-1155");
  }

  // ERC-777
  if (
    bytecode.includes("959b8c3f") || // authorizeOperator
    bytecode.includes("fe9d9303") || // isOperatorFor
    bytecode.includes("75ab9782") // revokeOperator
  ) {
    standards.push("ERC-777");
  }

  return standards;
}
