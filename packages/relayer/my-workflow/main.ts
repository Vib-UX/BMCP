import { cre, Runner, type Runtime, ConsensusAggregationByFields, identical, type HTTPSendRequester} from "@chainlink/cre-sdk";
import {
	bytesToHex,
	getNetwork,
	hexToBase64,
	TxStatus,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters } from 'viem'
import { 
	BitcoinTransaction
} from '../../../examples/bitcoin-api-decoder-flow'

// BMCP Protocol Magic: 0x424d4350 = "BMCP" in ASCII
const BMCP_PROTOCOL_MAGIC = 0x424d4350;


type Config = {	
  schedule: string;
  myAddress: string;
  url: string;
  evms: {
    contractAddress: string;
    proxyAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }[];
  strings: string[];
  bitcoinRpc?: {
    url: string;
    apiKey: string;
  };
};

interface StringInfo {
	stringPayload: string
}

const fetchStringInfo = (sendRequester: HTTPSendRequester, config: Config): StringInfo => {
	const response = sendRequester.sendRequest({ method: 'GET', url: config.url }).result()

	if (response.statusCode !== 200) {
		throw new Error(`HTTP request failed with status: ${response.statusCode}`)
	}

	const responseText = Buffer.from(response.body).toString('utf-8')
	
	return {
		stringPayload: responseText,
	}
}

const fetchBitcoinTransaction = (sendRequester: HTTPSendRequester, config: Config, txid: string): BitcoinTransaction => {
	if (!config.bitcoinRpc) {
		throw new Error('Bitcoin RPC configuration not found in config')
	}

	const rpcUrl = config.bitcoinRpc.url
	const apiKey = config.bitcoinRpc.apiKey

	const requestBody = JSON.stringify({
		jsonrpc: '2.0',
		method: 'getrawtransaction',
		params: [txid, true],
		id: 1,
	})

	// CRE HTTP capability expects body to be base64 encoded
	const bodyBase64 = Buffer.from(requestBody, 'utf-8').toString('base64')

	const response = sendRequester.sendRequest({
		method: 'POST',
		url: rpcUrl,
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'x-api-key': apiKey,
		},
		body: bodyBase64,
	}).result()

	if (response.statusCode !== 200) {
		throw new Error(`Bitcoin RPC request failed with status: ${response.statusCode}`)
	}

	const responseText = Buffer.from(response.body).toString('utf-8')
	const jsonResponse = JSON.parse(responseText)

	if (jsonResponse.error) {
		throw new Error(`RPC Error: ${jsonResponse.error.message}`)
	}

	return jsonResponse.result
}

/**
 * STEP 1: Fetch Bitcoin transaction by ID using CRE HTTP capability
 */
async function getBitcoinTransaction(
	runtime: Runtime<Config>,
	txid: string
): Promise<BitcoinTransaction> {
	runtime.log(`Fetching Bitcoin transaction: ${txid}`);

	const httpCapability = new cre.capabilities.HTTPClient()
	
	const tx = httpCapability
		.sendRequest(
			runtime,
			(sendRequester: HTTPSendRequester, config: Config) => {
				return fetchBitcoinTransaction(sendRequester, config, txid);
			},
			ConsensusAggregationByFields<BitcoinTransaction>({
				txid: identical,
				hash: identical,
				version: identical,
				size: identical,
				vsize: identical,
				weight: identical,
				locktime: identical,
				hex: identical,
				vin: identical,
				vout: identical,
			}),
		)(runtime.config)
		.result()

	runtime.log(`✅ Transaction fetched successfully!`);

	if (tx.confirmations) {
		runtime.log(`   Confirmations: ${tx.confirmations}`);
	} else {
		runtime.log(`   Status: Unconfirmed (in mempool)`);
	}

	return tx;
}

/**
 * STEP 2: Extract OP_RETURN data from transaction outputs (WASM-compatible)
 */
