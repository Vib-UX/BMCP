/**
 * BMCP - Bitcoin Multichain Protocol
 * Main entry point and exports
 */

export { BitcoinCCIPClient } from './client/BitcoinCCIPClient';
export { MessageEncoder } from './encoding/MessageEncoder';
export { CRERelayer } from './relayer/CRERelayer';

export * from './types';

export { CHAIN_SELECTORS, PROTOCOL_CONSTANTS } from './types';

