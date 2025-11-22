# Bitcoin Scanner

## Overview

The Bitcoin Scanner monitors Bitcoin blockchain for BMCP messages in OP_RETURN outputs.

## Usage

### 1. Scan Single Transaction

```typescript
import { createTatumTestnetScanner } from '@bmcp/relayer';

const scanner = createTatumTestnetScanner('YOUR_TATUM_API_KEY');

// Scan specific transaction
const messages = await scanner.scanTransactionForBMCP(
  'c3c7add2097d94a01116de65f14a9fed765ec25594da1c8715e55b53ae760064'
);

console.log(`Found ${messages.filter(m => m.isBMCP).length} BMCP messages`);
```

### 2. Scan Block

```typescript
// Scan by block height
const messages = await scanner.scanBlockForBMCP(42000);

// Or by block hash
const messages = await scanner.scanBlockForBMCP(
  '000000000000000000000...'
);
```

### 3. Scan Block Range

```typescript
// Scan blocks 42000-42010
const messages = await scanner.scanBlockRange(
  42000,
  42010,
  (height, messages) => {
    console.log(`Block ${height}: ${messages.length} BMCP messages`);
  }
);
```

### 4. Monitor New Blocks

```typescript
// Continuously monitor for new blocks
for await (const messages of scanner.monitorNewBlocks()) {
  for (const message of messages) {
    if (message.decoded) {
      console.log('BMCP message detected!');
      console.log('Chain:', message.decoded.chainName);
      console.log('Contract:', message.decoded.contract);
      
      // Forward to EVM chain
      await forwardToEVM(message.decoded);
    }
  }
}
```

## Configuration

### Tatum API (Recommended)

```typescript
const scanner = new BitcoinScanner({
  rpcUrl: 'https://bitcoin-testnet4.gateway.tatum.io/',
  apiKey: 'your-tatum-api-key',
  network: 'testnet4'
});
```

### Your Own Bitcoin Node

```typescript
const scanner = new BitcoinScanner({
  rpcUrl: 'http://localhost:8332',
  apiKey: 'your_rpc_user:your_rpc_password',
  network: 'testnet'
});
```

## Analyzing the Test Transaction

The transaction you provided (`c3c7add2097d94a01116de65f14a9fed765ec25594da1c8715e55b53ae760064`) has an OP_RETURN output, but it's **NOT a valid BMCP message**.

### What's in the Transaction

```
OP_RETURN Data:
e5d5b962000000000000000000000000000000000000...
│
└─ Function selector (onReport), but NO BMCP protocol magic!
```

### Problem

The OP_RETURN data starts with `0xe5d5b962` (a function selector), **NOT** with `0x424D4350` (BMCP protocol magic).

This means:
- ❌ Relayer will ignore it (no BMCP magic)
- ❌ Cannot route to correct chain
- ❌ No replay protection
- ❌ No deadline enforcement

### Solution

Use `BitcoinCommandEncoder` to create proper BMCP messages:

```typescript
import { BitcoinCommandEncoder, BitcoinFunctionEncoder } from '@bmcp/sdk/bitcoin';

// Create proper BMCP message
const bmcpPayload = BitcoinCommandEncoder.encodeBinary(
  'SEPOLIA',
  '0x2BaE8224110482eC6dDF12faf359A35362d43573',
  BitcoinFunctionEncoder.onReport('Hey From Bitcoin'),
  {
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600
  }
);

// Now starts with BMCP magic!
console.log('First 4 bytes:', bmcpPayload.slice(0, 4).toString('hex'));
// Output: 424d4350 ("BMCP") ✅
```

## How It Works

### 1. Transaction Structure

```
Bitcoin Transaction
├─ Inputs (UTXOs)
└─ Outputs
   ├─ OP_RETURN (value: 0)
   │  └─ Script: OP_RETURN <bmcp_payload>
   └─ Change Output (value: remaining)
```

### 2. OP_RETURN Script Format

```
Hex: 6a4c<length><data>
     │ │   │      │
     │ │   │      └─ BMCP payload
     │ │   └─ Data length
     │ └─ OP_PUSHDATA1 (0x4c for data > 75 bytes)
     └─ OP_RETURN opcode (0x6a)
```

### 3. BMCP Payload Format

```
BMCP Payload (Binary):
┌────────────────────────────────────┐
│ 0x424D4350 (4 bytes) - "BMCP"      │  ← Protocol Magic
├────────────────────────────────────┤
│ 0x01 (1 byte) - Version            │
├────────────────────────────────────┤
│ Chain Selector (8 bytes)           │
├────────────────────────────────────┤
│ Contract Address (20 bytes)        │
├────────────────────────────────────┤
│ Data Length (2 bytes)              │
├────────────────────────────────────┤
│ Calldata (variable)                │
├────────────────────────────────────┤
│ Nonce (4 bytes, optional)          │
├────────────────────────────────────┤
│ Deadline (4 bytes, optional)       │
└────────────────────────────────────┘
```

### 4. Detection Algorithm

