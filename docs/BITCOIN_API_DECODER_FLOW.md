# Bitcoin API Decoder Flow

Complete guide showing how BMCP messages are decoded from Bitcoin transaction IDs to EVM execution.

## 🔄 The Complete Flow

### Starting Point: You Only Have a Transaction ID

When scanning Bitcoin blocks, you only see transaction IDs (txids). Here's the complete flow to decode BMCP messages:

```
Bitcoin Block
  │
  ├─► Transaction ID 1: c3c7add2...
  ├─► Transaction ID 2: 9a42f138...
  ├─► Transaction ID 3: b7e9d4c2...
  └─► ...
```

## Step-by-Step Decoding Process

### **STEP 1: Fetch Transaction Data** 📡

**Input:** Transaction ID (64-char hex string)

**Bitcoin RPC Call:**
```bash
curl -X POST 'https://bitcoin-testnet4.gateway.tatum.io/' \
  --header 'x-api-key: YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --data '{
    "jsonrpc": "2.0",
    "method": "getrawtransaction",
    "params": ["c3c7add2097d94a01116de65f14a9fed765ec25594da1c8715e55b53ae760064", true],
    "id": 1
  }'
```

**Response:**
```json
{
  "result": {
    "txid": "c3c7add2...",
    "size": 600,
    "vsize": 358,
    "vin": [...],
    "vout": [
      {
        "value": 0,
        "n": 0,
        "scriptPubKey": {
          "asm": "OP_RETURN 424d435001de41ba...",
          "hex": "6a4c8f424d435001de41ba...",
          "type": "nulldata"
        }
      },
      {
        "value": 0.00198732,
        "n": 1,
        "scriptPubKey": {
          "asm": "0 abc123...",
          "hex": "0014abc123...",
          "type": "witness_v0_keyhash",
          "address": "tb1q..."
        }
      }
    ]
  }
}
```

**What you get:**
- Complete transaction structure
- All inputs and outputs
- Script data for each output

---

### **STEP 2: Extract OP_RETURN Data** 🔍

**Filter outputs by type:**
```typescript
const opReturnOutputs = tx.vout.filter(
  output => output.scriptPubKey.type === 'nulldata'
);
```

**Parse the script:**

Bitcoin script format:
```
6a 4c 8f 424d435001de41ba4fc9d91ad9...
│  │  │  └─ Payload data
│  │  └─ Length (143 bytes = 0x8f)
│  └─ OP_PUSHDATA1 (0x4c = push next byte as length)
└─ OP_RETURN (0x6a)
```

**Script parsing logic:**
```typescript
const scriptHex = output.scriptPubKey.hex;
const script = Buffer.from(scriptHex, 'hex');

let offset = 1; // Skip OP_RETURN (0x6a)
const pushOpcode = script[offset++];

if (pushOpcode === 0x4c) {
  // OP_PUSHDATA1: next byte is length
  const length = script[offset++];
  // data starts at offset
} else if (pushOpcode === 0x4d) {
  // OP_PUSHDATA2: next 2 bytes are length (little-endian)
  const length = script.readUInt16LE(offset);
  offset += 2;
} else if (pushOpcode === 0x4e) {
  // OP_PUSHDATA4: next 4 bytes are length (little-endian)
  const length = script.readUInt32LE(offset);
  offset += 4;
} else if (pushOpcode >= 1 && pushOpcode <= 75) {
  // Direct push: opcode value IS the length
  // data starts at offset
} else {
  throw new Error('Invalid push opcode');
}

const data = script.slice(offset);
```

**Output:**
```
OP_RETURN Data (Buffer):
424d435001de41ba4fc9d91ad92bae8224110482ec6ddf12faf359a35362d43573...
```

---

### **STEP 3: Protocol Detection** 🔐

**Check if it's a BMCP message:**
```typescript
const isBMCP = BitcoinCommandEncoder.isBMCPMessage(data);
```

**What it checks:**
```typescript
// Check first 4 bytes
data[0] === 0x42  // 'B'
data[1] === 0x4D  // 'M'
data[2] === 0x43  // 'C'
data[3] === 0x50  // 'P'
```

