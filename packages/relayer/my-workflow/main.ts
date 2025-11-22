import { cre, Runner, type Runtime } from "@chainlink/cre-sdk";
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
  evms: {
    contractAddress: string;
    proxyAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }[];
};

const onCronTrigger = (runtime: Runtime<Config>): string => {
  // runtime.log("Hello world! Workflow triggered.");
  // runtime.log(`My address is: ${runtime.config.myAddress}`);

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

	// Encode the contract call data for updateReserves
	// const callData = encodeFunctionData({
	// 	abi: ReserveManager,
	// 	functionName: 'updateReserves',
	// 	args: [
	// 		{
	// 			totalMinted: totalSupply,
	// 			totalReserve: totalReserveScaled,
	// 		},
	// 	],
	// })
  
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

	return txHash.toString()
};

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
