/**
 * Example: BMCP + Citrea Schnorr Verification Integration
 * Shows complete flow from Bitcoin to Citrea with signature verification
 * 
 * NOTE: This is a conceptual/documentation example.
 * For actual execution, use the Bitcoin API or SDK directly.
 */

// Conceptual imports (for documentation)
// import { BitcoinCommandEncoder, BitcoinFunctionEncoder } from '@bmcp/sdk';

console.log('=== BMCP + Citrea Schnorr Integration Example ===\n');

// ============================================
// Step 1: Define Contract Addresses
// ============================================
console.log('Step 1: Contract Setup');
console.log('─────────────────────────────────────────────');

const CITREA_TESTNET = {
  chainSelector: '5115',
  rpcUrl: 'https://rpc.testnet.citrea.xyz',
  contracts: {
    bmcpReceiver: '0x...',       // Deploy BMCPMessageReceiver
    exampleTarget: '0x...',      // Deploy ExampleTargetContract
  },
};

console.log('Citrea Testnet Chain ID:', CITREA_TESTNET.chainSelector);
console.log('BMCP Receiver:', CITREA_TESTNET.contracts.bmcpReceiver);
console.log('Target Contract:', CITREA_TESTNET.contracts.exampleTarget);
console.log();

// ============================================
// Step 2: Create Message with Authorization
// ============================================
console.log('Step 2: Create Bitcoin Message');
console.log('─────────────────────────────────────────────');

// Example: Store a message on Citrea from Bitcoin
const message = 'Hello from Bitcoin with Schnorr verification!';

// Using BitcoinFunctionEncoder.custom() conceptually:
// const functionCall = BitcoinFunctionEncoder.custom('storeMessage(string)', [message]);

const functionSelector = '0x32af2edb';  // storeMessage(string) selector

console.log('Function: storeMessage(string)');
console.log('Function Selector:', functionSelector);
console.log('Message:', message);
console.log();

// ============================================
// Step 3: Add Authorization Constraints
// ============================================
console.log('Step 3: Define Authorization');
console.log('─────────────────────────────────────────────');

const authorization = {
  allowedContract: CITREA_TESTNET.contracts.exampleTarget,
  allowedFunction: functionSelector,
  maxValue: '0',  // No ETH transfer
  validUntil: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
};

console.log('Authorized Contract:', authorization.allowedContract);
console.log('Authorized Function:', authorization.allowedFunction);
console.log('Max Value:', authorization.maxValue, 'wei');
console.log('Valid Until:', new Date(authorization.validUntil * 1000).toISOString());
console.log();

// ============================================
// Step 4: Encode Complete BMCP Payload
// ============================================
console.log('Step 4: Encode BMCP Payload');
console.log('─────────────────────────────────────────────');

// NOTE: Authorization field requires extending BitcoinCommandEncoder
// For now, showing the conceptual structure:
const bmcpPayloadStructure = {
  protocol: '0x4243',
  chainSelector: CITREA_TESTNET.chainSelector,
  contract: CITREA_TESTNET.contracts.exampleTarget,
  data: '0x32af2edb...',  // encoded storeMessage call
  nonce: 0,
  deadline: Math.floor(Date.now() / 1000) + 3600,
  // NEW: Authorization constraints
  authorization: authorization,
};

console.log('BMCP Payload Structure:');
console.log(JSON.stringify(bmcpPayloadStructure, null, 2));
console.log();

// Using current SDK (without authorization) - conceptual:
// const bmcpPayload = BitcoinCommandEncoder.encodeJSON(
//   'CITREA_TESTNET',
//   CITREA_TESTNET.contracts.exampleTarget,
//   functionCall,
//   { nonce: 0, deadline: Math.floor(Date.now() / 1000) + 3600 }
// );

const currentPayloadExample = {
  protocol: '0x4243',
  chainSelector: CITREA_TESTNET.chainSelector,
  contract: CITREA_TESTNET.contracts.exampleTarget,
  data: '0x32af2edb...',  // encoded storeMessage call
  nonce: 0,
  deadline: Math.floor(Date.now() / 1000) + 3600,
};

console.log('Current BMCP Payload (without authorization):');
console.log(JSON.stringify(currentPayloadExample, null, 2));
console.log();

// ============================================
// Step 5: Bitcoin Transaction Structure
// ============================================
console.log('Step 5: Bitcoin Transaction Structure');
console.log('─────────────────────────────────────────────');

console.log(`
Bitcoin Transaction:
{
  inputs: [
    {
      // Your Bitcoin UTXO
      prevTxid: "abc123...",
      prevVout: 0,
      // ✨ Schnorr signature here (extracted by relayer)
      witness: [
        signature,  // 64 bytes Schnorr signature
        pubkey      // 33 bytes compressed public key
      ]
    }
  ],
  outputs: [
    {
      value: 0,
      scriptPubKey: "OP_RETURN <bmcpPayload>"  // ← Your message
    },
    {
      value: remaining,
      scriptPubKey: "your_change_address"
    }
  ]
}
`);

console.log('Key Points:');
console.log('1. Signature is in transaction input (witness/scriptSig)');
console.log('2. Message payload is in OP_RETURN output');
console.log('3. Signature signs the entire transaction (including OP_RETURN)');
console.log();

// ============================================
// Step 6: Relayer Processing
// ============================================
console.log('Step 6: Relayer Extracts and Forwards');
console.log('─────────────────────────────────────────────');

