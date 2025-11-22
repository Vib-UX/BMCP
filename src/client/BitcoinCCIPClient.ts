/**
 * Bitcoin CCIP Client
 * Main client for sending cross-chain messages from Bitcoin to EVM chains
 */

import {
  BitcoinCCIPMessage,
  BitcoinRPCConfig,
  SendMessageOptions,
  MessageReceipt,
  PROTOCOL_CONSTANTS,
  CHAIN_SELECTORS,
} from '../types';
import { MessageEncoder } from '../encoding/MessageEncoder';
import axios, { AxiosInstance } from 'axios';

export class BitcoinCCIPClient {
  private rpc: AxiosInstance;
  private config: BitcoinRPCConfig;

  constructor(config: BitcoinRPCConfig) {
    this.config = config;
    this.rpc = axios.create({
      baseURL: config.url,
      auth: {
        username: config.user,
        password: config.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send a cross-chain message to an EVM chain
   * @param destinationChainSelector CCIP chain selector (e.g., BASE_SELECTOR)
   * @param receiver EVM contract address
   * @param data ABI-encoded message data
   * @param options Additional options
   * @returns Transaction ID and message receipt
   */
  async sendMessage(
    destinationChainSelector: bigint,
    receiver: string,
    data: Uint8Array,
    options?: SendMessageOptions
  ): Promise<MessageReceipt> {
    // Validate inputs
    if (!receiver.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid receiver address format');
    }

    // Encode extra args
    const extraArgs = MessageEncoder.encodeExtraArgs({
      gasLimit: options?.gasLimit,
      allowOutOfOrderExecution: options?.allowOutOfOrderExecution,
    });

    // Create CCIP message
    const ccipMessage: BitcoinCCIPMessage = {
      protocolId: PROTOCOL_CONSTANTS.PROTOCOL_ID,
      version: PROTOCOL_CONSTANTS.VERSION_V2,
      chainSelector: destinationChainSelector,
      receiver,
      data,
      gasLimit: BigInt(options?.gasLimit || 200_000),
      extraArgs,
    };

    // Validate message
    if (!MessageEncoder.validate(ccipMessage)) {
      throw new Error('Invalid CCIP message structure');
    }

    // Encode message to bytes
    const messageBytes = MessageEncoder.encode(ccipMessage);

    // Check size limit
    if (messageBytes.length > PROTOCOL_CONSTANTS.MAX_MESSAGE_SIZE) {
      throw new Error(
        `Message exceeds maximum size: ${messageBytes.length} > ${PROTOCOL_CONSTANTS.MAX_MESSAGE_SIZE} bytes`
      );
    }

    // Create OP_RETURN script
    const opReturnScript = MessageEncoder.createOPReturnScript(messageBytes);

    // Build and broadcast transaction
    const txid = await this.broadcastMessage(opReturnScript);

    return {
      txid,
      messageId: txid,
      status: 'pending',
      confirmations: 0,
    };
  }

  /**
   * Broadcast a Bitcoin transaction with OP_RETURN
   */
  private async broadcastMessage(opReturnScript: string): Promise<string> {
    try {
      // Get a new address for change
      const changeAddress = await this.rpcCall('getnewaddress', []);

      // List unspent UTXOs
      const utxos = await this.rpcCall('listunspent', [1, 9999999]);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Select UTXO (simple: use first available)
      const selectedUtxo = utxos[0];

      // Estimate fee (assume 1 sat/vbyte, ~300 vbyte tx)
      const estimatedFee = 0.000003; // 300 sats

      const inputs = [
        {
          txid: selectedUtxo.txid,
          vout: selectedUtxo.vout,
        },
      ];

      const outputs = [
        {
          // OP_RETURN output (0 value)
          data: opReturnScript.slice(4), // Remove '6a' prefix for createrawtransaction
        },
        {
          // Change output
          [changeAddress]: selectedUtxo.amount - estimatedFee,
        },
      ];

      // Create raw transaction
      const rawTx = await this.rpcCall('createrawtransaction', [inputs, outputs]);

      // Sign transaction
      const signedTx = await this.rpcCall('signrawtransactionwithwallet', [rawTx]);

      if (!signedTx.complete) {
        throw new Error('Failed to sign transaction');
      }

      // Broadcast transaction
      const txid = await this.rpcCall('sendrawtransaction', [signedTx.hex]);

      return txid;
    } catch (error: any) {
      throw new Error(`Failed to broadcast message: ${error.message}`);
    }
  }

  /**
   * Get message receipt by transaction ID
   */
  async getMessageReceipt(txid: string): Promise<MessageReceipt> {
    try {
      const tx = await this.rpcCall('getrawtransaction', [txid, true]);

      const receipt: MessageReceipt = {
        txid,
        messageId: txid,
        status: tx.confirmations > 0 ? 'confirmed' : 'pending',
        confirmations: tx.confirmations || 0,
      };

      if (tx.blockhash) {
        const block = await this.rpcCall('getblock', [tx.blockhash]);
        receipt.blockHeight = block.height;
      }

      return receipt;
    } catch (error: any) {
      return {
        txid,
        messageId: txid,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Helper: Make RPC call to Bitcoin node
   */
  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    try {
      const response = await this.rpc.post('', {
        jsonrpc: '1.0',
        id: Date.now(),
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error.message);
      }
      throw error;
    }
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    return await this.rpcCall('getblockcount', []);
  }

  /**
   * Get block by height
   */
  async getBlock(height: number): Promise<any> {
    const blockHash = await this.rpcCall('getblockhash', [height]);
    return await this.rpcCall('getblock', [blockHash, 2]); // Verbosity 2 includes tx details
  }

  /**
   * Static helper: Create message data for simple deposit
   */
  static encodeDepositMessage(recipient: string, amount: bigint): Uint8Array {
    // This would use ethers.js AbiCoder in a real implementation
    // For now, return a simple encoding
    const selector = Buffer.from('47e7ef24', 'hex'); // deposit(address,uint256) selector
    const recipientPadded = Buffer.from(
      recipient.slice(2).padStart(64, '0'),
      'hex'
    );
    const amountPadded = Buffer.from(
      amount.toString(16).padStart(64, '0'),
      'hex'
    );

    return new Uint8Array(
      Buffer.concat([selector, recipientPadded, amountPadded])
    );
  }

  /**
   * Convenience method: Send to Base chain
   */
  async sendToBase(
    receiver: string,
    data: Uint8Array,
    options?: SendMessageOptions
  ): Promise<MessageReceipt> {
    return this.sendMessage(CHAIN_SELECTORS.BASE, receiver, data, options);
  }

  /**
   * Convenience method: Send to Base Sepolia (testnet)
   */
  async sendToBaseSepolia(
    receiver: string,
    data: Uint8Array,
    options?: SendMessageOptions
  ): Promise<MessageReceipt> {
    return this.sendMessage(
      CHAIN_SELECTORS.BASE_SEPOLIA,
      receiver,
      data,
      options
    );
  }
}