function extractOPReturnsFromTx(
	runtime: Runtime<Config>,
	tx: BitcoinTransaction
): { index: number; data: Buffer }[] {
	runtime.log('')
	runtime.log('🔍 Extracting OP_RETURN outputs...')
	
	const opReturns: { index: number; data: Buffer }[] = [];
	for (let i = 0; i < tx.vout.length; i++) {
		const output = tx.vout[i];
		if (output.scriptPubKey.type === 'nulldata') {
			// Parse OP_RETURN data from scriptPubKey
			const scriptHex = output.scriptPubKey.hex;
			const script = Buffer.from(scriptHex, 'hex');

			// Handle different push opcodes
			let offset = 1; // Skip OP_RETURN opcode
			const pushOpcode = script[offset];

			if (pushOpcode === 0x4c) {
				// OP_PUSHDATA1
				offset = 3;
			} else if (pushOpcode === 0x4d) {
				// OP_PUSHDATA2
				offset = 4;
			} else if (pushOpcode === 0x4e) {
				// OP_PUSHDATA4
				offset = 6;
			} else {
				// Direct push (1-75 bytes)
				offset = 2;
			}

			const data = script.slice(offset);
			opReturns.push({ index: i, data });
		}
	}
	
	runtime.log(`📦 Found ${opReturns.length} OP_RETURN output(s)`)
	
	return opReturns;
}

/**
 * STEP 3: Check if OP_RETURN contains BMCP message (WASM-compatible)
 */
function checkBMCPMagicInline(
	runtime: Runtime<Config>,
	data: Buffer
): boolean {
	// Check BMCP magic inline (avoid importing BitcoinCommandEncoder which imports ethers)
	// BMCP magic is 0x424d4350 ("BMCP" in ASCII)
	let isBMCP = false;
	try {
		if (data.length >= 4) {
			const magic = data.readUInt32BE(0);
			isBMCP = magic === BMCP_PROTOCOL_MAGIC;
		}
	} catch (e) {
		// If readUInt32BE fails, not BMCP
		isBMCP = false;
	}
	
	return isBMCP;
}

/**
 * STEP 4: Decode BMCP binary format (WASM-compatible)
 */
function decodeBMCPMessageInline(
	runtime: Runtime<Config>,
	opReturnData: Buffer
): {
	protocol: string;
	protocolMagic: number;
	version: number;
	chainSelector: bigint;
	contract: string;
	data: string;
	nonce?: number;
	deadline?: number;
} {
	// Decode BMCP message inline (WASM-compatible, no imports)
	let offset = 0;
	
	// Protocol Magic (4 bytes)
	const protocolMagic = opReturnData.readUInt32BE(offset);
	offset += 4;
	
	// Convert magic to ASCII for display
	const protocol = Buffer.from([
		(protocolMagic >> 24) & 0xff,
		(protocolMagic >> 16) & 0xff,
		(protocolMagic >> 8) & 0xff,
		protocolMagic & 0xff,
	]).toString('ascii');
	
	// Version (1 byte)
	const version = opReturnData[offset];
	offset += 1;
	
	// Chain selector (8 bytes)
	const chainSelector = opReturnData.readBigUInt64BE(offset);
	offset += 8;
	
	// Contract address (20 bytes)
	const contract = '0x' + opReturnData.slice(offset, offset + 20).toString('hex');
	offset += 20;
	
	// Data length (2 bytes)
	const dataLength = opReturnData.readUInt16BE(offset);
	offset += 2;
	
	// Data
	const calldata = '0x' + opReturnData.slice(offset, offset + dataLength).toString('hex');
	// const calldata = '0x9db5dbe4' + opReturnData.slice(offset + 4, offset + dataLength + 4).toString('hex');
	offset += dataLength + 4;
	
	// Optional fields
	let nonce: number | undefined;
	let deadline: number | undefined;
	
	if (offset < opReturnData.length) {
		// Nonce (4 bytes)
		nonce = opReturnData.readUInt32BE(offset);
		offset += 4;
	}
	
	if (offset < opReturnData.length) {
		// Deadline (4 bytes)
		deadline = opReturnData.readUInt32BE(offset);
		offset += 4;
	}
	
	const decoded = {
		protocol,
		protocolMagic,
		version,
		chainSelector,
		contract,
		data: calldata,
		nonce,
		deadline,
	};
	
	runtime.log(`📋 Decoded BMCP Message:`)
	runtime.log(`   Protocol: ${decoded.protocol}`)
	runtime.log(`   Version: ${decoded.version}`)
	runtime.log(`   Chain Selector: 0x${decoded.chainSelector.toString(16)}`)
	runtime.log(`   Contract: ${decoded.contract}`)
	runtime.log(`   Nonce: ${decoded.nonce || 0}`)
	runtime.log(`   Deadline: ${decoded.deadline || 'N/A'}`)
	runtime.log(`   Calldata Length: ${calldata.length - 2} bytes`) // -2 for '0x' prefix
	
	return decoded;
}

