/**
 * CRE Relayer Entry Point
 * Start the Bitcoin to EVM cross-chain relayer
 */

import { CRERelayer } from './CRERelayer';
import { RelayerConfig } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create relayer configuration from environment
 */
function createRelayerConfig(): RelayerConfig {
  return {
    bitcoinRPC: {
      url: process.env.BITCOIN_RPC_URL || 'http://localhost:8332',
      user: process.env.BITCOIN_RPC_USER || 'bitcoin',
      password: process.env.BITCOIN_RPC_PASSWORD || 'password',
      network:
        (process.env.BITCOIN_NETWORK as 'mainnet' | 'testnet' | 'regtest') ||
        'testnet',
    },
    ccipConfig: {
      routerAddress: process.env.CCIP_ROUTER_BASE || '',
      chainSelector: BigInt(
        process.env.BITCOIN_CHAIN_SELECTOR || '0x424954434f494e'
      ),
      gasLimit: 200_000,
    },
    startBlock: parseInt(process.env.CRE_START_BLOCK || '850000'),
    confirmationBlocks: parseInt(process.env.CRE_CONFIRMATION_BLOCKS || '6'),
    pollIntervalMs: parseInt(process.env.CRE_POLL_INTERVAL_MS || '30000'),
    protocolId: parseInt(process.env.PROTOCOL_ID || '0x4243'),
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   BMCP CRE Relayer - Bitcoin → EVM       ║');
  console.log('║   Bitcoin Multichain Protocol             ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const config = createRelayerConfig();
  const relayer = new CRERelayer(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⏸️  Received SIGINT, shutting down gracefully...');
    relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n⏸️  Received SIGTERM, shutting down gracefully...');
    relayer.stop();
    process.exit(0);
  });

  // Start the relayer
  try {
    await relayer.start();
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { CRERelayer, createRelayerConfig };