**Result:**
- ✅ `0x424D4350` → BMCP message, continue processing
- ❌ Other value → Not BMCP, skip

---

### **STEP 4: Binary Decoding** 📦

**Decode the BMCP binary format:**
```typescript
const decoded = BitcoinCommandEncoder.decodeBinary(data);
```

**Binary Structure:**

| Offset | Size | Field | Example | Description |
|--------|------|-------|---------|-------------|
| 0-3 | 4 bytes | Protocol Magic | `0x424D4350` | "BMCP" identifier |
| 4 | 1 byte | Version | `0x01` | Protocol version |
| 5-12 | 8 bytes | Chain Selector | `0xde41ba4fc9d91ad9` | Target EVM chain |
| 13-32 | 20 bytes | Contract Address | `0x2bae8224...` | Target contract |
| 33-34 | 2 bytes | Data Length | `0x0064` | 100 bytes |
| 35-N | Variable | Calldata | `0xf21355f4...` | Function call |
| N+1-N+4 | 4 bytes | Nonce | `0x00000000` | Replay protection |
| N+5-N+8 | 4 bytes | Deadline | `0x69224ca6` | Unix timestamp |

**Decoded Result:**
```typescript
{
  protocol: 'BMCP',
  protocolMagic: 0x424d4350,
  version: 1,
  chainSelector: 16015286601757825753n,  // Sepolia
  contract: '0x2bae8224110482ec6ddf12faf359a35362d43573',
  data: '0xf21355f4000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000104865792046726f6d20426974636f696e00000000000000000000000000000000',
  nonce: 0,
  deadline: 1763855526
}
```

---

### **STEP 5: Function Call Decoding** 📞

**Extract function selector:**
```typescript
const selector = decoded.data.slice(0, 10);  // First 4 bytes
// Result: '0xf21355f4'
```

**Look up function signature:**
```typescript
const knownFunctions = {
  '0xf21355f4': 'onReport(string)',
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  // ... more functions
};

const signature = knownFunctions[selector];
// Result: 'onReport(string)'
```

**Decode parameters:**
```typescript
const iface = new ethers.Interface([
  'function onReport(string message)'
]);

const params = iface.decodeFunctionData('onReport', decoded.data);
// Result: ['Hey From Bitcoin']
```

**Output:**
```
Function: onReport(string)
Parameters:
  [0]: "Hey From Bitcoin"
```

---

### **STEP 6: Validation** 🔐

**Security checks:**
```typescript
const command = EVMCommandEncoder.buildCommand(
  decoded.contract,
  decoded.data,
  {
    nonce: BigInt(decoded.nonce),
    deadline: BigInt(decoded.deadline),
    chainKey: 'SEPOLIA'
  }
);

const validation = EVMCommandEncoder.validateCommand(command);
```

**Checks performed:**
1. ✅ **Contract address valid:** Must be valid Ethereum address
2. ✅ **Calldata present:** Must have function call data
3. ✅ **Deadline not expired:** `deadline > now`
4. ✅ **Nonce not used:** Check database for replay protection

**Result:**
```typescript
{
  valid: true,
  errors: []
}
```

---

### **STEP 7: Execute on EVM** 🚀

**Ready for execution:**
```typescript
// On Sepolia network
const contract = new ethers.Contract(
  decoded.contract,
  ['function onReport(string message)'],
  wallet
);

const tx = await wallet.sendTransaction({
  to: decoded.contract,
  data: decoded.data,
  value: 0
});

await tx.wait();
```

**Transaction submitted to Sepolia:**
- Contract: `0x2bae8224110482ec6ddf12faf359a35362d43573`
- Function: `onReport("Hey From Bitcoin")`
- Origin: Bitcoin transaction

---

## 🔁 Complete API Call Sequence

### For Relayer Implementation:

```typescript
// 1. Monitor new Bitcoin blocks
const latestBlock = await bitcoinRPC('getblockcount', []);

// 2. Get block data
const blockHash = await bitcoinRPC('getblockhash', [latestBlock]);
const block = await bitcoinRPC('getblock', [blockHash, 2]);

// 3. Process each transaction
for (const tx of block.tx) {
  // 4. Find OP_RETURN outputs
  for (const output of tx.vout) {
    if (output.scriptPubKey.type === 'nulldata') {
      // 5. Extract data
      const data = extractOPReturnData(output.scriptPubKey.hex);
      
      // 6. Check BMCP magic
      if (BitcoinCommandEncoder.isBMCPMessage(data)) {
        // 7. Decode message
        const decoded = BitcoinCommandEncoder.decodeBinary(data);
        
        // 8. Validate
        const isValid = validateCommand(decoded);
        
        if (isValid) {
          // 9. Execute on target chain
          await executeOnEVM(decoded);
          
          // 10. Mark as processed
          await db.markProcessed(tx.txid, decoded.nonce);
        }
      }
    }
  }
}
```

---

## 📊 Example Transaction Flow

### Input
```
Transaction ID: c3c7add2097d94a01116de65f14a9fed765ec25594da1c8715e55b53ae760064
```

### Bitcoin RPC Call
```json
{
  "method": "getrawtransaction",
  "params": ["c3c7add2...", true]
}
```

### Extract OP_RETURN
```
Output 0: nulldata
Script: 6a4c8f424d435001de41ba4fc9d91ad9...
Data: 424d435001de41ba4fc9d91ad9...
```

### Check Magic
```
First 4 bytes: 0x424D4350 ✅ BMCP
```

### Decode Binary
```
Protocol: BMCP
Chain: Sepolia (0xde41ba4fc9d91ad9)
Contract: 0x2bae8224110482ec6ddf12faf359a35362d43573
Function: onReport(string)
Message: "Hey From Bitcoin"
Nonce: 0
Deadline: 1763855526 (valid ✅)
```

### Execute on Sepolia
```
✅ Transaction submitted
TX Hash: 0xabc123...
Status: Confirmed
```

---

## 🛠️ Key APIs Used

### Bitcoin RPC Methods

| Method | Parameters | Returns | Use Case |
|--------|-----------|---------|----------|
| `getblockcount` | `[]` | `number` | Get latest block height |
| `getblockhash` | `[height]` | `string` | Get block hash by height |
| `getblock` | `[hash, verbosity]` | `object` | Get full block data (verbosity=2) |
| `getrawtransaction` | `[txid, verbose]` | `object` | Get transaction data (verbose=true) |
| `getmempoolentry` | `[txid]` | `object` | Check if tx is in mempool |

### BMCP SDK Methods

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `BitcoinCommandEncoder.isBMCPMessage()` | `Buffer` | `boolean` | Check protocol magic |
| `BitcoinCommandEncoder.decodeBinary()` | `Buffer` | `object` | Decode BMCP fields |
| `EVMCommandEncoder.decodeFunction()` | `string, string, string` | `Result` | Decode function params |
| `EVMCommandEncoder.validateCommand()` | `object` | `object` | Validate command |
| `EVMCommandEncoder.buildCommand()` | `string, string, options` | `object` | Build EVM command |

---

## 🎯 Try It Yourself

```bash
# Run the decoder flow example
npm run example:decoder-flow

# With custom transaction ID
npx tsx bitcoin-api-decoder-flow.ts YOUR_TXID
```

---

## 🔗 Related Documentation

- [Bitcoin Scanner](./BITCOIN_SCANNER.md) - How to scan Bitcoin for messages
- [Protocol Magic](./PROTOCOL_MAGIC.md) - BMCP protocol identifier
- [EVM Command Encoder](../packages/sdk/evm/README.md) - EVM-side encoding/decoding

---

## 💡 Key Takeaways

1. **Start with just a TXID** → No need for full transaction data upfront
2. **Bitcoin RPC call** → Fetch complete transaction structure
3. **Find OP_RETURN** → Filter outputs by type `nulldata`
4. **Parse script** → Handle different push opcodes (0x4c, 0x4d, 0x4e)
5. **Check magic** → Quick filter for BMCP messages (0x424D4350)
6. **Decode binary** → Extract all BMCP fields
7. **Decode function** → Get function name and parameters
8. **Validate** → Security checks before execution
9. **Execute** → Submit to target EVM chain

The entire flow is **trustless** and **verifiable** - anyone can fetch the Bitcoin transaction and verify the BMCP message! 🎉