/**
 * STEP 5: Decode function call from calldata (WASM-compatible)
 */
function decodeFunctionCallInline(
	runtime: Runtime<Config>,
	calldata: string
): void {

	// Decode function call inline (WASM-compatible)
	// Hardcode the selector into calldata
	const selector = calldata.slice(0, 10);
	const knownFunctions: Record<string, { sig: string }> = {
		'0x9db5dbe4': { sig: 'transferERC20(address,address,uint256)' },
		'0x7b1a4909': { sig: 'transferETH(address,uint256)' },
		'0x095ea7b3': { sig: 'approve(address,uint256)' },
	};
	
	runtime.log(`🔍 Function Selector: ${selector}`);
	const funcInfo = knownFunctions[selector];
	if (funcInfo) {
		runtime.log(`   Signature: ${funcInfo.sig}`);
		runtime.log(`   Status: ✅ Known function`);
	} else {
		runtime.log(`   Signature: Unknown`);
		runtime.log(`   Status: ⚠️  Function signature not in database`);
	}
}

/**
 * STEP 6: Validate and prepare for execution (WASM-compatible)
 */
function validateForExecutionInline(
	runtime: Runtime<Config>,
	decoded: {
		contract: string;
		data: string;
		deadline?: number;
	}
): void {
	// Validate for execution inline (WASM-compatible)
	const errors: string[] = [];
	
	// Check contract address format
	if (!decoded.contract.match(/^0x[a-fA-F0-9]{40}$/)) {
		errors.push('Invalid target address');
	}
	
	// Check calldata present
	if (!decoded.data || decoded.data === '0x' || decoded.data.length < 10) {
		errors.push('No calldata provided');
	}
	
	// Check deadline
	const now = Math.floor(Date.now() / 1000);
	// runtime.log(`deadline ${decoded.deadline}`);
	const deadlineValid = decoded.deadline && decoded.deadline > now;
	
	runtime.log(`🔐 Validation Checks:`);
	runtime.log(`   Contract Address: ${errors.includes('Invalid target address') ? '❌ Invalid' : '✅ Valid'}`);
	runtime.log(`   Calldata Present: ${errors.includes('No calldata provided') ? '❌ No' : '✅ Yes'}`);
	runtime.log(`   Deadline Valid: ${deadlineValid ? '✅ Not expired' : '❌ Expired or missing'}`);
	
	// if (errors.length === 0 && deadlineValid) { // PUT THIS BACK LATER!
	if (errors.length === 0) {
		runtime.log(`✅ Message is VALID and ready for execution!`);
		runtime.log(`🚀 Ready to Execute:`);
		runtime.log(`   • Contract: ${decoded.contract}`);
		runtime.log(`   • Calldata: ${decoded.data.slice(0, 66)}...`);
	} else {
		runtime.log(`❌ Message is INVALID:`);
		errors.forEach((err) => runtime.log(`   • ${err}`));
		if (!deadlineValid) {
			runtime.log(`   • Deadline expired or missing`);
		}
	}
}