```typescript
// 1. Get Bitcoin transaction
const tx = await scanner.getTransaction(txid);

// 2. Find OP_RETURN outputs
const opReturns = tx.vout.filter(o => o.scriptPubKey.type === 'nulldata');

// 3. Extract data from each OP_RETURN
for (const output of opReturns) {
  const data = extractDataFromScript(output.scriptPubKey.hex);
  
  // 4. Check for BMCP magic
  if (data.readUInt32BE(0) === 0x424D4350) {
    // ✅ This is a BMCP message!
    const decoded = BitcoinCommandEncoder.decodeBinary(data);
    
    // 5. Route to target chain
    forwardToChain(decoded.chainSelector, decoded);
  }
}
```

## Examples

### Create Proper BMCP Transaction

```bash
# 1. Encode command
node -e "
const { BitcoinCommandEncoder, BitcoinFunctionEncoder } = require('@bmcp/sdk/bitcoin');

const payload = BitcoinCommandEncoder.encodeBinary(
  'SEPOLIA',
  '0x2BaE8224110482eC6dDF12faf359A35362d43573',
  BitcoinFunctionEncoder.onReport('Hey From Bitcoin'),
  { nonce: 0 }
);

console.log('Payload:', payload.toString('hex'));
"

# 2. Post to bitcoin-api
curl -X POST http://localhost:3000/psbt \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "tb1q...",
    "sendBmcpData": "0x424d4350..." 
  }'

# 3. Sign PSBT with wallet

# 4. Broadcast to Bitcoin network

# 5. Relayer automatically detects and forwards to Sepolia
```

### Run Scanner

```bash
# Scan specific transaction
npm run example:scan-tx

# Monitor new blocks
npm run example:monitor-blocks
```

## API Reference

### BitcoinScanner

```typescript
class BitcoinScanner {
  constructor(config: BitcoinRPCConfig);
  
  // Get transaction
  getTransaction(txid: string): Promise<BitcoinTransaction>;
  
  // Get block
  getBlock(blockHash: string): Promise<any>;
  
  // Scan transaction for OP_RETURN
  scanTransactionForOPReturn(tx: BitcoinTransaction): Buffer[];
  
  // Scan transaction for BMCP messages
  scanTransactionForBMCP(txid: string): Promise<DetectedBMCPMessage[]>;
  
  // Scan block for BMCP messages
  scanBlockForBMCP(blockHashOrHeight: string | number): Promise<DetectedBMCPMessage[]>;
  
  // Scan range of blocks
  scanBlockRange(
    startHeight: number,
    endHeight: number,
    onProgress?: (height: number, messages: DetectedBMCPMessage[]) => void
  ): Promise<DetectedBMCPMessage[]>;
  
  // Monitor new blocks
  monitorNewBlocks(
    startHeight?: number,
    pollIntervalMs?: number
  ): AsyncGenerator<DetectedBMCPMessage[]>;
}
```

### DetectedBMCPMessage

```typescript
interface DetectedBMCPMessage {
  txid: string;
  outputIndex: number;
  opReturnData: Buffer;
  isBMCP: boolean;
  decoded?: {
    protocol: string;
    protocolMagic: number;
    version: number;
    chainSelector: bigint;
    chainName: string | null;
    contract: string;
    data: string;
    nonce?: number;
    deadline?: number;
  };
  error?: string;
}
```

## Tatum API

### Get API Key

1. Sign up at [tatum.io](https://tatum.io)
2. Get free API key (includes testnet access)
3. Use with Bitcoin scanner

### Endpoints

- **Testnet4**: `https://bitcoin-testnet4.gateway.tatum.io/`
- **Testnet3**: `https://bitcoin-testnet.gateway.tatum.io/`
- **Mainnet**: `https://bitcoin-mainnet.gateway.tatum.io/`

### Rate Limits

Free tier:
- 5 requests/second
- 500 requests/day

Paid tiers available for production use.

## Production Deployment

### Relayer Architecture

```
┌─────────────────┐
│ Bitcoin Scanner │ ← Monitors Bitcoin blocks
└────────┬────────┘
         │
         │ Detects BMCP messages
         ▼
┌─────────────────┐
│ Message Queue   │ ← Stores pending messages
└────────┬────────┘
         │
         │ Validates & routes
         ▼
┌─────────────────┐
│ EVM Forwarder   │ ← Submits to Sepolia/Base/etc
└─────────────────┘
```

### High Availability

- Run multiple scanner instances
- Use message queue (Redis/RabbitMQ)
- Implement retry logic
- Monitor for missed blocks

### Database Schema

```sql
CREATE TABLE bmcp_messages (
  id SERIAL PRIMARY KEY,
  txid VARCHAR(64),
  block_height INTEGER,
  output_index INTEGER,
  chain_selector BIGINT,
  chain_name VARCHAR(50),
  contract_address VARCHAR(42),
  calldata TEXT,
  nonce INTEGER,
  deadline INTEGER,
  detected_at TIMESTAMP,
  forwarded_at TIMESTAMP,
  status VARCHAR(20)
);
```

---

**Next Steps:**
1. Run `npm run example:scan-tx` to analyze the test transaction
2. Create proper BMCP messages using BitcoinCommandEncoder
3. Test end-to-end flow on testnet
4. Deploy relayer for production

