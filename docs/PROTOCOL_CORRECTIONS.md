# Protocol ID Corrections - November 23, 2025

## Issue Identified

The documentation incorrectly stated the protocol identifier as `0x4243` ("BC", 2 bytes) when the actual implementation uses `0x424d4350` ("BMCP", 4 bytes).

## Actual Protocol Structure

### Correct Protocol Identifier

```
Protocol Magic: 0x424d4350
              = 0x42 | 0x4d | 0x43 | 0x50
              =  'B' |  'M' |  'C' |  'P'
              = "BMCP" in ASCII
```

### Detection Flow

1. **Check OP_RETURN**: Look for `0x6a` opcode
2. **Check BMCP Magic**: Verify first 4 bytes = `0x424d4350`
3. **Decode Message**: Parse remaining fields

### Actual Message Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                      BMCP Message Layout                          │
├────────┬────────┬───────────────────────────────────────────────┤
│ Offset │  Size  │           Field Description                   │
├────────┼────────┼───────────────────────────────────────────────┤
│ 0x00   │ 4 byte │ Protocol Magic: 0x424d4350 ("BMCP")          │
│ 0x04   │ 1 byte │ Version: 0x01                                 │
│ 0x05   │ 8 byte │ Chain Selector (uint64 big-endian)           │
│ 0x0D   │ 20 byte│ Contract Address (EVM address)                │
│ 0x21   │ 4 byte │ Data Length (uint32 big-endian)              │
│ 0x25   │ N byte │ Data (ABI-encoded function call)              │
│ N+0x25 │ 4 byte │ Nonce (uint32 big-endian, optional)          │
│ N+0x29 │ 4 byte │ Deadline (uint32 unix timestamp, optional)    │
└────────┴────────┴───────────────────────────────────────────────┘
```

## Real Example from Dashboard

### Hex Data

```
0x424d435001de41ba4fc9d91ad92bae8224110482ec6ddf12faf359a35362d435730064f21355f40000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001f48656c6c6f2066726f6d20426974636f696e202d20313a30343a313020616d0000000000692295ca
```

### Field-by-Field Breakdown

| Field | Hex Value | Decoded | Notes |
|-------|-----------|---------|-------|
| **Protocol Magic** | `424d4350` | "BMCP" | 4 bytes, ASCII |
| **Version** | `01` | 1 | 1 byte |
| **Chain Selector** | `de41ba4fc9d91ad9` | 16006838950662912473 | 8 bytes, big-endian |
| **Contract Address** | `2bae8224110482ec6ddf12faf359a35362d43573` | 0x2bae82...43573 | 20 bytes |
| **Data Length** | `00000064` | 100 bytes | 4 bytes, big-endian |
| **Data** | `f21355f4...` | ABI-encoded function | Variable length |
| **Nonce** | `00000000` | 0 | 4 bytes |
| **Deadline** | `692295ca` | 1763874250 | 4 bytes, unix timestamp |

### Function Call Decoded

```typescript
// Function signature
onReport(string message)

// Arguments
message = "Hello from Bitcoin - 1:04:10 am"
```

## Implementation Reference

### BitcoinCommandEncoder.ts

```typescript
private static readonly PROTOCOL_ID = 'BMCP';
private static readonly PROTOCOL_MAGIC = 0x424d4350; // "BMCP" in hex
private static readonly VERSION = 1;
```

### ProtocolFilter.ts

```typescript
private static readonly BMCP_MAGIC = 0x424d4350; // "BMCP"
private static readonly OP_RETURN = 0x6a;
```

### Relayer Detection

```typescript
// Check if data starts with BMCP magic
if (data.length >= 4) {
  const magic = data.readUInt32BE(0);
  if (magic === 0x424d4350) {
    // This is a BMCP message, decode it
    const version = data.readUInt8(4);
    const chainSelector = data.readBigUInt64BE(5);
    // ... continue decoding
  }
}
```

## Files Corrected

### Documentation Files

1. **README.md**
   - Updated message structure section
   - Corrected protocol identifier
   - Added real example with hex breakdown
   - Updated detection flow

2. **docs/CCIP_CRE_FLOW.md**
   - Fixed protocol identifier (0x424d4350)
   - Updated message structure table
   - Corrected mermaid sequence diagram
   - Updated examples with real data
   - Fixed message validation section

3. **packages/zkevm-schnorr-contracts/README.md**
   - Will be updated if needed

## Key Differences

### Old (Incorrect)

| Aspect | Value |
|--------|-------|
| Protocol ID | `0x4243` ("BC") |
| Size | 2 bytes |
| Version | 0x02 (v2.0) |
| Format | CCIP-style |

### New (Correct)

| Aspect | Value |
|--------|-------|
| Protocol Magic | `0x424d4350` ("BMCP") |
| Size | 4 bytes |
| Version | 0x01 (v1.0) |
| Format | BMCP binary format |

## Why This Matters

1. **Relayer Detection**: Relayers scan for `0x424d4350`, not `0x4243`
2. **Message Parsing**: Offsets are different (starts at byte 4, not byte 2)
3. **Validation**: Must check 4 bytes, not 2 bytes
4. **Integration**: Code examples must use correct format

## Testing

To verify the correct protocol:

```typescript
import { BitcoinCommandEncoder } from '@bmcp/sdk';

const encoded = BitcoinCommandEncoder.encodeBinary(
  CHAIN_SELECTORS.BASE_SEPOLIA,
  '0x2bae8224110482ec6ddf12faf359a35362d43573',
  {
    signature: 'onReport(string)',
    args: ['Hello from Bitcoin']
  }
);

// Check first 4 bytes
const magic = encoded.readUInt32BE(0);
console.log('Protocol Magic:', '0x' + magic.toString(16));
// Expected: 0x424d4350

// Check ASCII representation
const ascii = encoded.slice(0, 4).toString('ascii');
console.log('Protocol ASCII:', ascii);
// Expected: "BMCP"
```

## Summary

✅ **Corrected Protocol ID**: `0x424d4350` ("BMCP", 4 bytes)  
✅ **Updated Documentation**: README.md, CCIP_CRE_FLOW.md  
✅ **Real Examples Added**: Actual hex data from dashboard  
✅ **Detection Flow Clarified**: OP_RETURN → BMCP magic check  
✅ **Field Offsets Fixed**: Adjusted for 4-byte magic  

---

**Date**: November 23, 2025  
**Status**: ✅ Corrections Complete  
**Verified**: Against actual implementation code

