# BMCP Architecture

## System Components

BMCP consists of five main components:

```
┌────────────────────────────────────────────────────────────────┐
│                        BMCP Architecture                        │
└────────────────────────────────────────────────────────────────┘

┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│   Client    │───────▶│   Bitcoin    │───────▶│     CRE      │
│   Layer     │        │   Network    │        │   Relayer    │
└─────────────┘        └──────────────┘        └──────────────┘
      │                       │                        │
      │                       │                        │
      ▼                       ▼                        ▼
┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│  User/DApp  │        │  100KB OP_   │        │    Block     │
│             │        │   RETURN     │        │   Scanner    │
└─────────────┘        └──────────────┘        └──────────────┘
                                                       │
                                                       ▼
┌─────────────┐        ┌──────────────┐        ┌──────────────┐
│    CCIP     │◀───────│  Message     │◀───────│   Message    │
│   Network   │        │  Transform   │        │   Decoder    │
└─────────────┘        └──────────────┘        └──────────────┘
      │
      │
      ▼
┌─────────────┐        ┌──────────────┐
│  Base Chain │───────▶│   Receiver   │
│   OffRamp   │        │   Contract   │
└─────────────┘        └──────────────┘
```

## 1. Client Layer

### Bitcoin CCIP Client

**Purpose**: Provides developer-friendly API for sending cross-chain messages from Bitcoin

**Components**:
- Message encoder
- Bitcoin RPC interface
- Transaction builder
- Fee estimator
- Message validator

**Key Methods**:
```typescript
class BitcoinCCIPClient {
  sendMessage(chainSelector, receiver, data, options)
  sendToBase(receiver, data, options)
  sendToBaseSepolia(receiver, data, options)
  getMessageReceipt(txid)
  getBlockHeight()
}
```

**Responsibilities**:
1. Validate input parameters
2. Encode CCIP message structure
3. Create OP_RETURN script
4. Build Bitcoin transaction
5. Sign and broadcast transaction
6. Return transaction receipt

**Error Handling**:
- Invalid receiver address → Reject immediately
- Message too large → Reject before broadcast
- Insufficient funds → RPC error with clear message
- Network error → Retry with exponential backoff

## 2. Bitcoin Network Layer

### Transaction Broadcasting

**Flow**:
1. Client creates signed transaction
2. Transaction broadcast to Bitcoin P2P network
3. Propagates to mining nodes (~5 seconds)
4. Included in next block (~10 minutes average)
5. Confirmed with additional blocks (~60 minutes for 6 confirmations)

### OP_RETURN Storage

**Format**:
```
Output {
  value: 0 satoshis
  scriptPubKey: OP_RETURN <100KB_message>
}
```

**Properties**:
- Provably unspendable (OP_RETURN)
- No UTXO set pollution
- Permanent blockchain storage
- Globally accessible
- Immutable ordering

### Consensus & Finality

- **Probabilistic Finality**: Security increases with each block
- **6 Blocks Standard**: ~99.9999% secure
- **51% Attack Resistant**: Infeasible to reorganize deep blocks
- **Censorship Resistant**: Any miner can include message

## 3. CRE Relayer

### Block Monitor

**Purpose**: Continuously scan Bitcoin blockchain for BMCP messages

**Algorithm**:
```
while (isRunning) {
  currentHeight = getBitcoinBlockHeight()
  confirmedHeight = currentHeight - confirmationBlocks
  
  for (height = lastProcessed + 1; height <= confirmedHeight; height++) {
    block = getBlock(height)
    messages = scanBlock(block)
    
    for (message in messages) {
      relayMessage(message)
    }
    
    lastProcessed = height
  }
  
  sleep(pollInterval)
}
```

**Configuration**:
- `startBlock`: Initial block to scan from
- `confirmationBlocks`: Required confirmations (default: 6)
- `pollInterval`: Time between scans (default: 30s)
- `protocolId`: Filter for 0x4243

### Message Scanner

**Purpose**: Extract BMCP messages from Bitcoin blocks

**Process**:
1. Iterate through all transactions in block
2. For each transaction:
   - Check each output
   - Identify OP_RETURN outputs
   - Parse OP_RETURN data
   - Check protocol ID (0x4243)
   - Decode CCIP message
   - Extract sender address from inputs
3. Return array of parsed messages

**Filtering**:
- Only OP_RETURN outputs
- Only protocol ID 0x4243
- Only valid message structure
- Only properly formatted addresses

### Message Transformer

**Purpose**: Convert Bitcoin messages to CCIP format

**Input**: Parsed Bitcoin message
```typescript
{
  txid: string
  blockHeight: number
  blockHash: string
  message: BitcoinCCIPMessage
  sender: string  // Bitcoin address
  timestamp: number
  confirmations: number
}
```

