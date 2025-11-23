import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { MessageEncoder, PROTOCOL_CONSTANTS, CHAIN_SELECTORS } from '@bmcp/sdk';
import { AddressPurpose, request } from 'sats-connect';

// Extended chain selectors with Citrea and Polygon
const SUPPORTED_CHAINS = [
  {
    name: 'Polygon Amoy',
    selector: BigInt('4051577828743386545'),
    logo: '🟣',
    network: 'testnet'
  },
  {
    name: 'Base Sepolia',
    selector: CHAIN_SELECTORS.BASE_SEPOLIA,
    logo: '🔵',
    network: 'testnet'
  },
  {
    name: 'Citrea Testnet',
    selector: BigInt('0x434954524541'), // 'CITREA' in hex
    logo: '🟡',
    network: 'testnet'
  },
];

// Common function signatures for quick selection
const COMMON_FUNCTIONS = [
  { label: '<custom>', value: '' },
  { label: 'deposit(address,uint256)', value: 'deposit(address,uint256)' },
  { label: 'transfer(address,uint256)', value: 'transfer(address,uint256)' },
  { label: 'execute(address,uint256,bytes)', value: 'execute(address,uint256,bytes)' },
  { label: 'mint(address,uint256)', value: 'mint(address,uint256)' },
  { label: 'swap(address,address,uint256)', value: 'swap(address,address,uint256)' },
];

