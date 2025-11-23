# BMCP Citrea Schnorr - Quick Start Guide

## 🚀 What Was Built

### New BMCP-Specific Contracts

1. **BMCPMessageReceiver.sol** - Main receiver contract
   - Verifies Bitcoin Schnorr signatures
   - Checks authorization constraints
   - Executes authorized function calls
   - Implements nonce-based replay protection

2. **ExampleTargetContract.sol** - Example contract
   - Demonstrates various function calls from Bitcoin
   - Store messages, transfer tokens, store data, swaps

3. **Deployment scripts and tests**
   - `DeployBMCP.s.sol` - Foundry deployment script
   - `BMCPMessageReceiver.t.sol` - Unit tests (9 tests, all passing ✅)

## 📋 Quick Setup

### 1. Build Contracts

```bash
cd packages/citrea-schnorr-contracts
forge build
```

### 2. Run Tests

```bash
forge test
```

All 9 tests should pass ✅

### 3. Deploy to Citrea Testnet

```bash
# Set your private key in .env
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "CITREA_TESTNET_RPC_URL=https://rpc.testnet.citrea.xyz" >> .env

# Deploy
forge script script/DeployBMCP.s.sol --rpc-url citrea_testnet --broadcast
```

## 🎯 How It Works

### Step-by-Step Flow

**1. User Creates Bitcoin Transaction**

```typescript
// Using BMCP SDK
const payload = BitcoinCommandEncoder.encodeJSON(
  'CITREA_TESTNET',
  targetContract,
  functionCalldata,
  {
    nonce: 0,
    authorization: {
      allowedContract: '0x...',
      allowedFunction: '0xa9059cbb',
      maxValue: '0',
      validUntil: timestamp
    }
  }
);

// Post to Bitcoin with OP_RETURN
```

**2. Bitcoin Transaction Structure**

```
inputs: [
  {
    witness: [signature, pubkey]  ← Schnorr signature here
  }
]
outputs: [
  {
    value: 0,
    scriptPubKey: OP_RETURN <payload>  ← BMCP message here
  }
]
```

**3. Relayer Extracts & Forwards**

```typescript
const signature = tx.inputs[0].witness[0];  // 64 bytes
const pubkey = tx.inputs[0].witness[1];     // 33 bytes
const message = extractOpReturn(tx);

await receiverContract.receiveMessage(
  txid,
  message,
  { pubKeyX: pubkey.slice(1, 33), signature }
);
```

**4. Citrea Verifies & Executes**

```solidity
// BMCPMessageReceiver automatically:
1. Verifies Schnorr signature (Citrea precompile 0x0200)
2. Checks authorization (contract, function, limits)
3. Validates nonce (prevents replay)
4. Executes function call
```

## 📝 Example: Store Message from Bitcoin

### On Bitcoin Side

```typescript
// Create message
const call = BitcoinFunctionEncoder.custom(
  'storeMessage(string)',
  ['Hello from Bitcoin!']
);

// Encode with authorization
const payload = BitcoinCommandEncoder.encodeJSON(
  'CITREA_TESTNET',
  '0xExampleTargetContract',
  call,
  {
    nonce: 0,
    deadline: Date.now() + 3600,
    authorization: {
      allowedContract: '0xExampleTargetContract',
      allowedFunction: '0x...',  // storeMessage selector
      maxValue: '0',
      validUntil: Date.now() + 86400
    }
  }
);

// Post to Bitcoin OP_RETURN
```

### On Citrea Side

```solidity
// After verification, this executes:
ExampleTargetContract.storeMessage("Hello from Bitcoin!");

// Message is stored and event emitted:
event MessageReceived(
    address sender,      // Derived from Bitcoin pubkey
    string message,      // "Hello from Bitcoin!"
    uint256 timestamp
);
```

## 🔐 Security Features

### 1. Schnorr Signature Verification

```solidity
// Calls Citrea precompile at 0x0200
function verifySchnorr(
    bytes32 pubKeyX,
    bytes32 messageHash,
    bytes signature
) returns (bool);
```

### 2. Authorization Constraints

```solidity
struct Authorization {
    address allowedContract;   // Only this contract
    bytes4 allowedFunction;    // Only this function
    uint256 maxValue;          // Max wei value
    uint256 validUntil;        // Expiry timestamp
}
```

### 3. Replay Protection

```solidity
// Nonce increments per Bitcoin pubkey
mapping(bytes32 => uint256) public bitcoinNonces;

// Each txid processed only once
mapping(bytes32 => bool) public processedMessages;
```

## 🧪 Testing

### Run All Tests

```bash
forge test -vv
```

### Test Specific Function

```bash
forge test --match-test test_Deployment -vvv
```

### Test with Gas Report

```bash
forge test --gas-report
```

## 🚢 Deployment Checklist

- [ ] Build contracts: `forge build`
- [ ] Run tests: `forge test`
- [ ] Set environment variables in `.env`
- [ ] Deploy: `forge script script/DeployBMCP.s.sol --rpc-url citrea_testnet --broadcast`
- [ ] Verify contracts on Citrea explorer
- [ ] Configure relayer with receiver address
- [ ] Test with Bitcoin testnet transaction
- [ ] Monitor Citrea events for verification

## 📊 Contract Addresses (Update After Deployment)

### Citrea Testnet

```
BMCPMessageReceiver: 0x...
ExampleTargetContract: 0x...
```

### Configuration

```typescript
const config = {
  citreaTestnet: {
    chainId: 5115,
    rpcUrl: 'https://rpc.testnet.citrea.xyz',
    receiver: '0x...',  // BMCPMessageReceiver
    target: '0x...',    // ExampleTargetContract
  }
};
```

## 🔗 Integration Points

### With BMCP SDK

```typescript
import { BitcoinCommandEncoder } from '@bmcp/sdk';
```

### With Bitcoin API

```typescript
import { CommandBuilder } from '@bmcp/bitcoin-api';
```

### With Relayer

```typescript
// Relayer forwards to receiver.receiveMessage()
```

## 📚 Additional Resources

- [Main README](./README.md) - Full documentation
- [BMCP Architecture](../../docs/ARCHITECTURE.md) - Protocol overview
- [Integration Example](../../examples/citrea-schnorr-integration.ts) - Complete example
- [Citrea Docs](https://docs.citrea.xyz) - Citrea documentation
- [BIP340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) - Schnorr signatures

## 🐛 Troubleshooting

### Signature Verification Fails

- Ensure Bitcoin transaction uses Schnorr signatures (Taproot/BIP340)
- Check pubkey extraction (33 bytes compressed → 32 bytes X coordinate)
- Verify message hash calculation matches on-chain

### Authorization Violation

- Check `allowedContract` matches target
- Verify `allowedFunction` selector is correct
- Ensure `validUntil` hasn't expired

### Nonce Mismatch

- Track nonce per Bitcoin pubkey
- Increment after successful execution
- Reset if needed (owner function)

## 🎉 Success Indicators

When everything works:

1. ✅ Bitcoin transaction confirmed
2. ✅ Relayer detects and forwards message
3. ✅ Citrea verifies Schnorr signature
4. ✅ Authorization checks pass
5. ✅ Function executes successfully
6. ✅ Events emitted on Citrea
7. ✅ State updated on target contract

## 🚀 Next Steps

1. Deploy to Citrea Testnet
2. Integrate with BMCP relayer
3. Test with real Bitcoin transactions
4. Monitor and optimize gas usage
5. Add more target contracts
6. Implement advanced features (multi-sig, rate limiting)
7. Deploy to Citrea Mainnet

---

**Ready to use! All contracts compiled and tested ✅**