**Output**: CCIP Any2EVMMessage
```typescript
{
  messageId: bytes32  // Bitcoin txid
  sourceChainSelector: uint64  // Bitcoin selector
  sender: bytes  // Encoded Bitcoin address
  data: bytes  // Message data
  destTokenAmounts: []  // Empty for BMCP
}
```

### CCIP Router Interface

**Purpose**: Submit messages to Chainlink CCIP network

**Contract**: `IRouterClient.sol`
```solidity
interface IRouterClient {
  function ccipSend(
    uint64 destinationChainSelector,
    Client.EVM2AnyMessage calldata message
  ) external payable returns (bytes32);
}
```

**Process**:
1. Construct EVM2AnyMessage
2. Calculate CCIP fees
3. Approve fee payment (LINK or native)
4. Call ccipSend()
5. Wait for transaction confirmation
6. Store message ID mapping

**Fee Handling**:
- Pay in LINK or native gas token
- Calculate using getFee() view function
- Include 10% buffer for price fluctuations
- Subsidize or pass through to users

## 4. CCIP Network

### Architecture

BMCP integrates with Chainlink CCIP as a source chain:

```
Bitcoin → CRE Relayer → CCIP OnRamp → Risk Management Network → OffRamp → Base
```

### Risk Management Network

**Validation Steps**:
1. Message format validation
2. Source chain verification
3. Fee payment verification
4. Rate limiting checks
5. Multi-node consensus

**Security**:
- Decentralized oracle network
- Multiple independent nodes
- Cryptographic signatures
- Anomaly detection
- Circuit breakers

### Message Routing

**Flow**:
1. CRE submits to OnRamp (on Bridge chain)
2. Commitment tree updated
3. OCR (Off-Chain Reporting) consensus
4. Merkle root committed on destination
5. OffRamp executes on destination chain

**Timing**:
- OnRamp to commitment: ~30 seconds
- Cross-chain consensus: 1-3 minutes
- OffRamp execution: ~1 minute
- Total CCIP time: 2-5 minutes

## 5. Destination Layer

### Base Chain OffRamp

**Purpose**: Receive and execute cross-chain messages on Base

**Contract**: Deployed by Chainlink
- Verifies Merkle proofs
- Validates message authenticity
- Rate limiting
- Calls receiver contracts

### Receiver Contracts

**Base Contract**: `BitcoinCCIPReceiver`
```solidity
abstract contract BitcoinCCIPReceiver is CCIPReceiver {
  uint64 public immutable bitcoinChainSelector;
  
  function _ccipReceive(Client.Any2EVMMessage memory message) 
    internal override;
    
  function processMessage(Client.Any2EVMMessage calldata message) 
    external virtual;
}
```

**Validation**:
1. Check sourceChainSelector == bitcoinChainSelector
2. Verify message format
3. Decode Bitcoin address
4. Parse message data
5. Execute function call
6. Emit events

### Example Implementations

**SimpleBitcoinReceiver**:
- Basic message storage
- Event emission
- Simple function execution

**BitcoinDeFiGateway**:
- Balance tracking per Bitcoin address
- Token swap integration
- Batch operation support
- Replay protection
- Complex DeFi workflows

## Data Flow Diagram

```
┌─────────┐
│  User   │ Creates message with:
│         │ - Destination chain
│  DApp   │ - Receiver contract
│         │ - Function calldata
└────┬────┘
     │
     ▼
┌─────────────────┐
│ Bitcoin CCIP    │ 1. Encodes message (35 bytes overhead + data)
│ Client          │ 2. Validates size < 100KB
│                 │ 3. Creates OP_RETURN script
│ - Encode        │ 4. Builds Bitcoin transaction
│ - Validate      │ 5. Signs with wallet
│ - Build TX      │ 6. Broadcasts to network
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Bitcoin Network │ 1. TX propagates P2P (~5s)
│                 │ 2. Miners include in block (~10m)
│ - P2P Layer     │ 3. Block mined and broadcast
│ - Consensus     │ 4. Additional confirmations (~60m)
│ - Storage       │ Message now immutable on Bitcoin!
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ CRE Relayer     │ 1. Detects new block
│                 │ 2. Scans for protocol ID 0x4243
│ - Monitor       │ 3. Extracts OP_RETURN data
│ - Scan          │ 4. Decodes CCIP message
│ - Parse         │ 5. Transforms to Any2EVMMessage
│ - Relay         │ 6. Calls CCIP router
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ CCIP Network    │ 1. Validates message
│                 │ 2. Risk Management Network consensus
│ - OnRamp        │ 3. Commitment tree updated
│ - RMN           │ 4. Cross-chain relay
│ - OffRamp       │ 5. Merkle proof verification
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Base Chain      │ 1. OffRamp receives message
│                 │ 2. Verifies source chain
│ - OffRamp       │ 3. Calls receiver.ccipReceive()
│ - Receiver      │ 4. Decodes function call
│ - Execute       │ 5. Executes on-chain
│                 │ 6. Emits events
└─────────────────┘
     │
     ▼
┌─────────┐
│ Success │ Message executed on Base!
│         │ Total time: ~15-20 minutes
│ Events  │ Bitcoin txid = Message ID
│ emitted │ Fully auditable trail
└─────────┘
```

