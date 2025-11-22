# BMCP - Bitcoin Multichain Protocol

**Bitcoin to EVM Cross-Chain Messaging via Chainlink CCIP**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-orange.svg)](https://soliditylang.org/)

## Overview

BMCP (Bitcoin Multichain Protocol) enables **x402 cross-chain messaging from Lightning Bitcoin** to EVM chains using **Chainlink CCIP** and the revolutionary **100KB OP_RETURN** capacity in Bitcoin Core v30.0.

### Key Features

✅ **100KB OP_RETURN**: Store complete CCIP messages on-chain (no external storage needed)  
✅ **Single Bitcoin TX**: One transaction triggers cross-chain operations  
✅ **Standard CCIP**: Works with existing Chainlink infrastructure  
✅ **Trustless**: Bitcoin provides immutable message ordering  
✅ **Complex Operations**: Support for batch DeFi operations, multi-step transactions  
✅ **Lightning Integration**: CDP Facilitator enables Lightning → Bitcoin → EVM flows  

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│   User/DApp │─────▶│   Bitcoin    │─────▶│ CRE Relayer  │─────▶│ CCIP Network│
│             │      │ CCIP Client  │      │              │      │             │
└─────────────┘      └──────────────┘      └──────────────┘      └─────────────┘
                            │                      │                      │
                            ▼                      ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐      ┌─────────────┐
                     │   Bitcoin    │      │   Bitcoin    │      │  Base Chain │
                     │   Network    │      │   Blocks     │      │             │
                     │  (100KB OP_  │      │   Scanner    │      │  Receiver   │
                     │   RETURN)    │      │              │      │  Contract   │
                     └──────────────┘      └──────────────┘      └─────────────┘
```

## Protocol Flow

### Phase 1: Message Construction (< 1 second)
- User initiates via Bitcoin CCIP Client
- Client encodes full CCIP-compatible message
- Message validated to fit within 100KB limit
- Complete message embedded in Bitcoin OP_RETURN

### Phase 2: Bitcoin Settlement (~10 minutes)
- Transaction broadcast to Bitcoin network
- Block mined and confirmed
- Message permanently committed on Bitcoin blockchain

### Phase 3: Relayer Detection (~30 seconds)
- CRE relayer monitors new Bitcoin blocks
- Filters for protocol ID `0x4243`
- Extracts complete message from OP_RETURN
- Transforms into standard CCIP `Any2EVMMessage`

### Phase 4: CCIP Routing (2-5 minutes)
- Message validated by Risk Management Network
- Routed through CCIP network to destination chain
- Delivered to destination OffRamp contract

### Phase 5: Execution (~2 seconds)
- Destination contract receives via `ccipReceive()`
- Verifies Bitcoin as valid source chain
- Decodes and executes embedded function call
- Emits confirmation event

**Total Time**: ~15-20 minutes (Bitcoin finality dominates)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/BMCP.git
cd BMCP

# Install dependencies
npm install

# Install contract dependencies
cd contracts && npm install && cd ..

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Create a `.env` file with the following:

```env
# Bitcoin Node Configuration
BITCOIN_RPC_URL=http://localhost:8332
BITCOIN_RPC_USER=your_rpc_user
BITCOIN_RPC_PASSWORD=your_rpc_password
BITCOIN_NETWORK=testnet

# EVM Configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here

# CCIP Configuration
CCIP_ROUTER_BASE=0x... # CCIP Router on Base
BITCOIN_CHAIN_SELECTOR=0x424954434f494e

# CRE Relayer Configuration
CRE_START_BLOCK=850000
CRE_CONFIRMATION_BLOCKS=6
CRE_POLL_INTERVAL_MS=30000
```

## Usage

### 1. Simple Cross-Chain Message

```typescript
import { BitcoinCCIPClient, CHAIN_SELECTORS } from 'bmcp';
import { ethers } from 'ethers';

// Initialize client
const client = new BitcoinCCIPClient({
  url: 'http://localhost:8332',
  user: 'bitcoin',
  password: 'password',
  network: 'testnet',
});

// Encode message data
const recipient = '0xYourAddress';
const amount = ethers.parseEther('0.1');
const messageData = BitcoinCCIPClient.encodeDepositMessage(recipient, amount);

// Send to Base chain
const receipt = await client.sendToBase(
  '0xReceiverContract', // Receiver contract on Base
  messageData,
  { gasLimit: 300_000 }
);

console.log('Transaction ID:', receipt.txid);
```

### 2. Batch DeFi Operations

```typescript
// Encode complex batch operation: Swap → Deposit → Borrow
const operations = {
  targets: ['0xUniswap', '0xAave', '0xCompound'],
  calls: [
    swapCalldata,    // Swap BTC to USDC
    depositCalldata, // Deposit USDC to Aave
    borrowCalldata,  // Borrow ETH from Compound
  ],
};

const batchData = ethers.AbiCoder.defaultAbiCoder().encode(
  ['bytes4', 'address[]', 'bytes[]'],
  [
    ethers.id('batchExecute(address[],bytes[])').slice(0, 10),
    operations.targets,
    operations.calls,
  ]
);

// All operations execute atomically on Base!
const receipt = await client.sendToBase(
  '0xDeFiGateway',
  batchData,
  { gasLimit: 1_000_000 }
);
```

### 3. Start CRE Relayer

```bash
# Build the project
npm run build

# Start the relayer
npm run start:relayer
```

The relayer will:
- Monitor Bitcoin blockchain for protocol messages
- Extract and validate CCIP messages from OP_RETURN
- Forward messages to CCIP network
- Route to destination EVM chains

### 4. Deploy Smart Contracts

```bash
cd contracts

# Compile contracts
npm run compile

# Deploy to Base Sepolia (testnet)
npm run deploy:sepolia

# Deploy to Base mainnet
npm run deploy:base
```

## Smart Contracts

### BitcoinCCIPReceiver

Base abstract contract for receiving messages from Bitcoin:

```solidity
import {BitcoinCCIPReceiver} from "bmcp/contracts/BitcoinCCIPReceiver.sol";

contract MyReceiver is BitcoinCCIPReceiver {
    constructor(address router, uint64 bitcoinChainSelector)
        BitcoinCCIPReceiver(router, bitcoinChainSelector)
    {}

    function processMessage(Client.Any2EVMMessage calldata message)
        external override
    {
        // Your custom logic here
        bytes32 btcAddress = decodeBitcoinAddress(message.sender);
        // Process message.data
    }
}
```

### SimpleBitcoinReceiver

Example contract demonstrating basic message handling:
- Receives and stores messages from Bitcoin
- Decodes function calls from message data
- Handles deposit operations
- Emits events for tracking

### BitcoinDeFiGateway

Advanced DeFi gateway supporting:
- Bitcoin deposits with wrapped BTC minting
- Token swaps initiated from Bitcoin
- Batch operations (multi-step DeFi)
- Balance tracking per Bitcoin address
- Replay protection

## Protocol Specification

### Message Format

```
┌──────────────────────────────────────────────────────────┐
│ Protocol ID (2 bytes)         │ 0x4243 ("BC")           │
├──────────────────────────────────────────────────────────┤
│ Version (1 byte)              │ 0x02 (v2.0)             │
├──────────────────────────────────────────────────────────┤
│ Chain Selector (8 bytes)      │ Destination CCIP chain  │
├──────────────────────────────────────────────────────────┤
│ Receiver (20 bytes)           │ EVM contract address    │
├──────────────────────────────────────────────────────────┤
│ Data Length (4 bytes)         │ Length of payload       │
├──────────────────────────────────────────────────────────┤
│ Data (variable, up to ~99KB)  │ Full EVM message        │
├──────────────────────────────────────────────────────────┤
│ Gas Limit (8 bytes)           │ Execution gas limit     │
├──────────────────────────────────────────────────────────┤
│ Extra Args (variable)         │ CCIP extraArgs          │
└──────────────────────────────────────────────────────────┘

Total: ~35 bytes overhead + message payload (max ~99,965 bytes)
```

### Bitcoin Transaction Structure

```
Transaction {
  version: 2
  inputs: [UTXO(s) for fees]
  outputs: [
    {
      value: 0,
      scriptPubKey: OP_RETURN <message_bytes>
    },
    {
      value: remaining_balance,
      scriptPubKey: <change_address>
    }
  ]
  locktime: 0
}
```

### CCIP Message Mapping

| Bitcoin Field | CCIP Field | Notes |
|--------------|------------|-------|
| txid | messageId | Bitcoin txid serves as unique message ID |
| Protocol ID | N/A | Protocol identifier (0x4243) |
| Chain Selector | destChainSelector | Destination EVM chain |
| Receiver | receiver | EVM contract address |
| Data | message.data | ABI-encoded function call |
| Sender (derived) | sender | Bitcoin address (hashed) |

## Advanced Features

### Multiple OP_RETURN Outputs

Send to multiple chains in ONE Bitcoin transaction:

```typescript
const tx = await bitcoinRPC.createTransaction({
  outputs: [
    { script: `OP_RETURN ${baseMsg}`, value: 0 },     // → Base
    { script: `OP_RETURN ${arbitrumMsg}`, value: 0 }, // → Arbitrum
    { script: `OP_RETURN ${optimismMsg}`, value: 0 }, // → Optimism
  ]
});
```

### Rich Metadata

Include extensive on-chain metadata:

```typescript
struct RichMessage {
    address receiver;
    bytes calldata;
    string description;      // Human-readable
    bytes32[] proofs;        // Merkle proofs
    Signature[] signatures;  // Multi-sig
    uint256 timestamp;
    bytes extraData;
}
```

### Lightning Integration (x402)

BMCP extends **x402** protocol for Lightning → Bitcoin → EVM flows:

1. Lightning payment initiated
2. CDP Facilitator settles to Bitcoin
3. Bitcoin CCIP Client embeds message in OP_RETURN
4. CRE Relayer forwards to CCIP
5. Message executes on EVM chain

## Security Considerations

1. **Bitcoin Finality**: Wait for 6 confirmations (~60 min) for high-value operations
2. **Protocol ID Filtering**: CRE relayer validates protocol ID `0x4243` to prevent spam
3. **Message Size Limits**: Enforce 100KB hard limit to prevent mempool issues
4. **Receiver Validation**: EVM contracts must whitelist Bitcoin as trusted source
5. **Replay Protection**: Bitcoin txid serves as unique message identifier
6. **Multi-sig Support**: CRE relayer can require multiple operator signatures

## Testing

```bash
# Run TypeScript tests
npm test

# Run with coverage
npm test -- --coverage

# Test smart contracts
cd contracts
npx hardhat test

# Deploy to local network
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

## Examples

Check the `/examples` directory for complete working examples:

- `simple-usage.ts` - Basic cross-chain message
- `batch-operations.ts` - Complex multi-step DeFi operations
- `lightning-integration.ts` - x402 Lightning flows (coming soon)

## Performance & Costs

### Timing Breakdown

| Phase | Duration | Notes |
|-------|----------|-------|
| Message Construction | < 1 second | Local encoding |
| Bitcoin Broadcast | < 5 seconds | P2P propagation |
| Block Confirmation | ~10 minutes | 1 block (6 blocks for finality) |
| CRE Detection | < 30 seconds | Block scan + parse |
| CCIP Routing | 2-5 minutes | Cross-chain validation |
| EVM Execution | ~2 seconds | Contract execution |
| **Total (1 conf)** | **~15 minutes** | Bitcoin finality dominates |
| **Total (6 confs)** | **~65 minutes** | High-value operations |

### Bitcoin Fees

- OP_RETURN output: 0 value
- Transaction size: ~300-1000 vbytes (depending on message size)
- Fee: ~300-1000 sats at 1 sat/vbyte (~$0.20-$0.70 at $70K BTC)

### CCIP Fees

- Variable based on destination chain and message size
- Typically $1-10 for Base chain
- Paid by relayer (can be subsidized or passed to user)

## Comparison with Other Solutions

| Feature | BMCP | Traditional Bridges | Other Bitcoin L2s |
|---------|------|---------------------|-------------------|
| Message Size | 100KB | Limited | Limited |
| Settlement | Bitcoin L1 | Validator Set | Sidechain |
| Trust Model | Trustless | Multi-sig | Federation |
| CCIP Integration | Native | No | No |
| Complex Operations | ✅ | ❌ | ⚠️ |
| Lightning Support | ✅ (x402) | ❌ | ⚠️ |

## Roadmap

- [x] Core protocol implementation
- [x] Bitcoin CCIP Client
- [x] CRE Relayer
- [x] Base chain contracts
- [x] Message encoding/decoding
- [ ] Production relayer infrastructure
- [ ] Multi-chain support (Arbitrum, Optimism, Polygon)
- [ ] Lightning x402 integration
- [ ] Enhanced security audits
- [ ] Mainnet launch
- [ ] Governance token

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Bitcoin Core v30.0** for 100KB OP_RETURN support
- **Chainlink CCIP** for cross-chain messaging infrastructure
- **Base** for EVM execution environment
- **x402 Protocol** for Lightning integration concepts

## Contact

- GitHub: [@yourusername](https://github.com/yourusername)
- Twitter: [@yourtwitter](https://twitter.com/yourtwitter)
- Discord: [BMCP Community](https://discord.gg/bmcp)

## Support

If you find this project useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 📖 Improving documentation

---

**Built with ❤️ for Bitcoin and EVM interoperability**
