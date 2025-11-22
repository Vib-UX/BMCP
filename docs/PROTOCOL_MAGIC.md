# BMCP Protocol Magic

## Overview

All BMCP messages in Bitcoin OP_RETURN are prefixed with a **protocol magic number** for easy detection and filtering.

## Protocol Magic Number

```
0x424D4350 = "BMCP" in ASCII
```

Breakdown:
- `0x42` = 'B'
- `0x4D` = 'M'  
- `0x43` = 'C'
- `0x50` = 'P'

## Bitcoin OP_RETURN Structure

```
┌─────────────────────────────────────────────────────────────┐
│ OP_RETURN Output                                             │
├─────────────────────────────────────────────────────────────┤
│ Opcode: 0x6a (OP_RETURN)                                    │
│ Data:                                                        │
│   ├─ Protocol Magic (4 bytes): 0x424D4350 ("BMCP")         │
│   ├─ Version (1 byte): 0x01                                 │
│   ├─ Chain Selector (8 bytes): BigInt                       │
│   ├─ Contract Address (20 bytes): 0x...                     │
│   ├─ Data Length (2 bytes): uint16                          │
│   ├─ Calldata (variable): 0x...                             │
│   ├─ Nonce (4 bytes, optional): uint32                      │
│   └─ Deadline (4 bytes, optional): unix timestamp           │
└─────────────────────────────────────────────────────────────┘
```

## Example: Hex Breakdown

```
Complete OP_RETURN hex:
6a                                                      ← OP_RETURN opcode
4c                                                      ← OP_PUSHDATA1 (length > 75)
85                                                      ← Data length (133 bytes)
424d4350                                                ← BMCP magic
01                                                      ← Version 1
de0b6b3a7640000                                         ← Chain selector (Sepolia)
2bae8224110482ec6ddf12faf359a35362d43573                ← Contract address
0064                                                    ← Data length (100 bytes)
e5d5b96200000000...                                     ← Calldata (onReport function)
0000002a                                                ← Nonce (42)
65abc123                                                ← Deadline (timestamp)
```

## Usage in Code

### Encoding (Bitcoin Side)

```typescript
import { BitcoinCommandEncoder } from '@bmcp/sdk/bitcoin';

// Binary format automatically includes protocol magic
const binaryPayload = BitcoinCommandEncoder.encodeBinary(
  'SEPOLIA',
  '0x2BaE8224110482eC6dDF12faf359A35362d43573',
  {
    signature: 'onReport(string)',
    args: ['Hello from Bitcoin']
  }
);

// First 4 bytes are BMCP magic
console.log(binaryPayload.slice(0, 4).toString('hex')); // 424d4350
console.log(binaryPayload.slice(0, 4).toString('ascii')); // BMCP
```

### Detection (Relayer Side)

```typescript
import { BitcoinCommandEncoder } from '@bmcp/sdk/bitcoin';

// Check if Bitcoin OP_RETURN data is a BMCP message
const isBMCP = BitcoinCommandEncoder.isBMCPMessage(opReturnData);

if (isBMCP) {
  // This is a BMCP message - process it
  const decoded = BitcoinCommandEncoder.decodeBinary(opReturnData);
  console.log('Chain:', decoded.chainSelector);
  console.log('Contract:', decoded.contract);
  // Forward to EVM...
}
```

### bitcoin-api Integration

Your `/psbt` endpoint automatically handles the magic:

```typescript
// POST /psbt
{
  "address": "tb1q...",
  "sendBmcpData": "0x01de0b6b3a7640000..." // Without BMCP prefix
}

// bitcoin-api checks if payload already has magic:
// - If yes: use as-is
// - If no: prepend 0x424D4350

// Result: OP_RETURN always starts with BMCP magic
```

## Relayer Filtering Logic

### Step-by-Step

1. **Scan Bitcoin Block**
   ```
   Block 850,123 contains 1,247 transactions
   ```

2. **Filter for OP_RETURN**
   ```
   Found 15 outputs with OP_RETURN (nulldata type)
   ```

