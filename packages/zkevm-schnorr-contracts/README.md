# BMCP Citrea Schnorr Verification Contracts

This repository contains smart contracts for **BMCP (Bitcoin Multichain Protocol)** that integrate Bitcoin OP_RETURN messages with Citrea's Schnorr signature verification precompiles.

## 🎯 Overview

**Bitcoin → Citrea with Schnorr Verification**

These contracts enable trustless execution of function calls on Citrea triggered from Bitcoin transactions, with cryptographic proof via Schnorr signature verification:

1. **User** creates Bitcoin transaction with OP_RETURN payload
2. **Bitcoin** transaction is mined and confirmed
3. **Relayer** extracts message from OP_RETURN + signature from transaction input
4. **Citrea** verifies Schnorr signature using precompile
5. **Contract** executes authorized function call

## 📦 Contracts

### BMCP Core Contracts

1. **BMCPMessageReceiver.sol** - Main receiver contract that:
   - Receives messages from BMCP relayer
   - Verifies Bitcoin Schnorr signatures using Citrea precompile
   - Validates authorization constraints (allowed contracts, functions, limits)
   - Executes authorized function calls
   - Implements replay protection via nonces

2. **ExampleTargetContract.sol** - Example contract demonstrating:
   - Message storage from Bitcoin
   - Token transfers
   - Data storage
   - Swap operations
   - Batch execution

### Legacy Lightning Contracts

3. **LightningOracle.sol** - Oracle for Lightning Network payment verification
4. **LightningOraclePrivate.sol** - Privacy-preserving Lightning oracle (Schnorr-Private-2.0)
5. **DeFiContract.sol** - DeFi actions triggered by Lightning payments
6. **DeFiContractPrivate.sol** - Liquidity mining incentives for Citrea node hubs
7. **TrexToken.sol** - ERC20 token for the ecosystem
8. **SchnorrVerifyCaller.sol** - Low-level Schnorr verification example
9. **P256R1VerifyCaller.sol** - secp256r1 signature verification example

## 🚀 Features

### BMCP Integration

- **Schnorr Signature Verification**: Verifies signatures from Bitcoin transaction inputs
- **Authorization System**: Granular control over which contracts and functions can be called
- **Replay Protection**: Nonce-based protection against replay attacks
- **Deadline Enforcement**: Messages expire after deadline
- **Value Limits**: Maximum value constraints for function calls
- **Trustless Execution**: No trust in relayer required (signature verified on-chain)

### Message Structure

```solidity
struct BMCPMessage {
    bytes2 protocol;             // 0x4243 ("BC")
    uint64 chainSelector;        // Citrea chain ID
    address targetContract;      // Contract to call
    bytes data;                  // Function calldata
    uint256 nonce;               // Replay protection
    uint256 deadline;            // Message expiry
    Authorization authorization; // Constraints
}

struct Authorization {
    address allowedContract;     // Which contract
    bytes4 allowedFunction;      // Which function
    uint256 maxValue;            // Max value in wei
    uint256 validUntil;          // Auth expiry
}
```

## 📋 Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js (for integration)

## 🛠️ Setup

1. Navigate to contracts directory:

```bash
cd packages/citrea-schnorr-contracts
```

2. Install dependencies:

```bash
forge install
```

3. Copy environment file:

```bash
cp env.example .env
```

4. Configure `.env`:

```bash
# Add your private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Add RPC URLs
CITREA_RPC_URL=https://rpc.citrea.xyz
CITREA_TESTNET_RPC_URL=https://rpc.testnet.citrea.xyz
```

## 🏗️ Building

Compile contracts:

```bash
forge build
```

## 🧪 Testing

Run tests:

```bash
forge test
```

Run with gas reporting:

```bash
forge test --gas-report
```

Run with verbose output:

```bash
forge test -vvv
```

## 🚢 Deployment

### Citrea Testnet

Deploy BMCP contracts:

```bash
forge script script/DeployBMCP.s.sol --rpc-url citrea_testnet --broadcast --verify
```

Or use the deployment script:

```bash
./deploy.sh testnet bmcp
```

### Local Development (Anvil)

1. Start Anvil:

```bash
anvil
```

2. Deploy contracts:

```bash
forge script script/DeployBMCP.s.sol --rpc-url http://localhost:8545 --broadcast
```

## 🎯 Usage Example

### 1. Create Message on Bitcoin (TypeScript)

