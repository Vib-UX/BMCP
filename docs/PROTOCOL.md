# BMCP Protocol Specification v2.0

## Protocol Overview

BMCP (Bitcoin Multichain Protocol) is a cross-chain messaging protocol that enables trustless communication from Bitcoin to EVM chains via Chainlink CCIP, leveraging Bitcoin Core v30.0's 100KB OP_RETURN capacity.

## Message Format

### Binary Structure

```
Offset | Size | Field              | Description
-------|------|--------------------|---------------------------------
0x00   | 2    | Protocol ID        | 0x4243 ("BC")
0x02   | 1    | Version            | 0x02 (v2.0)
0x03   | 8    | Chain Selector     | CCIP destination chain selector
0x0B   | 20   | Receiver           | EVM contract address (20 bytes)
0x1F   | 4    | Data Length        | Length of data field (uint32)
0x23   | N    | Data               | ABI-encoded message payload
N+0x23 | 8    | Gas Limit          | Execution gas limit (uint64)
N+0x2B | 4    | Extra Args Length  | Length of extra args (uint32)
N+0x2F | M    | Extra Args         | CCIP extra arguments
```

### Field Specifications

#### Protocol ID (2 bytes)
- **Value**: `0x4243` ("BC" in ASCII)
- **Purpose**: Identifies BMCP messages for relayer filtering
- **Validation**: Must match exactly

#### Version (1 byte)
- **Value**: `0x02` for v2.0
- **Purpose**: Protocol version for backward compatibility
- **Future**: May support multiple versions

#### Chain Selector (8 bytes, uint64)
- **Values**: CCIP chain selectors
  - Base: `15971525489660198786`
  - Base Sepolia: `10344971235874465080`
  - Ethereum: `5009297550715157269`
  - Arbitrum: `4949039107694359620`
  - Optimism: `3734403246176062136`
- **Purpose**: Routes message to correct destination chain
- **Format**: Big-endian uint64

#### Receiver (20 bytes)
- **Format**: Ethereum address (20 bytes, no 0x prefix)
- **Purpose**: Destination contract on EVM chain
- **Validation**: Must be valid EVM address

#### Data Length (4 bytes, uint32)
- **Range**: 0 to ~99,900 bytes
- **Purpose**: Length of following data field
- **Format**: Big-endian uint32

#### Data (variable)
- **Format**: ABI-encoded function call
- **Max Size**: ~99,900 bytes (depends on overhead)
- **Purpose**: The actual cross-chain message payload
- **Examples**:
  - Simple call: `deposit(address,uint256)` - ~68 bytes
  - Complex call: `batchExecute(address[],bytes[])` - can be 10KB+

#### Gas Limit (8 bytes, uint64)
- **Range**: 21,000 to 10,000,000
- **Purpose**: Gas limit for execution on destination chain
- **Format**: Big-endian uint64
- **Typical Values**:
  - Simple operations: 200,000
  - Complex DeFi: 500,000 - 1,000,000

#### Extra Args (variable)
- **Format**: CCIP EVMExtraArgsV2
- **Structure**:
  ```
  [0:32]  - Gas limit (duplicate, for CCIP)
  [32:33] - Allow out-of-order execution (bool)
  ```
- **Purpose**: Additional CCIP-specific parameters

## Bitcoin Transaction Format

### Transaction Structure

```json
{
  "version": 2,
  "inputs": [
    {
      "txid": "<previous_tx>",
      "vout": 0,
      "scriptSig": "<signature>",
      "sequence": 0xfffffffe
    }
  ],
  "outputs": [
    {
      "value": 0,
      "scriptPubKey": "OP_RETURN <message_bytes>"
    },
    {
      "value": <remaining_balance>,
      "scriptPubKey": "OP_DUP OP_HASH160 <change_address> OP_EQUALVERIFY OP_CHECKSIG"
    }
  ],
  "locktime": 0
}
```

### OP_RETURN Encoding

The message is embedded in an OP_RETURN output using the following script format:

```
OP_RETURN <length_opcode> <message_bytes>
```

Where `<length_opcode>` is:
- Direct push (0x01-0x4b): For data ≤ 75 bytes
- OP_PUSHDATA1 (0x4c): For data ≤ 255 bytes
- OP_PUSHDATA2 (0x4d): For data ≤ 65,535 bytes
- OP_PUSHDATA4 (0x4e): For data > 65,535 bytes (up to 100KB)

## CCIP Integration

### Any2EVMMessage Mapping

Bitcoin messages are transformed into CCIP `Any2EVMMessage` format:

```solidity
struct Any2EVMMessage {
    bytes32 messageId;              // Bitcoin txid
    uint64 sourceChainSelector;     // Bitcoin chain selector
    bytes sender;                   // Encoded Bitcoin address
    bytes data;                     // Message data field
    TokenAmount[] destTokenAmounts; // Always empty for BMCP
}
```

### Bitcoin Address Encoding

Bitcoin addresses are encoded for EVM using keccak256:

```typescript
function encodeBitcoinAddress(btcAddress: string): bytes32 {
  return keccak256(Buffer.from(btcAddress, 'utf8'));
}
```

This creates a unique identifier for each Bitcoin address on EVM chains.

## Message Flow

### 1. Client → Bitcoin

