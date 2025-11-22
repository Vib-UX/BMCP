# @bmcp/dashboard

Web dashboard for Bitcoin Multichain Protocol - allows users to create and send cross-chain messages from Bitcoin to EVM chains.

## Features

- 🔗 Multi-chain support (Base, Citrea, Polygon, Ethereum, Arbitrum)
- 👛 Xverse wallet integration
- 🔧 Function signature builder with common presets
- 📊 Real-time message preview
- ✅ Input validation
- 🎨 Modern, responsive UI

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens the dashboard at http://localhost:3000

## Build

```bash
npm run build
```

## Usage

1. Install [Xverse Wallet](https://xverse.app)
2. Connect your wallet
3. Select destination chain
4. Enter receiver contract address
5. Choose or enter function signature
6. Provide function arguments as JSON array
7. Sign and send the transaction

## Requirements

- Node.js 18+
- Xverse Wallet browser extension
- Bitcoin node (regtest/testnet/mainnet)

