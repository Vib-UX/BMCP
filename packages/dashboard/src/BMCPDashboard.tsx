import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { MessageEncoder, PROTOCOL_CONSTANTS, CHAIN_SELECTORS } from '@bmcp/sdk';
import { XverseWindow } from './types';

// Extended chain selectors with Citrea and Polygon
const SUPPORTED_CHAINS = [
  { 
    name: 'Base', 
    selector: CHAIN_SELECTORS.BASE,
    logo: '🔵',
    network: 'mainnet'
  },
  { 
    name: 'Base Sepolia', 
    selector: CHAIN_SELECTORS.BASE_SEPOLIA,
    logo: '🔵',
    network: 'testnet'
  },
  { 
    name: 'Citrea', 
    selector: BigInt('0x434954524541'), // 'CITREA' in hex
    logo: '🟡',
    network: 'mainnet'
  },
  { 
    name: 'Polygon', 
    selector: BigInt('4051577828743386545'),
    logo: '🟣',
    network: 'mainnet'
  },
  { 
    name: 'Ethereum', 
    selector: CHAIN_SELECTORS.ETHEREUM,
    logo: '⬜',
    network: 'mainnet'
  },
  { 
    name: 'Arbitrum', 
    selector: CHAIN_SELECTORS.ARBITRUM,
    logo: '🔷',
    network: 'mainnet'
  },
];

// Common function signatures for quick selection
const COMMON_FUNCTIONS = [
  { label: 'Custom', value: '' },
  { label: 'deposit(address,uint256)', value: 'deposit(address,uint256)' },
  { label: 'transfer(address,uint256)', value: 'transfer(address,uint256)' },
  { label: 'execute(address,uint256,bytes)', value: 'execute(address,uint256,bytes)' },
  { label: 'mint(address,uint256)', value: 'mint(address,uint256)' },
  { label: 'swap(address,address,uint256)', value: 'swap(address,address,uint256)' },
];

export function BMCPDashboard() {
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [receiverAddress, setReceiverAddress] = useState('');
  const [functionSignature, setFunctionSignature] = useState('deposit(address,uint256)');
  const [args, setArgs] = useState('["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "1000000000000000000"]');
  const [gasLimit, setGasLimit] = useState('300000');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [encodedPreview, setEncodedPreview] = useState<any>(null);

  // Check if Xverse is installed
  useEffect(() => {
    const xverseWin = window as unknown as XverseWindow;
    if (xverseWin.BitcoinProvider) {
      setIsConnected(true);
    }
  }, []);

  // Connect Xverse wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError('');
      const xverseWin = window as unknown as XverseWindow;
      
      if (!xverseWin.BitcoinProvider) {
        setError('Xverse wallet not found. Please install it from xverse.app');
        return;
      }

      const response = await xverseWin.BitcoinProvider.request('getAccounts', {});
      if (response.result && response.result.length > 0) {
        setWalletAddress(response.result[0].address);
        setIsConnected(true);
        setSuccess('Wallet connected successfully!');
      }
    } catch (err: any) {
      setError(`Failed to connect wallet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
        gasLimit: Number(gasLimit),
        allowOutOfOrderExecution: false,
      });

      // Create CCIP message
      const ccipMessage = {
        protocolId: PROTOCOL_CONSTANTS.PROTOCOL_ID,
        version: PROTOCOL_CONSTANTS.VERSION_V2,
        chainSelector: selectedChain.selector,
        receiver: receiverAddress,
        data: messageData,
        gasLimit: BigInt(gasLimit),
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

  // Submit transaction via Xverse
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!isConnected) {
        throw new Error('Please connect your Xverse wallet first');
      }

      // Encode the message
      const { opReturnScript } = encodeMessage();

      const xverseWin = window as unknown as XverseWindow;
      
      // Create the transaction request
      const response = await xverseWin.BitcoinProvider!.request('sendTransfer', {
        recipients: [
          {
            address: walletAddress, // Send back to self (for OP_RETURN only tx)
            amount: 546, // Dust amount in sats
          }
        ],
        opReturn: opReturnScript,
      });

      if (response.result) {
        setSuccess(`Transaction sent! TXID: ${response.result.txid}`);
        console.log('Transaction broadcasted:', response.result.txid);
      }
    } catch (err: any) {
      setError(`Transaction failed: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
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

        {/* Wallet Connection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Xverse Wallet</h3>
              {isConnected && walletAddress && (
                <p className="text-sm text-gray-600 mt-1">
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                </p>
              )}
            </div>
            <button
              onClick={connectWallet}
              disabled={loading || isConnected}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                isConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isConnected ? '✓ Connected' : 'Connect Wallet'}
            </button>
          </div>
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
            <input
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Function Signature */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Function Signature
            </label>
            <select
              onChange={(e) => setFunctionSignature(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-2"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isConnected || !receiverAddress}
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
            ) : (
              '🚀 Sign & Send Transaction'
            )}
          </button>

          {/* Error & Success Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <strong>Success:</strong> {success}
            </div>
          )}
        </div>

        {/* Message Preview */}
        {encodedPreview && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Message Preview</h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Chain:</span>
                <div className="font-mono text-sm mt-1">{selectedChain.name}</div>
              </div>
              
              <div>
                <span className="text-sm font-medium text-gray-600">Function Selector:</span>
                <div className="font-mono text-sm mt-1 bg-gray-50 p-2 rounded break-all">
                  {encodedPreview.functionSelector}
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium text-gray-600">Message Size:</span>
                <div className="font-mono text-sm mt-1">
                  {encodedPreview.messageSize} bytes
                  {encodedPreview.messageSize > 80 && (
                    <span className="ml-2 text-green-600">✓ Fits in v30.0+</span>
                  )}
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium text-gray-600">OP_RETURN Script (first 100 chars):</span>
                <div className="font-mono text-xs mt-1 bg-gray-50 p-2 rounded break-all">
                  {encodedPreview.opReturnScript.slice(0, 100)}...
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