## Scalability Considerations

### Message Throughput

**Bitcoin Constraint**:
- 1 block per 10 minutes (average)
- ~4,000 transactions per block
- Theoretical max: 4,000 messages per 10 minutes = 6.67 msg/sec

**Optimization**:
- Multiple OP_RETURN outputs per transaction → 20+ messages per TX
- Batch encoding → 100+ small messages in one 100KB payload
- Effective throughput: ~100 msg/sec with batching

### Relayer Scalability

**Horizontal Scaling**:
- Multiple redundant relayers
- Each processes same Bitcoin blocks
- First to relay wins (others skip)
- No coordination required

**Vertical Scaling**:
- Parallel block processing
- Batch message submission
- Optimized RPC calls
- Caching and indexing

### CCIP Scalability

- Handles millions of messages per day
- Multiple source chains supported
- Rate limiting per chain/sender
- Parallel message execution

## Failure Modes & Recovery

### Client Failures

**Transaction Broadcast Failure**:
- Retry with higher fee (RBF)
- Check mempool status
- Wait for confirmation

### Relayer Failures

**Relayer Downtime**:
- Other relayers pick up work
- Messages queued automatically
- No message loss

**Missed Blocks**:
- Relayer resumes from lastProcessed
- Scans missed blocks
- Processes messages in order

### CCIP Failures

**CCIP Network Issue**:
- Automatic retries
- Circuit breaker protection
- Manual intervention if needed

**Destination Chain Congestion**:
- Messages queued in OffRamp
- Executed when gas prices lower
- No message loss

### Smart Contract Failures

**Receiver Reverts**:
- Message marked as failed
- Emits MessageFailed event
- Can be retried manually
- Original Bitcoin TX remains proof

## Monitoring & Observability

### Key Metrics

**Client**:
- Messages sent per hour
- Average message size
- Transaction fees paid
- Success rate

**Relayer**:
- Blocks processed per minute
- Messages detected per block
- Relay success rate
- CCIP fees paid

**Contracts**:
- Messages received per hour
- Execution success rate
- Gas costs per message
- Failed executions

### Logging

**Structured Logs**:
```json
{
  "timestamp": "2024-11-22T12:34:56Z",
  "level": "info",
  "component": "relayer",
  "event": "message_detected",
  "txid": "abc123...",
  "blockHeight": 850123,
  "chainSelector": "15971525489660198786",
  "receiver": "0x1234..."
}
```

### Alerts

- Relayer downtime > 5 minutes
- Failed message relay rate > 5%
- Bitcoin network issues
- CCIP network degradation
- Contract execution failures > 10%

## Security Architecture

See [PROTOCOL.md](PROTOCOL.md) for detailed security analysis.

## Performance Optimization

### Bitcoin Side

- Use SegWit for lower fees
- Batch multiple messages
- Optimize UTXO selection
- Use appropriate fee rates

### Relayer Side

- Cache Bitcoin block data
- Index transactions by protocol ID
- Parallel message processing
- Optimize RPC calls

### Contract Side

- Gas-efficient Solidity
- Minimal storage writes
- Batch operations when possible
- Use events for history

## Future Architecture

### Planned Improvements

1. **Decentralized Relayer Network**
   - Stake-based participation
   - Slashing for malicious behavior
   - Reward distribution
   - Governance

2. **Direct SPV Proofs**
   - Eliminate relayer trust
   - On-chain Bitcoin header verification
   - Merkle proof validation
   - Longer latency but trustless

3. **Lightning Integration**
   - x402 protocol support
   - Instant message triggering
   - CDP facilitator integration
   - Sub-second latency

4. **Multi-Chain Support**
   - Arbitrum, Optimism, Polygon
   - Unified client API
   - Per-chain optimization
   - Cross-chain routing

## Conclusion

BMCP's architecture leverages Bitcoin's security and CCIP's reliability to enable trustless cross-chain messaging. The modular design allows for independent scaling and optimization of each component while maintaining end-to-end security guarantees.