```
User calls sendMessage()
  ↓
Encode BitcoinCCIPMessage
  ↓
Validate size < 100KB
  ↓
Create OP_RETURN script
  ↓
Build Bitcoin transaction
  ↓
Sign transaction
  ↓
Broadcast to network
  ↓
Return txid
```

### 2. Bitcoin → Relayer

```
New block mined
  ↓
Relayer scans block
  ↓
Find OP_RETURN outputs
  ↓
Check protocol ID (0x4243)
  ↓
Decode message
  ↓
Validate structure
  ↓
Wait for confirmations
```

### 3. Relayer → CCIP

```
Construct Any2EVMMessage
  ↓
Get CCIP router contract
  ↓
Call ccipSend()
  ↓
Pay CCIP fees
  ↓
Wait for CCIP validation
```

### 4. CCIP → Destination

```
CCIP Risk Management Network validates
  ↓
Route to destination chain
  ↓
OffRamp receives message
  ↓
Call receiver.ccipReceive()
  ↓
Execute message.data
  ↓
Emit events
```

## Security Model

### Bitcoin Finality

- **1 confirmation**: ~99.9% secure for low-value operations
- **6 confirmations**: Standard for high-value operations
- **10+ confirmations**: Maximum security

### Validation Layers

1. **Bitcoin Network**: Proof-of-work, immutable ordering
2. **CRE Relayer**: Protocol validation, message parsing
3. **CCIP Network**: Risk Management Network, consensus
4. **Destination Contract**: Source chain validation, message processing

### Attack Vectors & Mitigations

#### 1. Fake Messages
- **Attack**: Submit invalid protocol ID or malformed message
- **Mitigation**: Relayer filters by exact protocol ID match

#### 2. Replay Attacks
- **Attack**: Resubmit old Bitcoin transaction
- **Mitigation**: Bitcoin txid serves as unique messageId

#### 3. MEV/Reordering
- **Attack**: Manipulate message order on destination chain
- **Mitigation**: Bitcoin provides canonical ordering; CCIP preserves it

#### 4. Relayer Downtime
- **Attack**: Prevent message relay
- **Mitigation**: Multiple redundant relayers; anyone can run a relayer

#### 5. Message Censorship
- **Attack**: Relayer refuses to relay certain messages
- **Mitigation**: Decentralized relayer network; censorship-resistant Bitcoin

## Message Size Limits

### Theoretical Limits
- **Bitcoin OP_RETURN**: 100,000 bytes (Bitcoin Core v30.0)
- **Message Overhead**: ~35 bytes (fixed fields)
- **Available Payload**: ~99,965 bytes

### Practical Limits
- **Conservative Estimate**: 80,000 bytes (20% safety margin)
- **Recommended Max**: 50,000 bytes for most operations
- **Large Messages**: 50KB-99KB for batch operations

### Size Optimization

For large payloads, consider:
1. **Compression**: gzip data field (can reduce by 50-90%)
2. **Merkle Roots**: Store root on-chain, prove leaves off-chain
3. **Multiple Outputs**: Split across multiple OP_RETURN outputs
4. **Chunking**: Send multiple transactions if needed

## Gas Optimization

### Bitcoin Side
- Use native SegWit (bech32) for lower fees
- Consolidate UTXOs before large operations
- Use RBF (Replace-By-Fee) for fee bumping

### EVM Side
- Optimize receiver contract code
- Use calldata efficiently
- Batch operations when possible
- Set appropriate gas limits (not too high)

## Chain Selector Registry

| Chain | Selector (Decimal) | Selector (Hex) | Testnet Selector |
|-------|-------------------|----------------|------------------|
| Bitcoin | TBD | 0x424954434f494e | TBD |
| Base | 15971525489660198786 | 0xdd8e5c1c8e6e0e12 | 10344971235874465080 |
| Ethereum | 5009297550715157269 | 0x4586c3b60a9a1b95 | 11155111 (Sepolia) |
| Arbitrum | 4949039107694359620 | 0x44b0c700c2e38e44 | 421614 (Sepolia) |
| Optimism | 3734403246176062136 | 0x33d9b8a5f8c1e338 | 11155420 (Sepolia) |

## Version History

### v2.0 (Current)
- 100KB OP_RETURN support
- Full message in Bitcoin transaction
- Simplified relayer (no preimage storage)
- Support for multiple OP_RETURN outputs

### v1.0 (Legacy)
- 80 byte OP_RETURN limit
- Commitment/preimage scheme
- Required external storage (IPFS)

## Future Extensions

### Planned Features
- Compressed message encoding
- Multi-signature relayer consensus
- Slashing for malicious relayers
- Fee market for message priority
- Cross-chain token transfers
- Lightning integration (x402)

### Research Areas
- Zero-knowledge proofs for message validity
- Optimistic message execution
- Sharded relayer architecture
- Direct Bitcoin SPV proofs on EVM

## Reference Implementation

See `src/encoding/MessageEncoder.ts` for the reference TypeScript implementation of message encoding/decoding.

## Compliance

BMCP messages should comply with:
- Bitcoin standardness rules
- CCIP message format
- EVM ABI encoding standards
- Solidity call conventions

## Changelog

- **2024-11-22**: v2.0 specification published
- **2024-11-22**: Initial protocol design