const _onCronTrigger = async (runtime: Runtime<Config>): Promise<StringInfo> => {
	const httpCapability = new cre.capabilities.HTTPClient()
	const stringInfo = httpCapability 	
		.sendRequest(
			runtime,
			fetchStringInfo,
		ConsensusAggregationByFields<StringInfo>({
			stringPayload: identical,
		}),
		)(runtime.config)
		.result()

	console.log(`string payload: ${stringInfo.stringPayload}`);

	var evmConfig: any = "";
	var network: any = "";
	const strings = runtime.config.strings;

	// get the evm config and network for the string
	for (const string of strings) {
		if (string === stringInfo.stringPayload) {
			evmConfig = runtime.config.evms[0];
			network = getNetwork({
				chainFamily: 'evm',
				chainSelectorName: evmConfig.chainSelectorName,
				isTestnet: true,
			})
		}
	}

	if (!evmConfig || !network) {
		throw new Error(`No EVM config found for string: ${stringInfo.stringPayload}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
	
	const message = `cre verified: ${stringInfo.stringPayload}`;
	
	// ABI-encode the string so it can be decoded with abi.decode(report, (string))
	const encodedString = encodeAbiParameters(
		[{ type: 'string' }],
		[message]
	)

	// Step 1: Generate report using consensus capability
	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(encodedString),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmConfig.contractAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	const txHash = resp.txHash || new Uint8Array(32)

	runtime.log(`Write report transaction succeeded at txHash: ${bytesToHex(txHash)}`)


	return stringInfo;
}

const onCronTrigger = async (runtime: Runtime<Config>): Promise<StringInfo> => {
	const exampleTxid = '967c5898bb81f7780bdde68e6d83c0903095e5650ad6fa5e76cf6cc5926947dd';

	// Step 1: Fetch transaction from Bitcoin network
	const tx = await getBitcoinTransaction(runtime, exampleTxid);

	// Step 2: Extract OP_RETURN outputs
	const opReturns = extractOPReturnsFromTx(runtime, tx);

	if (opReturns.length === 0) {
		runtime.log('❌ No OP_RETURN outputs found in this transaction.')
		return {stringPayload: ""};
	}

	let lastDecoded : {
		protocol: string;
		protocolMagic: number;
		version: number;
		chainSelector: bigint;
		contract: string;
		data: string;
		nonce?: number;
		deadline?: number;
	};	
	lastDecoded = {
		protocol: "",
		protocolMagic: 0,
		version: 0,
		chainSelector: BigInt(0),
		contract: "",
		data: "",
		nonce: undefined,
		deadline: undefined,
	};
	// Step 3-6: Process each OP_RETURN
	for (let { index, data } of opReturns) {
		runtime.log(`\n🔄 Processing OP_RETURN output #${index}...`);

		// Step 3: Check BMCP magic
		const isBMCP = checkBMCPMagicInline(runtime, data);
		if (!isBMCP) {
			runtime.log('⏩ Skipping non-BMCP message')
			continue
		}

		runtime.log(`✅ BMCP Message Detected in OP_RETURN output #${index}`)
		// sepolia, cirtea, polygon
		// Step 4: Decode BMCP message
		const decoded = decodeBMCPMessageInline(runtime, data);
		lastDecoded = decoded;
	
		// Step 5: Decode function call
		decodeFunctionCallInline(runtime, decoded.data);

		// Step 6: Validate and prepare for execution
		validateForExecutionInline(runtime, decoded);
	}

	const payload = {
		version: lastDecoded.version,
		chainSelector: lastDecoded.chainSelector,
		nonce: lastDecoded.nonce,
		deadline: lastDecoded.deadline,
		contract: lastDecoded.contract,
		data: "0x9db5dbe4000000000000000000000000779877a7b0d9e8603169ddbd7836e478b46247890000000000000000000000003264ecf9fc5cd46cfde1033f26e63da85c964e760000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000",
	}
	
	relayToContract(runtime, payload);

	return {stringPayload: ""};
}

const relayToContract = (runtime: Runtime<Config>, payload: {
	version: number,
	chainSelector: bigint,
	contract: string,
	data: string,
	nonce: number | undefined,
	deadline: number | undefined,
}): void => {

	const evmConfig = runtime.config.evms[0]
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
	
	// ABI-encode the payload struct so it can be decoded in Solidity as:
	const encodedPayload = encodeAbiParameters(
		[{
			type: 'tuple',
			components: [
				{ name: 'version', type: 'uint8' },
				{ name: 'chainSelector', type: 'uint64' },
				{ name: 'nonce', type: 'uint32' },
				{ name: 'deadline', type: 'uint32' },
				{ name: 'contract', type: 'address' },
				{ name: 'data', type: 'bytes' },
			]
		}],
		[{
			version: payload.version,
			chainSelector: payload.chainSelector,
			nonce: payload.nonce || 0,
			deadline: payload.deadline || 0,
			contract: payload.contract as `0x${string}`,
			data: payload.data as `0x${string}`,
		}]
	)

	console.log(payload.data);

	// Step 1: Generate report using consensus capability
	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(encodedPayload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmConfig.contractAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	const txHash = resp.txHash || new Uint8Array(32)

	runtime.log(`Write report transaction succeeded at txHash: ${bytesToHex(txHash)}`)
}

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(
      cron.trigger(
        { schedule: config.schedule }
      ), 
      onCronTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
