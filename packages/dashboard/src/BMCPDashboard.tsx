import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BitcoinCommandEncoder, CHAIN_SELECTORS } from '@bmcp/sdk';
import { AddressPurpose, request } from 'sats-connect';
import { Buffer } from 'buffer';

// Make Buffer available globally for the SDK
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// API Configuration - defaults to localhost, can switch to production
const BITCOIN_API_URL =
  import.meta.env.VITE_BITCOIN_API_URL || 'http://localhost:3000';

// Extended chain selectors with suggested addresses
const SUPPORTED_CHAINS = [
  {
    name: 'Base Sepolia',
    selector: CHAIN_SELECTORS.BASE_SEPOLIA,
    logo: '🔵',
    network: 'testnet',
    suggestedAddress: '0x0000000000000000000000000000000000000000',
  },
  {
    name: 'Sepolia',
    selector: CHAIN_SELECTORS.SEPOLIA,
    logo: '🔷',
    network: 'testnet',
    suggestedAddress: '0x15fC6ae953E024d975e77382eEeC56A9101f9F88',
  },
  {
    name: 'Polygon Amoy',
    selector: CHAIN_SELECTORS.POLYGON_AMOY,
    logo: '🟣',
    network: 'testnet',
    suggestedAddress: '0x0000000000000000000000000000000000000000',
  },
  {
    name: 'Citrea Testnet',
    selector: CHAIN_SELECTORS.CITREA_TESTNET,
    logo: '🟡',
    network: 'testnet',
    suggestedAddress: '0x0000000000000000000000000000000000000000',
  },
];

// Common EVM function signatures
const COMMON_FUNCTIONS = [
  {
    label: 'Custom Function',
    value: '',
  },
  {
    label: 'deposit(address,uint256)',
    value: 'deposit(address,uint256)',
  },
  {
    label: 'transfer(address,uint256)',
    value: 'transfer(address,uint256)',
  },
  {
    label: 'approve(address,uint256)',
    value: 'approve(address,uint256)',
  },
  {
    label: 'mint(address,uint256)',
    value: 'mint(address,uint256)',
  },
  {
    label: 'burn(uint256)',
    value: 'burn(uint256)',
  },
];