export function BMCPDashboard() {
  const [bitcoinAddress, setBitcoinAddress] = useState<string>("")
  const [sendBmcpData, setSendBmcpData] = useState<string>("")
  const [feeRateOverride, setFeeRateOverride] = useState<string>("0")
  const [unsignedPsbt, setUnsignedPsbt] = useState<string>("")
  const [psbtInputs, setPsbtInputs] = useState<Array<number>>([])
  const [signedPsbt, setSignedPsbt] = useState<string>("")
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [receiverAddress, setReceiverAddress] = useState('0x0000000000000000000000000000000000000000');
  const [functionSignature, setFunctionSignature] = useState(COMMON_FUNCTIONS[1].value);
  const [args, setArgs] = useState('["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "1000000000000000000"]');
  const [gasLimit, setGasLimit] = useState('300000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [encodedPreview, setEncodedPreview] = useState<{
    functionSelector: string,
    encodedData: string,
    messageSize: number,
    opReturnScript: string,
    ccipMessage: {
      protocolId: number,
      version: number
      chainSelector: bigint,
      receiver: string,
      data: Uint8Array<ArrayBufferLike>,
      gasLimit: bigint
      extraArgs: Uint8Array<ArrayBufferLike>
    }
  } | null>(null);

  const connectXverse = async () => {
    try {
      setError("")
      setLoading(true)
      const response = await request('wallet_connect', null);
      if (response.status === 'error') {
        throw new Error(JSON.stringify(response.error))
      }
      const paymentAddressData = response.result.addresses?.find(address => address.purpose === AddressPurpose.Payment);
      if (!paymentAddressData) {
        throw new Error('Could not find payment address')
      }
      setBitcoinAddress(paymentAddressData.address)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      setLoading(false)
    }
  }

  const fetchPsbt = async () => {
    try {
      setError("")
      setLoading(true)
      if (!bitcoinAddress?.length) {
        throw new Error('Xverse not connected')
      }
      if (!sendBmcpData?.length) {
        throw new Error('No sendBmcpData')
      }
      const response = await fetch("http://localhost:3000/psbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: bitcoinAddress,
          sendBmcpData,
          feeRateOverride: Number(feeRateOverride) >= 1 ? Number(feeRateOverride) : undefined
        }),
      })
      if (!response.ok) {
        throw new Error("Failed to fetch PSBT")
      }
      const data = await response.json()
      setUnsignedPsbt(data.psbtBase64)
      setPsbtInputs(data.psbtInputs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch PSBT")
    } finally {
      setLoading(false)
    }
  }

  const signPsbt = async () => {
    try {
      setError("")
      setLoading(true)
      if (!bitcoinAddress?.length) {
        throw new Error('Wallet not connected')
      }
      if (!unsignedPsbt?.length) {
        throw new Error('PSBT not found')
      }
      const response = await request('signPsbt', {
        psbt: unsignedPsbt,
        signInputs: { [bitcoinAddress]: psbtInputs },
        broadcast: false
      });
      if (response.status === 'error') {
        throw new Error(JSON.stringify(response.error))
      }
      setSignedPsbt(response.result.psbt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign PSBT")
    } finally {
      setLoading(false)
    }
  }

  const broadcastSignedPsbt = async () => {
    try {
      setError("")
      setLoading(true)
      if (!signedPsbt?.length) {
        throw new Error('PSBT not signed')
      }
      const response = await fetch("http://localhost:3000/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txBase64: signedPsbt,
        }),
      })
      if (!response.ok) {
        throw new Error("Failed to broadcast transaction")
      }
      const data = await response.json()
      setSuccess(JSON.stringify(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign PSBT")
    } finally {
      setLoading(false)
    }
  }

  // Parse function signature to extract parameter types
  const parseFunctionSignature = (signature: string) => {
    const match = signature.match(/\((.*)\)/);
    if (!match) throw new Error('Invalid function signature');
    const paramTypes = match[1].split(',').map(t => t.trim()).filter(t => t);
    return paramTypes;
  };

  // Encode message and generate preview
  const encodeMessage = () => {
    try {
      setError('');
      // Validate inputs
      if (!receiverAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid receiver address format');
      }
      const parsedArgs = JSON.parse(args);
      const paramTypes = parseFunctionSignature(functionSignature);
      if (paramTypes.length !== parsedArgs.length) {
        throw new Error(`Function expects ${paramTypes.length} arguments, but ${parsedArgs.length} provided`);
      }
      // Create function selector
      const functionSelector = ethers.id(functionSignature).slice(0, 10);
      // Encode parameters
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encodedParams = paramTypes.length > 0
        ? abiCoder.encode(paramTypes, parsedArgs)
        : '0x';
      // Combine selector + params
      const fullEncodedData = functionSelector + encodedParams.slice(2);
      const messageData = ethers.getBytes(fullEncodedData);
      // Encode extra args
      const extraArgs = MessageEncoder.encodeExtraArgs({
        gasLimit: Number(300000),
        allowOutOfOrderExecution: false,
      });
      // Create CCIP message
      const ccipMessage = {
        protocolId: PROTOCOL_CONSTANTS.PROTOCOL_ID,
        version: PROTOCOL_CONSTANTS.VERSION_V2,
        chainSelector: selectedChain.selector,
        receiver: receiverAddress,
        data: messageData,
        gasLimit: BigInt(300000),
        extraArgs,
      };
      // Encode to bytes for OP_RETURN
      const messageBytes = MessageEncoder.encode(ccipMessage);
      const opReturnScript = MessageEncoder.createOPReturnScript(messageBytes);
      setEncodedPreview({
        functionSelector,
        encodedData: fullEncodedData,
        messageSize: messageBytes.length,
        opReturnScript: opReturnScript,
        ccipMessage
      });
      return { messageBytes, opReturnScript };
    } catch (err: any) {
      setError(`Encoding error: ${err.message}`);
      throw err;
    }
  };

  // Update preview when inputs change
  useEffect(() => {
    try {
      encodeMessage();
    } catch {
      setEncodedPreview(null);
    }
  }, [selectedChain, receiverAddress, functionSignature, args, gasLimit]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ⚡ Bitcoin Multichain Protocol
          </h1>
          <p className="text-gray-600">
            Send cross-chain messages from Bitcoin to any EVM chain
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            Create Cross-Chain Message
          </h2>

          {/* Chain Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Chain
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SUPPORTED_CHAINS.map((chain) => (
                <button
                  key={chain.name}
                  onClick={() => setSelectedChain(chain)}
                  className={`p-4 rounded-lg border-2 transition ${selectedChain.name === chain.name
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="text-2xl mb-1">{chain.logo}</div>
                  <div className="font-semibold text-sm">{chain.name}</div>
                  <div className="text-xs text-gray-500">{chain.network}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Receiver Address */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receiver Contract Address
            </label>
            <input
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Function Signature */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Function Signature
            </label>
            <select
              onChange={(e) => setFunctionSignature(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 text-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-2"
            >
              {COMMON_FUNCTIONS.map((fn) => (
                <option key={fn.label} value={fn.value}>
                  {fn.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={functionSignature}
              onChange={(e) => setFunctionSignature(e.target.value)}
              placeholder="functionName(type1,type2,...)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Examples: deposit(address,uint256), transfer(address,uint256)
            </p>
          </div>

          {/* Arguments */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Function Arguments (JSON Array)
            </label>
            <textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              rows={4}
              placeholder='["0x...", "1000000000000000000"]'
              className="w-full px-4 py-3 border border-gray-300 text-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Enter arguments as a JSON array matching the function signature types
            </p>
          </div>

          {/* Gas Limit */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gas Limit
            </label>
            <input
              type="number"
              value={gasLimit}
              onChange={(e) => setGasLimit(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 text-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Fee Rate Override */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fee Rate Override
            </label>
            <input
              type="number"
              value={feeRateOverride}
              onChange={(e) => setFeeRateOverride(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 text-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* BMCP Data */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              BMCP Data
            </label>
            <input
              type="string"
              value={sendBmcpData}
              onChange={(e) => setSendBmcpData(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 text-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={!bitcoinAddress?.length ? connectXverse : !unsignedPsbt?.length ? fetchPsbt : !signedPsbt.length ? signPsbt : broadcastSignedPsbt}
            disabled={loading || !receiverAddress || !!success?.length}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-lg font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : !bitcoinAddress?.length ? ('Connect Xverse') : !unsignedPsbt?.length ? ('Fetch PSBT') : !signedPsbt.length ? ('Sign PSBT') : !success?.length ? ('Broadcast Transaction') : ('Broadcasted')}
          </button>

          {/* Error & Success Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border break-all border-red-200 rounded-lg text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}
          {unsignedPsbt && (
            <div className="mt-4 p-4 bg-blue-50 border break-all border-blue-200 rounded-lg text-blue-700">
              <strong>Unsigned PSBT:</strong> {unsignedPsbt}
            </div>
          )}
          {signedPsbt && (
            <div className="mt-4 p-4 bg-purple-50 border break-all border-purple-200 rounded-lg text-purple-700">
              <strong>Signed PSBT:</strong> {signedPsbt}
            </div>
          )}
          {success && (
            <div className="mt-4 p-4 bg-green-50 border break-all border-green-200 rounded-lg text-green-700">
              <strong>Success:</strong> <a href={JSON.parse(success).link}>{JSON.parse(success).txHash}</a>
              <br />
              <pre>{JSON.stringify(JSON.parse(success), null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

