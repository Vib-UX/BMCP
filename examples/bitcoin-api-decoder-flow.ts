/**
 * Complete BMCP Decoder Flow - From Bitcoin Transaction ID to EVM Execution
 * Shows how to decode BMCP messages using Bitcoin API calls
 */

import { BitcoinCommandEncoder } from '../packages/sdk/bitcoin';
import { EVMCommandEncoder } from '../packages/sdk/evm';

// Only load environment variables and validate when running directly (not when imported)
let TATUM_API_KEY: string | undefined;
let TATUM_RPC_URL: string;

// Check if we're in a Node.js environment and can safely use dotenv/process
const isNodeEnv = typeof process !== 'undefined' && typeof process.exit === 'function';
const isDirectExecution = isNodeEnv && process.argv && process.argv.length > 0;

if (isDirectExecution) {
  try {
    // Try to load dotenv, but don't fail if it's not available (e.g., in WASM)
    const dotenv = require('dotenv');
    if (dotenv && dotenv.config) {
      dotenv.config();
    }
    TATUM_API_KEY = process.env.TATUM_API_KEY;
    TATUM_RPC_URL = process.env.TATUM_RPC_URL || 'https://bitcoin-testnet4.gateway.tatum.io/';

    if (!TATUM_API_KEY) {
      console.error('❌ Error: TATUM_API_KEY not found in environment variables');
      console.error('Please create a .env file with your Tatum API key');
      console.error('See .env.example for reference');
      process.exit(1);
    }
  } catch (e) {
    // If dotenv/config fails (e.g., in WASM), just set defaults
    TATUM_API_KEY = undefined;
    TATUM_RPC_URL = 'https://bitcoin-testnet4.gateway.tatum.io/';
  }
} else {
  // When imported (e.g., in WASM), set defaults (won't be used by exported functions)
  TATUM_API_KEY = undefined;
  TATUM_RPC_URL = 'https://bitcoin-testnet4.gateway.tatum.io/';
}

// Bitcoin RPC Types
export interface BitcoinTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: any[];
  vout: BitcoinOutput[];
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

interface BitcoinOutput {
  value: number;
  n: number;
  scriptPubKey: {
    asm: string;
    desc?: string;
    hex: string;
    type: string;
    address?: string;
  };
}

/**
 * Call Bitcoin RPC method
 */
async function bitcoinRPC(method: string, params: any[]): Promise<any> {
  // Lazy import axios only when this function is called
  const axios = (await import('axios')).default;
  
  const response = await axios.post(
    TATUM_RPC_URL,
    {
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    },
    {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': TATUM_API_KEY,
      },
    }
  );

  if (response.data.error) {
    throw new Error(`RPC Error: ${response.data.error.message}`);
  }

  return response.data.result;
}

/**
 * STEP 1: Fetch transaction by ID
 */
async function getTransaction(txid: string): Promise<BitcoinTransaction> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Bitcoin API Call - getrawtransaction');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📡 API Request:');
  console.log(`   POST ${TATUM_RPC_URL}`);
  console.log('   Method: getrawtransaction');
  console.log('   Params: [' + txid + ', true]');
  console.log();

  const tx = await bitcoinRPC('getrawtransaction', [txid, true]);

  console.log('✅ Response received:');
  console.log('   TX ID:', tx.txid);
  console.log('   Size:', tx.size, 'bytes');
  console.log('   Inputs:', tx.vin.length);
  console.log('   Outputs:', tx.vout.length);
  if (tx.confirmations) {
    console.log('   Confirmations:', tx.confirmations);
  } else {
    console.log('   Status: Unconfirmed (in mempool)');
  }
  console.log();

  return tx;
}

/**
 * STEP 2: Extract OP_RETURN data from transaction outputs
 */