export function BMCPDashboard() {
  const [bitcoinAddress, setBitcoinAddress] = useState<string>('');
  const [feeRateOverride, setFeeRateOverride] = useState<string>('0');
  const [unsignedPsbt, setUnsignedPsbt] = useState<string>('');
  const [_psbtInputs, setPsbtInputs] = useState<Array<number>>([]);
  const [signedPsbt, setSignedPsbt] = useState<string>('');
  const [sendBmcpData, setSendBmcpData] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[1]); // Default to Sepolia
  const [receiverAddress, setReceiverAddress] = useState(
    SUPPORTED_CHAINS[1].suggestedAddress
  );
  const [functionSignature, setFunctionSignature] = useState(
    COMMON_FUNCTIONS[1].value
  );
  const [args, setArgs] = useState(
    '["0x0000000000000000000000000000000000000000", "1000000000000000000"]'
  );
  const [gasLimit, setGasLimit] = useState('300000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [encodedPreview, setEncodedPreview] = useState<{
    functionSelector: string;
    encodedData: string;
    bmcpData: string;
    opReturnScript: string;
    messageSize: number;
    decodedMessage?: {
      protocol: string;
      version: number;
      chainSelector: bigint;
      contract: string;
      data: string;
      nonce?: number;
      deadline?: number;
    };
  } | null>(null);

  const connectXverse = async () => {
    try {
      setError('');
      setLoading(true);
      const response = await request('wallet_connect', null);
      if (response.status === 'error') {
        throw new Error(JSON.stringify(response.error));
      }
      const paymentAddressData = response.result.addresses?.find(
        (address) => address.purpose === AddressPurpose.Payment
      );
      if (!paymentAddressData) {
        throw new Error('Could not find payment address');
      }
      setBitcoinAddress(paymentAddressData.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const fetchPsbt = async () => {
    try {
      setError('');
      setLoading(true);
      if (!bitcoinAddress?.length) {
        throw new Error('Xverse not connected');
      }
      if (!encodedPreview?.opReturnScript?.length) {
        throw new Error('No opReturnScript');
      }
      const response = await fetch(`${BITCOIN_API_URL}/psbt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: bitcoinAddress,
          sendBmcpData: encodedPreview.opReturnScript,
          feeRateOverride:
            Number(feeRateOverride) >= 1 ? Number(feeRateOverride) : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch PSBT');
      }
      const data = await response.json();
      setUnsignedPsbt(data.psbtBase64);
      setPsbtInputs(data.psbtInputs);

      // Auto-sign after PSBT is created
      setTimeout(() => signPsbtAuto(data.psbtBase64, data.psbtInputs), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PSBT');
      setLoading(false);
    }
  };

  const signPsbtAuto = async (psbtBase64: string, inputs: number[]) => {
    try {
      if (!bitcoinAddress?.length) {
        throw new Error('Wallet not connected');
      }
      const response = await request('signPsbt', {
        psbt: psbtBase64,
        signInputs: { [bitcoinAddress]: inputs },
        broadcast: false,
      });
      if (response.status === 'error') {
        throw new Error(JSON.stringify(response.error));
      }
      setSignedPsbt(response.result.psbt);

      // Auto-broadcast after signing
      setTimeout(() => broadcastSignedPsbtAuto(response.result.psbt), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign PSBT');
      setLoading(false);
    }
  };

  const broadcastSignedPsbtAuto = async (psbtSigned: string) => {
    try {
      const response = await fetch(`${BITCOIN_API_URL}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txBase64: psbtSigned,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to broadcast transaction');
      }
      const data = await response.json();
      setSuccess(JSON.stringify(data));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to broadcast transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  // Parse function signature to extract parameter types
  const parseFunctionSignature = (signature: string) => {
    const match = signature.match(/\((.*)\)/);
    if (!match) throw new Error('Invalid function signature');
    const paramTypes = match[1]
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    return paramTypes;
  };

  // Encode message and generate preview using BitcoinCommandEncoder
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
        throw new Error(
          `Function expects ${paramTypes.length} arguments, but ${parsedArgs.length} provided`
        );
      }

      // Create function selector
      const functionSelector = ethers.id(functionSignature).slice(0, 10);

      // Encode the BMCP message using BitcoinCommandEncoder
      const bmcpPayload = BitcoinCommandEncoder.encodeBinary(
        selectedChain.selector,
        receiverAddress,
        {
          signature: functionSignature,
          args: parsedArgs,
        },
        {
          nonce: Math.floor(Date.now() / 1000), // Use timestamp as nonce
          deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        }
      );

      // Convert to hex string with 0x prefix
      const bmcpData = '0x' + bmcpPayload.toString('hex');

      // Update the sendBmcpData state so it can be used for PSBT
      setSendBmcpData(bmcpData);

      // Decode for preview
      const decoded = BitcoinCommandEncoder.decodeBinary(bmcpPayload);

      setEncodedPreview({
        functionSelector,
        encodedData: decoded.data,
        bmcpData,
        opReturnScript: bmcpData,
        messageSize: bmcpPayload.length,
        decodedMessage: {
          protocol: decoded.protocol,
          version: decoded.version,
          chainSelector: decoded.chainSelector,
          contract: decoded.contract,
          data: decoded.data,
          nonce: decoded.nonce,
          deadline: decoded.deadline,
        },
      });

      return { bmcpPayload, bmcpData };
    } catch (err: any) {
      setError(`Encoding error: ${err.message}`);
      throw err;
    }
  };

  // Auto-update receiver address when chain changes (if using a suggested address)
  useEffect(() => {
    const isSuggestedAddress = SUPPORTED_CHAINS.some(
      (chain) => chain.suggestedAddress === receiverAddress
    );
    if (
      isSuggestedAddress ||
      !receiverAddress ||
      receiverAddress === '0x0000000000000000000000000000000000000000'
    ) {
      if (
        selectedChain.suggestedAddress &&
        selectedChain.suggestedAddress !==
          '0x0000000000000000000000000000000000000000'
      ) {
        setReceiverAddress(selectedChain.suggestedAddress);
      }
    }
  }, [selectedChain]);

  // Auto-generate BMCP data whenever inputs change
  useEffect(() => {
    try {
      encodeMessage();
      setError(''); // Clear any previous errors
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Create Cross-Chain Message
            </h2>
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              API: {BITCOIN_API_URL.includes('localhost') ? 'Local' : 'Railway'}
            </div>
          </div>

          {/* Chain Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Chain
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SUPPORTED_CHAINS.map((chain) => (
                <button
                  key={chain.name}
                  onClick={() => setSelectedChain(chain)}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedChain.name === chain.name
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
            <div className="flex gap-2">
              <input
                type="text"
                value={receiverAddress}
                onChange={(e) => setReceiverAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm bg-white"
              />
              {selectedChain.suggestedAddress &&
                selectedChain.suggestedAddress !==
                  '0x0000000000000000000000000000000000000000' && (
                  <button
                    type="button"
                    onClick={() =>
                      setReceiverAddress(selectedChain.suggestedAddress)
                    }
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium whitespace-nowrap"
                    title={`Use ${selectedChain.name} receiver`}
                  >
                    Use {selectedChain.name}
                  </button>
                )}
            </div>
            {selectedChain.suggestedAddress &&
              selectedChain.suggestedAddress !==
                '0x0000000000000000000000000000000000000000' && (
                <p className="text-xs text-gray-500 mt-2">
                  💡 Suggested:{' '}
                  <span className="font-mono text-blue-600">
                    {selectedChain.suggestedAddress}
                  </span>
                </p>
              )}
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
              {!COMMON_FUNCTIONS.find(
                (f) => f.value === functionSignature && f.value !== ''
              )
                ? 'Enter your custom function signature'
                : 'Examples: deposit(address,uint256), transfer(address,uint256)'}
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
              Enter arguments as a JSON array matching the function signature
              types
            </p>
          </div>

          {/* Advanced Options - Collapsible */}
          <details className="mb-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2 hover:text-orange-600 transition">
              ⚙️ Advanced Options
            </summary>
            <div className="mt-4 space-y-4 pl-4">
              {/* Gas Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gas Limit
                </label>
                <input
                  type="number"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Fee Rate Override */}
              <div>
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
              <div>
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
            </div>
          </details>

          {/* Action Button */}
          <div className="space-y-3">
            <button
              onClick={!bitcoinAddress?.length ? connectXverse : fetchPsbt}
              disabled={
                loading ||
                !receiverAddress ||
                !sendBmcpData ||
                !!success?.length
              }
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-lg font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-3"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {unsignedPsbt && !signedPsbt
                    ? 'Signing...'
                    : signedPsbt && !success
                    ? 'Broadcasting...'
                    : 'Processing...'}
                </span>
              ) : !bitcoinAddress?.length ? (
                '🔗 Connect Xverse Wallet'
              ) : success ? (
                '✅ Transaction Sent!'
              ) : (
                '🚀 Send Bitcoin Transaction'
              )}
            </button>

            {/* Progress Indicator */}
            {bitcoinAddress && (
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-600">
                <span
                  className={
                    bitcoinAddress
                      ? 'text-green-600 font-medium'
                      : 'text-gray-400'
                  }
                >
                  ✓ Connected
                </span>
                <span className="text-gray-300">→</span>
                <span
                  className={
                    unsignedPsbt
                      ? 'text-green-600 font-medium'
                      : 'text-gray-400'
                  }
                >
                  {unsignedPsbt ? '✓' : '○'} PSBT Created
                </span>
                <span className="text-gray-300">→</span>
                <span
                  className={
                    signedPsbt ? 'text-green-600 font-medium' : 'text-gray-400'
                  }
                >
                  {signedPsbt ? '✓' : '○'} Signed
                </span>
                <span className="text-gray-300">→</span>
                <span
                  className={
                    success ? 'text-green-600 font-medium' : 'text-gray-400'
                  }
                >
                  {success ? '✓' : '○'} Broadcast
                </span>
              </div>
            )}
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <span className="text-red-600 text-xl mr-2">⚠️</span>
                <div>
                  <strong className="text-red-700">Error:</strong>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Technical Details - Collapsible */}
          {(unsignedPsbt || signedPsbt) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 transition">
                🔧 View Technical Details (PSBT Data)
              </summary>
              <div className="mt-3 space-y-3">
                {unsignedPsbt && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs font-medium text-blue-700 mb-1">
                      Unsigned PSBT
                    </div>
                    <div className="font-mono text-xs text-blue-600 break-all">
                      {unsignedPsbt}
                    </div>
                  </div>
                )}
                {signedPsbt && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-xs font-medium text-purple-700 mb-1">
                      Signed PSBT
                    </div>
                    <div className="font-mono text-xs text-purple-600 break-all">
                      {signedPsbt}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}

          {success && (
            <div className="mt-4 space-y-4">
              {/* Bitcoin Transaction Success */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <span className="text-green-600 text-2xl mr-3">✅</span>
                  <div className="flex-1">
                    <strong className="text-green-700 text-lg">
                      Bitcoin Transaction Broadcast Successfully!
                    </strong>
                    <p className="text-sm text-gray-600 mt-1">
                      Your cross-chain message has been embedded in a Bitcoin
                      transaction
                    </p>

                    {/* Transaction Links */}
                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">
                          Bitcoin Transaction:
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          <a
                            href={`https://mempool.space/testnet4/tx/${
                              JSON.parse(success).txHash
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition text-sm font-medium"
                          >
                            🟠 Mempool.space
                          </a>
                          <a
                            href={`https://explorer.titan.io/tx/${
                              JSON.parse(success).txHash
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                          >
                            🔷 Titan Explorer
                          </a>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-gray-500 break-all bg-white p-2 rounded border">
                        {JSON.parse(success).txHash}
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                        View raw response
                      </summary>
                      <pre className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border overflow-auto">
                        {JSON.stringify(JSON.parse(success), null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>

              {/* CCIP Processing Status */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <div className="mr-3 mt-1">
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <strong className="text-blue-700 text-base">
                      ⏳ Processing Cross-Chain Message
                    </strong>
                    <div className="mt-2 space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">🔄</span>
                        <span>
                          Waiting for Bitcoin confirmations (~6 blocks, ~60
                          minutes)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">🔍</span>
                        <span>BMCP Relayer will decode OP_RETURN data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">⚡</span>
                        <span>
                          CCIP Router will process the message on{' '}
                          {selectedChain.name}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-500 mb-1">
                        Expected EVM Transaction:
                      </div>
                      <div className="text-xs text-gray-600">
                        Once processed, your message will be executed on{' '}
                        <strong>{selectedChain.name}</strong>
                      </div>
                      <a
                        href="https://sepolia.etherscan.io/address/0x15fC6ae953E024d975e77382eEeC56A9101f9F88"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        View Receiver Contract on Etherscan →
                      </a>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                        📖 What happens next?
                      </summary>
                      <div className="mt-2 text-xs text-gray-600 bg-white p-3 rounded border space-y-2">
                        <p>
                          <strong>1. Bitcoin Confirmation:</strong> Your
                          transaction needs 6 block confirmations on Bitcoin
                          Testnet4
                        </p>
                        <p>
                          <strong>2. Relayer Detection:</strong> The BMCP
                          Relayer monitors Bitcoin blocks and detects your
                          OP_RETURN data
                        </p>
                        <p>
                          <strong>3. Message Decoding:</strong> The relayer
                          decodes your BMCP message (chain selector, contract,
                          function call)
                        </p>
                        <p>
                          <strong>4. CCIP Processing:</strong> The message is
                          sent to the CCIP router on the destination chain
                        </p>
                        <p>
                          <strong>5. Execution:</strong> Your function call is
                          executed on the receiver contract at{' '}
                          <code className="text-purple-600">
                            {receiverAddress}
                          </code>
                        </p>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BMCP Message Preview */}
        {encodedPreview && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                ✅ Message Encoded
              </h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {encodedPreview.messageSize} bytes
              </span>
            </div>

            {/* BMCP Data - Main Output */}
            <div className="mb-6">
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-orange-700">
                    BMCP DATA (HEX)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(encodedPreview.bmcpData);
                      alert('Copied to clipboard!');
                    }}
                    className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 transition"
                  >
                    📋 Copy
                  </button>
                </div>
                <div className="font-mono text-xs break-all text-gray-700">
                  {encodedPreview.bmcpData}
                </div>
              </div>
            </div>

            {/* Decoded Message Details - Collapsible */}
            {encodedPreview.decodedMessage && (
              <details className="border-t pt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-orange-600 transition mb-3">
                  🔍 View Decoded Details
                </summary>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Protocol
                      </div>
                      <div className="font-mono text-sm text-gray-800">
                        {encodedPreview.decodedMessage.protocol} (v
                        {encodedPreview.decodedMessage.version})
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Chain Selector
                      </div>
                      <div className="font-mono text-sm text-gray-800">
                        0x
                        {encodedPreview.decodedMessage.chainSelector.toString(
                          16
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Contract Address
                      </div>
                      <div className="font-mono text-xs text-gray-800 break-all">
                        {encodedPreview.decodedMessage.contract}
                      </div>
                    </div>

                    {encodedPreview.decodedMessage.nonce !== undefined && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          Nonce
                        </div>
                        <div className="font-mono text-sm text-gray-800">
                          {encodedPreview.decodedMessage.nonce}
                        </div>
                      </div>
                    )}

                    {encodedPreview.decodedMessage.deadline && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          Deadline
                        </div>
                        <div className="font-mono text-xs text-gray-800">
                          {new Date(
                            encodedPreview.decodedMessage.deadline * 1000
                          ).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Function Call Data
                    </div>
                    <div className="font-mono text-xs text-gray-800 break-all">
                      {encodedPreview.decodedMessage.data}
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