```typescript
import { BitcoinCommandEncoder, BitcoinFunctionEncoder } from '@bmcp/sdk';

// Create function call
const transferCall = BitcoinFunctionEncoder.custom(
  'transfer(address,uint256)',
  ['0xRecipient', '1000000']
);

// Encode with authorization
const payload = BitcoinCommandEncoder.encodeJSON(
  'CITREA_TESTNET',
  '0xTargetContract',
  transferCall,
  {
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    authorization: {
      allowedContract: '0xTargetContract',
      allowedFunction: '0xa9059cbb',  // transfer selector
      maxValue: '1000000',
      validUntil: Math.floor(Date.now() / 1000) + 3600
    }
  }
);

// Post to Bitcoin (payload goes in OP_RETURN)
```

### 2. Bitcoin Transaction Structure

```
Transaction {
  inputs: [
    {
      witness: [
        signature,  // ← Schnorr signature (64 bytes)
        pubkey      // ← Public key (33 bytes)
      ]
    }
  ],
  outputs: [
    {
      value: 0,
      scriptPubKey: OP_RETURN <payload>  // ← BMCP message
    }
  ]
}
```

### 3. Relayer Forwards to Citrea

```typescript
// Relayer extracts from Bitcoin
const message = extractOpReturn(tx);
const signature = tx.inputs[0].witness[0];
const pubkey = tx.inputs[0].witness[1];

// Forward to Citrea
await receiverContract.receiveMessage(
  tx.txid,
  message,
  { pubKeyX: pubkey, signature: signature }
);
```

### 4. Citrea Verifies and Executes

```solidity
// BMCPMessageReceiver automatically:
// 1. Verifies Schnorr signature
// 2. Checks authorization
// 3. Validates nonce
// 4. Executes function call
```

## 🔐 Security Features

1. **Cryptographic Verification**: Schnorr signatures verified using Citrea precompile
2. **Authorization Constraints**: Only whitelisted contracts and functions can be called
3. **Replay Protection**: Nonce-based protection against duplicate messages
4. **Deadline Enforcement**: Messages expire after deadline
5. **Value Limits**: Maximum value constraints prevent excessive transfers
6. **Relayer Independence**: No trust in relayer (signature verified on-chain)

## 📊 Architecture

```
┌──────────────┐
│   Bitcoin    │  1. User signs message with Bitcoin key
│ Transaction  │     Signs: hash(message data + nonce)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  OP_RETURN   │  2. Message embedded in OP_RETURN
│   Payload    │     Contains: target, function, auth constraints
└──────┬───────┘
       │
       ▼
┌──────────────┐
│BMCP Relayer  │  3. Relayer extracts message + signature
│              │     Gets sig from tx.inputs[0].witness
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Citrea     │  4. Schnorr precompile verifies signature
│  Precompile  │     Address: 0x0200
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   BMCP       │  5. Receiver validates authorization
│  Receiver    │     Checks: contract, function, limits
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Target     │  6. Function executed if all checks pass
│  Contract    │     Result emitted in events
└──────────────┘
```

## 🔍 Contract Addresses

### Citrea Testnet (Chain ID: 5115)

**BMCP Contracts:**
- BMCPMessageReceiver: *Deploy and update here*
- ExampleTargetContract: *Deploy and update here*

**Legacy Lightning Contracts (Already Deployed):**
- TrexToken: `0x94c17DD37ED3Ca85764b35BfD4d1CCc543b1bE3E`
- LightningOracle: `0x4a95E7e42c968A6c7BFBBb2F2AA908463B46059E`
- DeFiContract: `0x9d24c52916A14afc31D86B5Aa046b252383ee444`
- LightningOraclePrivate: `0xc36B6BFa0ce8C6bdD8efcCd23CeC2E425768f64a`
- DeFiContractPrivate: `0x90e97EF730B28B14b3F5f9214f47312796b6c10e`

## 🧩 Integration with BMCP Stack

This contract package integrates with:

1. **@bmcp/sdk** - Message encoding/decoding
2. **@bmcp/bitcoin-api** - Bitcoin transaction creation
3. **@bmcp/relayer-api** - Message relay from Bitcoin to Citrea
4. **@bmcp/client** - Client library for sending messages

## 🛣️ Roadmap

- [x] BMCPMessageReceiver with Schnorr verification
- [x] Authorization system
- [x] Example target contract
- [x] Deployment scripts
- [x] Basic tests
- [ ] Full integration tests with real Schnorr signatures
- [ ] Multi-sig authorization support
- [ ] Advanced rate limiting
- [ ] Gasless transactions (relayer pays gas)
- [ ] Mainnet deployment

## 📝 License

MIT License - see individual contract files for details.

## 🤝 Contributing

Contributions welcome! Please check the main BMCP repository for contribution guidelines.

## 🔗 Related Projects

- [BMCP Core](../../) - Main BMCP protocol
- [Citrea](https://citrea.xyz) - Bitcoin-secured rollup with ZK proofs
- [BIP340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) - Schnorr signatures for Bitcoin