function extractOPReturns(
  tx: BitcoinTransaction
): { index: number; data: Buffer }[] {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Parse Transaction Outputs - Find OP_RETURN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const opReturns: { index: number; data: Buffer }[] = [];

  console.log('🔍 Scanning outputs...\n');

  for (let i = 0; i < tx.vout.length; i++) {
    const output = tx.vout[i];

    console.log(`   Output ${i}:`);
    console.log('     Type:', output.scriptPubKey.type);
    console.log('     Value:', output.value, 'BTC');

    if (output.scriptPubKey.type === 'nulldata') {
      console.log('     ✅ OP_RETURN found!');

      // Parse OP_RETURN data from scriptPubKey
      const scriptHex = output.scriptPubKey.hex;
      const script = Buffer.from(scriptHex, 'hex');

      console.log('     Script Hex:', scriptHex);
      console.log('     Script Breakdown:');
      console.log(
        '       Byte 0: 0x' + script[0].toString(16),
        '(OP_RETURN opcode)'
      );

      // Handle different push opcodes
      let offset = 1; // Skip OP_RETURN opcode
      const pushOpcode = script[offset];

      console.log(
        '       Byte 1: 0x' + pushOpcode.toString(16),
        '(push opcode)'
      );

      if (pushOpcode === 0x4c) {
        // OP_PUSHDATA1
        const length = script[offset + 1];
        console.log(
          '       Byte 2: 0x' + length.toString(16),
          `(data length: ${length} bytes)`
        );
        offset = 3;
      } else if (pushOpcode === 0x4d) {
        // OP_PUSHDATA2
        const length = script.readUInt16LE(offset + 1);
        console.log('       Bytes 2-3:', length, 'bytes (OP_PUSHDATA2)');
        offset = 4;
      } else if (pushOpcode === 0x4e) {
        // OP_PUSHDATA4
        const length = script.readUInt32LE(offset + 1);
        console.log('       Bytes 2-5:', length, 'bytes (OP_PUSHDATA4)');
        offset = 6;
      } else {
        // Direct push (1-75 bytes)
        console.log('       → Pushing', pushOpcode, 'bytes directly');
        offset = 2;
      }

      const data = script.slice(offset);
      console.log('       Data:', data.toString('hex').slice(0, 64) + '...');
      console.log('       Data Size:', data.length, 'bytes');

      opReturns.push({ index: i, data });
    } else {
      console.log('     → Regular output (skipping)');
    }
    console.log();
  }

  console.log(`📦 Found ${opReturns.length} OP_RETURN output(s)\n`);

  return opReturns;
}

/**
 * STEP 3: Check if OP_RETURN contains BMCP message
 */
function checkBMCPMagic(opReturnData: Buffer): boolean {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Protocol Detection - Check BMCP Magic');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const isBMCP = BitcoinCommandEncoder.isBMCPMessage(opReturnData);

  console.log('🔍 Checking first 4 bytes...');
  console.log('   Expected: 0x424D4350 ("BMCP")');

  if (opReturnData.length >= 4) {
    const magic = opReturnData.slice(0, 4);
    console.log('   Actual:   0x' + magic.toString('hex').toUpperCase());
    console.log('   ASCII:    "' + magic.toString('ascii') + '"');
  } else {
    console.log('   Actual:   (data too short)');
  }

  console.log();
  console.log(
    '   Result:',
    isBMCP ? '✅ BMCP Message Detected!' : '❌ Not a BMCP message'
  );
  console.log();

  return isBMCP;
}

/**
 * STEP 4: Decode BMCP binary format
 */
function decodeBMCPMessage(opReturnData: Buffer) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: Binary Decoding - Extract BMCP Fields');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const decoded = BitcoinCommandEncoder.decodeBinary(opReturnData);

  console.log('📋 Decoded BMCP Message:');
  console.log('   ┌─────────────────────────────────────────────────────┐');
  console.log('   │ Field             │ Value                           │');
  console.log('   ├─────────────────────────────────────────────────────┤');
  console.log(
    `   │ Protocol Magic    │ 0x${decoded.protocolMagic.toString(16).toUpperCase().padStart(8, '0')} ("${decoded.protocol}")    │`
  );
  console.log(
    `   │ Version           │ ${decoded.version}                               │`
  );
  console.log(
    `   │ Chain Selector    │ 0x${decoded.chainSelector.toString(16).padStart(16, '0')} │`
  );
  console.log(`   │ Contract          │ ${decoded.contract} │`);
  console.log(
    `   │ Nonce             │ ${decoded.nonce || 0}                               │`
  );
  console.log(
    `   │ Deadline          │ ${decoded.deadline || 'N/A'} ${decoded.deadline && decoded.deadline > Math.floor(Date.now() / 1000) ? '✅' : '❌'}                   │`
  );
  console.log(
    `   │ Calldata Length   │ ${decoded.data.length} bytes                       │`
  );
  console.log('   └─────────────────────────────────────────────────────┘');
  console.log();

  return decoded;
}

/**
 * STEP 5: Decode function call from calldata
 */
export function decodeFunctionCall(calldata: string) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: Function Call Decoding - Extract Parameters');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const selector = calldata.slice(0, 10);

  // Known function selectors
  const knownFunctions: Record<string, { sig: string; abi: string }> = {
    '0xf21355f4': {
      sig: 'onReport(string)',
      abi: 'function onReport(string message)',
    },
    '0xa9059cbb': {
      sig: 'transfer(address,uint256)',
      abi: 'function transfer(address to, uint256 amount)',
    },
    '0x095ea7b3': {
      sig: 'approve(address,uint256)',
      abi: 'function approve(address spender, uint256 amount)',
    },
  };

  console.log('🔍 Function Selector:', selector);

  const funcInfo = knownFunctions[selector];

  if (funcInfo) {
    console.log('   Signature:', funcInfo.sig);
    console.log('   Status: ✅ Known function');
    console.log();

    // Decode parameters
    console.log('📦 Decoding Parameters:');
    try {
      const functionName = funcInfo.sig.split('(')[0];
      const decodedParams = EVMCommandEncoder.decodeFunction(
        funcInfo.abi,
        functionName,
        calldata
      );

      console.log('   Parameters:');
      for (let i = 0; i < decodedParams.length; i++) {
        console.log(`     [${i}]:`, decodedParams[i].toString());
      }
    } catch (e: any) {
      console.log('   ❌ Error decoding:', e.message);
    }
  } else {
    console.log('   Signature: Unknown');
    console.log('   Status: ⚠️  Function signature not in database');
  }
  console.log();
}

