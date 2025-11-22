/**
 * CRE (Chainlink Read Event) Relayer
 * Monitors Bitcoin blockchain for CCIP messages and relays to destination chains
 */

import {
  RelayerConfig,
  ParsedCCIPMessage,
  Any2EVMMessage,
  MessageReceipt,
  PROTOCOL_CONSTANTS,
  TokenAmount,
  MessageEncoder,
} from '@bmcp/sdk';
import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';

export class CRERelayer {
  private config: RelayerConfig;
  private bitcoinRPC: AxiosInstance;
  private lastProcessedBlock: number;
  private isRunning: boolean = false;
  private ccipRouters: Map<bigint, ethers.Contract> = new Map();
  private providers: Map<bigint, ethers.Provider> = new Map();

  constructor(config: RelayerConfig) {
    this.config = config;
    this.lastProcessedBlock = config.startBlock;

    // Initialize Bitcoin RPC client
    this.bitcoinRPC = axios.create({
      baseURL: config.bitcoinRPC.url,
      auth: {
        username: config.bitcoinRPC.user,
        password: config.bitcoinRPC.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Start the relayer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Relayer is already running');
    }

    console.log('🚀 Starting CRE Relayer...');
    console.log(`📊 Starting from block: ${this.lastProcessedBlock}`);
    console.log(`🔍 Protocol ID: 0x${this.config.protocolId.toString(16)}`);

    this.isRunning = true;
    await this.processBlocks();
  }

  /**
   * Stop the relayer
   */
  stop(): void {
    console.log('🛑 Stopping CRE Relayer...');
    this.isRunning = false;
  }

  /**
   * Main processing loop
   */
  private async processBlocks(): Promise<void> {
    while (this.isRunning) {
      try {
        const currentHeight = await this.getCurrentBlockHeight();
        const confirmedHeight =
          currentHeight - this.config.confirmationBlocks;

        if (this.lastProcessedBlock < confirmedHeight) {
          // Process blocks that have enough confirmations
          for (
            let height = this.lastProcessedBlock + 1;
            height <= confirmedHeight && this.isRunning;
            height++
          ) {
            await this.processBlock(height);
            this.lastProcessedBlock = height;
          }
        }

        // Wait before checking for new blocks
        await this.sleep(this.config.pollIntervalMs);
      } catch (error: any) {
        console.error('❌ Error in relayer loop:', error.message);
        await this.sleep(10000); // Wait 10s on error
      }
    }
  }

  /**
   * Process a single Bitcoin block
   */
  private async processBlock(height: number): Promise<void> {
    console.log(`⛏️  Processing block ${height}...`);

    try {
      const block = await this.getBlock(height);
      const messages = this.scanBlockForMessages(block);

      if (messages.length > 0) {
        console.log(
          `📨 Found ${messages.length} CCIP message(s) in block ${height}`
        );

        for (const message of messages) {
          await this.relayMessage(message);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing block ${height}:`, error.message);
    }
  }

  /**
   * Scan block for CCIP messages
   */
  private scanBlockForMessages(block: any): ParsedCCIPMessage[] {
    const messages: ParsedCCIPMessage[] = [];

    for (const tx of block.tx) {
      try {
        // Check each output for OP_RETURN with our protocol ID
        for (const vout of tx.vout) {
          if (vout.scriptPubKey.type === 'nulldata') {
            const opReturnData = MessageEncoder.parseOPReturnScript(
              vout.scriptPubKey.hex
            );

            if (opReturnData && opReturnData.length >= 2) {
              // Check protocol ID
              const protocolId = opReturnData.readUInt16BE(0);

              if (protocolId === this.config.protocolId) {
                // Decode the message
                const ccipMessage = MessageEncoder.decode(opReturnData);

                // Extract sender address (from first input)
                const sender =
                  tx.vin[0]?.prevout?.scriptPubKey?.address || 'unknown';

                messages.push({
                  txid: tx.txid,
                  blockHeight: block.height,
                  blockHash: block.hash,
                  message: ccipMessage,
                  sender,
                  timestamp: block.time,
                  confirmations: this.config.confirmationBlocks,
                });

                console.log(`✅ Decoded CCIP message from tx ${tx.txid}`);
              }
            }
          }
        }
      } catch (error: any) {
        console.error(
          `⚠️  Error parsing tx ${tx.txid}:`,
          error.message
        );
      }
    }

    return messages;
  }

  /**
   * Relay message to destination chain via CCIP
   */
  private async relayMessage(parsed: ParsedCCIPMessage): Promise<void> {
    try {
      console.log(
        `🌉 Relaying message ${parsed.txid} to chain ${parsed.message.chainSelector}...`
      );

      // Construct Any2EVMMessage
      const any2EvmMessage: Any2EVMMessage = {
        messageId: parsed.txid,
        sourceChainSelector: PROTOCOL_CONSTANTS.BITCOIN_SELECTOR,
        sender: this.encodeBitcoinAddress(parsed.sender),
        data: parsed.message.data,
        destTokenAmounts: [], // No token transfers in basic implementation
      };

      // Get provider and router for destination chain
      const provider = this.getProvider(parsed.message.chainSelector);
      const router = this.getCCIPRouter(parsed.message.chainSelector, provider);

      // In a real implementation, this would call the CCIP router contract
      // For now, we log the relay action
      console.log(`📤 Message relayed:`, {
        txid: parsed.txid,
        destination: parsed.message.chainSelector.toString(),
        receiver: parsed.message.receiver,
        dataSize: parsed.message.data.length,
      });

      // TODO: Implement actual CCIP router call
      // const tx = await router.ccipSend(
      //   parsed.message.chainSelector,
      //   any2EvmMessage,
      //   { gasLimit: parsed.message.gasLimit }
      // );
      // await tx.wait();
    } catch (error: any) {
      console.error(
        `❌ Failed to relay message ${parsed.txid}:`,
        error.message
      );
    }
  }

  /**
   * Encode Bitcoin address for EVM
   */
  private encodeBitcoinAddress(address: string): string {
    // Convert Bitcoin address to bytes32 for EVM
    // In production, use proper encoding (e.g., hash of address)
    const addressBytes = Buffer.from(address, 'utf8');
    const hash = ethers.keccak256(addressBytes);
    return hash;
  }

  /**
   * Get or create provider for chain
   */
  private getProvider(chainSelector: bigint): ethers.Provider {
    if (!this.providers.has(chainSelector)) {
      // In production, this would use proper RPC URLs
      const provider = new ethers.JsonRpcProvider('http://localhost:8545');
      this.providers.set(chainSelector, provider);
    }
    return this.providers.get(chainSelector)!;
  }

  /**
   * Get or create CCIP router contract for chain
   */
  private getCCIPRouter(
    chainSelector: bigint,
    provider: ethers.Provider
  ): ethers.Contract {
    if (!this.ccipRouters.has(chainSelector)) {
      // Minimal ABI for CCIP router
      const abi = [
        'function ccipSend(uint64 destinationChainSelector, tuple(bytes32 messageId, uint64 sourceChainSelector, bytes sender, bytes data, tuple(address token, uint256 amount)[] destTokenAmounts) message) external payable returns (bytes32)',
      ];

      const router = new ethers.Contract(
        this.config.ccipConfig.routerAddress,
        abi,
        provider
      );
      this.ccipRouters.set(chainSelector, router);
    }
    return this.ccipRouters.get(chainSelector)!;
  }

  /**
   * Get current Bitcoin block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    return await this.rpcCall('getblockcount', []);
  }

  /**
   * Get Bitcoin block by height
   */
  private async getBlock(height: number): Promise<any> {
    const blockHash = await this.rpcCall('getblockhash', [height]);
    return await this.rpcCall('getblock', [blockHash, 2]); // Verbosity 2
  }

  /**
   * Make Bitcoin RPC call
   */
  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    try {
      const response = await this.bitcoinRPC.post('', {
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
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Add BITCOIN_SELECTOR to PROTOCOL_CONSTANTS
declare module '../types' {
  interface ProtocolConstantsType {
    BITCOIN_SELECTOR: bigint;
  }
}

// Augment the constant
(PROTOCOL_CONSTANTS as any).BITCOIN_SELECTOR = BigInt('0x424954434f494e');

