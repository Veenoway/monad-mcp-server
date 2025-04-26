# Monad MCP Tutorial

This project is an MCP (Model Context Protocol) server for interacting with the Monad testnet blockchain. It provides several tools to facilitate development and interactions with the blockchain.

## Features

The MCP server provides the following functionalities:

### Smart Contracts

- **deploy-solidity-source**: Compile and deploy Solidity source code directly to the Monad testnet.

### NFTs

- **get-nft-holders**: Retrieve the list of holders of a specific NFT (ERC721 or ERC1155).

### DeFi

- **token-swap**: Exchange tokens on DEXs available on Monad testnet (Uniswap, SushiSwap).

## Installation

1. Clone this repository
2. Install dependencies with `npm install`
3. Run the server with `npm start`

## Prompt Examples for Claude

Here are examples of prompts you can send to Claude to use the MCP tools:

### Get NFT Holders

```
Get the list of NFT holders for contract 0xNFT_Contract_Address on Monad testnet. It's an ERC721 contract. Limit to 20 holders.
```

For a specific token:

```
Who owns the NFT with token ID 123 in contract 0xNFT_Contract_Address on Monad testnet? It's an ERC721 contract.
```

### Token Swapping on DEX

To check available liquidity before swapping:

```
Check liquidity for token 0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701 on Uniswap on Monad testnet. I want to swap 0.1 MON. Here's my private key: YOUR_PRIVATE_KEY
```

To swap MON for a token:

```
Swap 0.1 MON for tokens at address 0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701 on Uniswap on Monad testnet. Use 1% slippage. Here's my private key: YOUR_PRIVATE_KEY
```

To swap between two tokens:

```
Swap 10 tokens from TCHOG to WMON on Uniswap on Monad testnet. Use 0.5% slippage. Here's my private key: YOUR_PRIVATE_KEY
```

### Creating a Smart contract and deploy it ( could be anything )

```
Create a NFT smart contract with whitelist. The whitelist should last 1 day then turn into public sale. Total supply should be 1000, name should be NoveeNFT with symbol NOV. Public price should be 10 MON, whitelist price 0.2 MON.

Then deploy it using my private key: YOUR_PRIVATE_KEY
```

## DEX Configuration

The DEX addresses on Monad testnet are configured as follows:

- **Uniswap V2 Router**: 0xfb8e1c3b833f9e67a71c859a132cf783b645e436
- **Uniswap V2 Factory**: 0x733e88f248b742db6c14c0b1713af5ad7fdd59d0
- **Uniswap V3 Factory**: 0x961235a9020b05c44df1026d956d1f4d78014276
- **Uniswap Universal Router**: 0x3ae6d8a282d67893e17aa70ebffb33ee5aa65893

## Integration with Claude Desktop

1. Open Claude Desktop
2. Go to Settings > Developer
3. Open `claude_desktop_config.json`
4. Add the following configuration:

```json
{
  "mcpServers": {
    "monad-mcp": {
      "command": "node",
      "args": ["/<path-to-project>/build/index.js"]
    }
  }
}
```

5. Restart Claude Desktop

## Sample NFT Contract Output

When you ask Claude to create an NFT contract with whitelist, it will generate something like this:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract NoveeNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant WL_PRICE = 0.2 ether;
    uint256 public constant PUBLIC_PRICE = 10 ether;

    uint256 public totalSupply;
    uint256 public whitelistEndTime;
    string public baseURI;

    mapping(address => bool) public whitelist;

    constructor() ERC721("NoveeNFT", "NOV") Ownable(msg.sender) {
        whitelistEndTime = block.timestamp + 1 days;
    }

    function addToWhitelist(address[] calldata addresses) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = true;
        }
    }

    function mint(uint256 quantity) external payable {
        require(totalSupply + quantity <= MAX_SUPPLY, "Exceeds max supply");

        uint256 price;
        if (block.timestamp < whitelistEndTime) {
            require(whitelist[msg.sender], "Not whitelisted");
            price = WL_PRICE;
        } else {
            price = PUBLIC_PRICE;
        }

        require(msg.value >= price * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = totalSupply + 1;
            _safeMint(msg.sender, tokenId);
            totalSupply++;
        }
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }
}
```

## About MCP

Model Context Protocol (MCP) is a standard that allows AI models to interact with external tools and services. In this project, we create an MCP server that allows Claude to interact with the Monad blockchain.

## Resources

- [Monad Documentation](https://docs.monad.xyz/)
- [Monad Testnet Explorer](https://testnet.monadexplorer.com/)
- [MCP Documentation](https://modelcontextprotocol.io/introduction)

## License

MIT
