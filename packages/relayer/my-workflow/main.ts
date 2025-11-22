import { cre, Runner, type Runtime, ConsensusAggregationByFields, identical, type HTTPSendRequester} from "@chainlink/cre-sdk";
import {
	bytesToHex,
	getNetwork,
	hexToBase64,
	TxStatus,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters } from 'viem'

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

const onCronTrigger = async (runtime: Runtime<Config>): Promise<StringInfo> => {
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

const relayToContract = (runtime: Runtime<Config>) => {

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
	
	const message = "hello from cre!"
	
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
