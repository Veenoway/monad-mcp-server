# Monad Wormhole NFT MCP Server

Ce projet implémente un serveur MCP permettant de transférer des NFTs entre différentes chaînes via Wormhole, avec un support particulier pour Monad testnet.

## Fonctionnalités

- Transfert de NFTs entre Monad, Ethereum et Solana
- Vérification du statut des transferts
- Support du testnet Monad

## Prérequis

- Node.js (v16 ou supérieur)
- npm ou yarn
- Claude Desktop

## Installation

1. Clonez le dépôt :

```bash
git clone https://github.com/votre-username/monad-wormhole-mcp.git
```

2. Installez les dépendances :

```bash
npm install
```

3. Compilez le projet :

```bash
npm run build
```

## Configuration de Claude Desktop

1. Ouvrez les paramètres de Claude Desktop
2. Allez dans Developer Settings
3. Ajoutez la configuration suivante dans `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "monad-wormhole-nft": {
      "command": "node",
      "args": ["/chemin/vers/votre/projet/dist/index.js"]
    }
  }
}
```

## Utilisation

Le serveur MCP expose deux outils principaux :

1. `transfer-nft` : Pour transférer un NFT entre chaînes

   - Paramètres :
     - sourceChain : Chaîne source (monad, ethereum, solana)
     - targetChain : Chaîne cible (monad, ethereum, solana)
     - nftAddress : Adresse du contrat NFT
     - tokenId : ID du token NFT
     - recipientAddress : Adresse du destinataire

2. `get-nft-status` : Pour vérifier le statut d'un transfert
   - Paramètres :
     - sourceChain : Chaîne source du transfert
     - transactionHash : Hash de la transaction

## Exemple d'utilisation

```typescript
// Transfert d'un NFT de Monad vers Ethereum
const transfer = await mcp.transferNft({
  sourceChain: "monad",
  targetChain: "ethereum",
  nftAddress: "0x...",
  tokenId: "123",
  recipientAddress: "0x...",
});

// Vérification du statut
const status = await mcp.getNftStatus({
  sourceChain: "monad",
  transactionHash: "0x...",
});
```

## Ressources

- [Documentation Wormhole](https://docs.wormhole.com/)
- [Documentation Monad](https://docs.monad.xyz/)
- [Documentation MCP](https://docs.mcp.com/)