console.log(`
Relayer Logic:

1. Monitor Bitcoin for new blocks
2. Scan for OP_RETURN with protocol 0x4243
3. Extract message from OP_RETURN
4. Extract signature from tx.inputs[0].witness[0]
5. Extract pubkey from tx.inputs[0].witness[1]
6. Forward to Citrea:

const tx = await bitcoin.getTransaction(txid);
const opReturn = extractOpReturn(tx.outputs[0]);
const signature = tx.inputs[0].witness[0];  // 64 bytes
const pubkey = tx.inputs[0].witness[1];     // 33 bytes

// Convert compressed pubkey to X coordinate (32 bytes)
const pubkeyX = pubkey.slice(1, 33);

await citreaReceiver.receiveMessage(
  txid,
  decodedMessage,
  {
    pubKeyX: pubkeyX,
    signature: signature
  }
);
`);

console.log();

// ============================================
// Step 7: Citrea Verification Flow
// ============================================
console.log('Step 7: Citrea Contract Verification');
console.log('─────────────────────────────────────────────');

console.log(`
BMCPMessageReceiver.sol:

function receiveMessage(
    bytes32 txid,
    BMCPMessage calldata message,
    SchnorrProof calldata proof
) external onlyRelayer returns (bool) {
    
    // ✅ Step 1: Check not processed
    require(!processedMessages[txid], "Already processed");
    
    // ✅ Step 2: Check deadline
    require(block.timestamp <= message.deadline, "Expired");
    
    // ✅ Step 3: Verify Schnorr signature
    bytes32 msgHash = keccak256(abi.encode(message));
    bool valid = verifySchnorr(proof.pubKeyX, msgHash, proof.signature);
    require(valid, "Invalid signature");
    
    // ✅ Step 4: Check authorization
    require(
        message.targetContract == message.authorization.allowedContract,
        "Unauthorized contract"
    );
    require(
        bytes4(message.data) == message.authorization.allowedFunction,
        "Unauthorized function"
    );
    
    // ✅ Step 5: Check nonce
    require(message.nonce == bitcoinNonces[proof.pubKeyX], "Invalid nonce");
    bitcoinNonces[proof.pubKeyX]++;
    
    // ✅ Step 6: Mark as processed
    processedMessages[txid] = true;
    
    // ✅ Step 7: Execute function call
    (bool success, ) = message.targetContract.call(message.data);
    require(success, "Execution failed");
    
    return true;
}

function verifySchnorr(
    bytes32 pubKeyX,
    bytes32 msgHash,
    bytes calldata signature
) internal view returns (bool) {
    // Call Citrea Schnorr precompile at 0x0200
    bytes memory input = abi.encodePacked(pubKeyX, msgHash, signature);
    (bool ok, bytes memory output) = SCHNORR_VERIFY_PRECOMPILE.staticcall(input);
    return ok && output[31] == 0x01;
}
`);

console.log();

// ============================================
// Step 8: Complete Flow Summary
// ============================================
console.log('Step 8: Complete Flow Summary');
console.log('─────────────────────────────────────────────');

console.log(`
🔄 End-to-End Flow:

┌─────────────────┐
│ 1. User Creates │  User signs message with Bitcoin key
│   Bitcoin TX    │  Message in OP_RETURN, signature in input
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Bitcoin      │  Transaction confirmed on Bitcoin
│   Confirmation  │  ~10-60 minutes (1-6 confirmations)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Relayer      │  Extracts message + signature
│   Detection     │  Forwards to Citrea with proof
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Citrea       │  Schnorr precompile verifies signature
│   Verification  │  Checks: signature, auth, nonce, deadline
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Function     │  Target contract function executed
│   Execution     │  Message stored, tokens transferred, etc.
└─────────────────┘
`);

console.log();

// ============================================
// Example 2: Token Transfer with Authorization
// ============================================
console.log('\nExample 2: Authorized Token Transfer');
console.log('─────────────────────────────────────────────');

// Transfer call - conceptual:
// const transferCall = BitcoinFunctionEncoder.custom(
//   'transfer(address,uint256)',
//   ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', '1000000']
// );

const transferCall = '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb00000000000000000000000000000000000000000000000000000000000f4240';

// Transfer with authorization (conceptual structure)
const transferPayloadStructure = {
  protocol: '0x4243',
  chainSelector: CITREA_TESTNET.chainSelector,
  contract: CITREA_TESTNET.contracts.exampleTarget,
  data: transferCall,
  nonce: 1,
  deadline: Math.floor(Date.now() / 1000) + 3600,
  authorization: {
    allowedContract: CITREA_TESTNET.contracts.exampleTarget,
    allowedFunction: '0xa9059cbb',  // transfer selector
    maxValue: '0',
    validUntil: Math.floor(Date.now() / 1000) + 86400,
  },
};

console.log('Transfer Payload Structure (with authorization):');
console.log(JSON.stringify(transferPayloadStructure, null, 2));
console.log();

// ============================================
// Example 3: Batch Operations
// ============================================
console.log('\nExample 3: Batch Operations');
console.log('─────────────────────────────────────────────');

// Batch call - conceptual:
// const batchCall = BitcoinFunctionEncoder.custom(
//   'batchExecute(address[],bytes[])',
//   [
//     [target1, target2],
//     [calldata1, calldata2]
//   ]
// );

console.log('Batch execution allows multiple calls in one Bitcoin transaction');
console.log('All calls execute atomically on Citrea');
console.log();

console.log('=== Integration Example Complete ===');
console.log();
console.log('🔗 Next Steps:');
console.log('1. Deploy BMCPMessageReceiver and ExampleTargetContract on Citrea Testnet');
console.log('2. Configure relayer to forward to BMCPMessageReceiver');
console.log('3. Send test Bitcoin transaction with OP_RETURN');
console.log('4. Monitor Citrea for signature verification and execution');
console.log();