3. **Check Protocol Magic**
   ```typescript
   for (const output of opReturnOutputs) {
     const data = extractDataFromScript(output.scriptPubKey);
     
     // Check first 4 bytes
     if (data.readUInt32BE(0) === 0x424D4350) {
       // ✓ This is a BMCP message!
       bmcpMessages.push(data);
     }
   }
   ```
   ```
   Found 2 BMCP messages
   ```

4. **Decode and Route**
   ```typescript
   for (const msg of bmcpMessages) {
     const decoded = BitcoinCommandEncoder.decodeBinary(msg);
     
     if (decoded.chainSelector === SEPOLIA_SELECTOR) {
       forwardToSepolia(decoded);
     } else if (decoded.chainSelector === BASE_SELECTOR) {
       forwardToBase(decoded);
     }
     // ... etc
   }
   ```

## Why Protocol Magic?

### Benefits

1. **Fast Filtering**
   - Check first 4 bytes
   - No need to parse entire payload
   - Reject non-BMCP data immediately

2. **Version Control**
   - Magic number can evolve (e.g., `BMCP` → `BMC2`)
   - Backward compatibility

3. **Multi-Protocol Support**
   - Other protocols can coexist on Bitcoin
   - Each has unique magic number
   - Relayers can support multiple protocols

4. **Error Detection**
   - Invalid data rejected early
   - Prevents wasting gas on bad messages

### Security

- Magic number is **not security** - just identification
- Relayer must still validate:
  - Chain selector
  - Contract address format
  - Deadline expiry
  - Signature (if required)

## Comparison with Other Protocols

| Protocol | Magic | Bytes | Purpose |
|----------|-------|-------|---------|
| BMCP | 0x424D4350 | 4 | Bitcoin → EVM messaging |
| Bitcoin | 0xD9B4BEF9 | 4 | Bitcoin network magic |
| Ordinals | 0x03 | 1 | Ordinal inscriptions |
| Stamps | 0x5354414D50 | 5 | Bitcoin Stamps |

## Testing

### Test Vectors

```typescript
// Valid BMCP message
const valid = Buffer.from('424d43500100...', 'hex');
assert(BitcoinCommandEncoder.isBMCPMessage(valid) === true);

// Invalid - wrong magic
const invalid1 = Buffer.from('ffffffff00...', 'hex');
assert(BitcoinCommandEncoder.isBMCPMessage(invalid1) === false);

// Invalid - too short
const invalid2 = Buffer.from('424d', 'hex');
assert(BitcoinCommandEncoder.isBMCPMessage(invalid2) === false);

// Invalid - random data
const invalid3 = Buffer.from('random data');
assert(BitcoinCommandEncoder.isBMCPMessage(invalid3) === false);
```

## Implementation Status

✅ **BitcoinCommandEncoder** - Includes magic in binary format  
✅ **bitcoin-api** - Prepends magic if not present  
✅ **ProtocolFilter** - Detects magic in OP_RETURN  
✅ **isBMCPMessage()** - Helper for detection  

## Example: Complete Flow

```
1. User creates command
   └─ BitcoinCommandEncoder.encodeBinary(...)
   
2. Payload includes magic
   └─ [0x424D4350][version][chain][contract][data]...
   
3. Send to bitcoin-api
   └─ POST /psbt with sendBmcpData
   
4. bitcoin-api checks magic
   └─ Already present? Yes → use as-is
   
5. Build transaction
   └─ OP_RETURN [0x424D4350][payload]
   
6. Broadcast to Bitcoin
   └─ ~10 min confirmation
   
7. Relayer scans block
   └─ Check OP_RETURN: starts with 0x424D4350? Yes!
   
8. Decode and forward
   └─ Extract chain selector → forward to Sepolia
   
9. Execute on EVM
   └─ onReport("Hello from Bitcoin") ✓
```

## References

- [BitcoinCommandEncoder](/packages/sdk/bitcoin/BitcoinCommandEncoder.ts)
- [bitcoin-api](/packages/bitcoin-api/src/index.ts)
- [ProtocolFilter](/packages/relayer/src/ProtocolFilter.ts)
- [Protocol Detection Examples](/examples/protocol-detection.ts)

---

**The BMCP magic number makes Bitcoin → EVM messaging efficient and reliable!** 🎯