/**
 * STEP 6: Validate and prepare for execution
 */
function validateForExecution(decoded: any) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 6: Validation & Execution Prep');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const command = EVMCommandEncoder.buildCommand(
    decoded.contract,
    decoded.data,
    {
      nonce: BigInt(decoded.nonce || 0),
      deadline: BigInt(decoded.deadline || 0),
      chainKey: 'SEPOLIA',
    }
  );

  const validation = EVMCommandEncoder.validateCommand(command);

  console.log('🔐 Validation Checks:');
  console.log(
    '   Contract Address: ',
    validation.errors.includes('Invalid target address')
      ? '❌ Invalid'
      : '✅ Valid'
  );
  console.log(
    '   Calldata Present: ',
    validation.errors.includes('No calldata provided') ? '❌ No' : '✅ Yes'
  );
  console.log(
    '   Deadline Valid:   ',
    decoded.deadline && decoded.deadline > Math.floor(Date.now() / 1000)
      ? '✅ Not expired'
      : '❌ Expired or missing'
  );
  console.log();

  if (validation.valid) {
    console.log('✅ Message is VALID and ready for execution!');
    console.log();
    console.log('🚀 Ready to Execute:');
    console.log(`   • Chain: SEPOLIA (Chain ID: ${command.chainId})`);
    console.log(`   • Contract: ${command.target}`);
    console.log(`   • Calldata: ${command.data.slice(0, 66)}...`);
    console.log();
    console.log('📝 Next Steps for Relayer:');
    console.log("   1. Check nonce hasn't been used (replay protection)");
    console.log('   2. Submit transaction to Sepolia RPC');
    console.log('   3. Monitor transaction confirmation');
    console.log('   4. Mark message as processed');
  } else {
    console.log('❌ Message is INVALID:');
    validation.errors.forEach((err) => console.log('   •', err));
  }
  console.log();
}

/**
 * Main flow - Process a Bitcoin transaction ID
 */
async function processBitcoinTransaction(txid: string) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   BMCP Decoder: From Bitcoin TXID to EVM Execution        ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );

  console.log('📌 Input: Bitcoin Transaction ID');
  console.log('   ' + txid);
  console.log();

  try {
    // Step 1: Fetch transaction from Bitcoin network
    const tx = await getTransaction(txid);

    // Step 2: Extract OP_RETURN outputs
    const opReturns = extractOPReturns(tx);

    if (opReturns.length === 0) {
      console.log('❌ No OP_RETURN outputs found in this transaction.');
      return;
    }

    // Step 3-6: Process each OP_RETURN
    for (const { index, data } of opReturns) {
      console.log(`\n🔄 Processing OP_RETURN output #${index}...\n`);

      // Step 3: Check BMCP magic
      const isBMCP = checkBMCPMagic(data);

      if (!isBMCP) {
        console.log('⏩ Skipping non-BMCP message\n');
        continue;
      }

      // Step 4: Decode BMCP message
      const decoded = decodeBMCPMessage(data);

      // Step 5: Decode function call
      decodeFunctionCall(decoded.data);

      // Step 6: Validate and prepare for execution
      validateForExecution(decoded);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ COMPLETE - Transaction processed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ ERROR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log();
    console.log('Error:', error.message);

    if (error.message.includes('No such mempool or blockchain transaction')) {
      console.log();
      console.log('💡 This transaction was not found. Possible reasons:');
      console.log("   • Transaction hasn't been broadcast yet");
      console.log('   • Transaction is on a different network');
      console.log('   • Still propagating through the network');
    }
  }
}

// Example: Process a transaction with BMCP message
// This would be a real TXID from your Bitcoin transaction
// Only run when executed directly (not when imported)
if (isDirectExecution) {
  try {
    const exampleTxid =
      process.argv[2] ||
      'c3c7add2097d94a01116de65f14a9fed765ec25594da1c8715e55b53ae760064';

    processBitcoinTransaction(exampleTxid);
  } catch (e) {
    // Silently fail if running in non-Node environment
  }
}



export { 
  getTransaction,
  extractOPReturns,
  checkBMCPMagic,
  decodeBMCPMessage,
  validateForExecution
}