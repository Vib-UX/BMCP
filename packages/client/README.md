# @bmcp/client

Bitcoin CCIP Client for sending cross-chain messages from Bitcoin to EVM chains.

## Installation

```bash
npm install @bmcp/client
```

## Features

- Send messages from Bitcoin to any CCIP-supported EVM chain
- 100KB OP_RETURN support
- Bitcoin RPC integration
- Automatic message encoding and validation
- Transaction receipt tracking

## Usage

```typescript
import { BitcoinCCIPClient, CHAIN_SELECTORS } from '@bmcp/client';

const client = new BitcoinCCIPClient({
  url: 'http://localhost:8332',
  user: 'bitcoin',
  password: 'password',
  network: 'testnet'
});

// Send to Base chain
const receipt = await client.sendToBase(
  '0xReceiverContract',
  messageData,
  { gasLimit: 300_000 }
);

console.log('Transaction ID:', receipt.txid);
```

## API

### `BitcoinCCIPClient`

Main class for interacting with Bitcoin and sending cross-chain messages.

#### Methods

- `sendMessage(chainSelector, receiver, data, options)` - Send to any chain
- `sendToBase(receiver, data, options)` - Convenience method for Base
- `sendToBaseSepolia(receiver, data, options)` - Convenience method for Base Sepolia
- `getMessageReceipt(txid)` - Get transaction status
- `getBlockHeight()` - Get current Bitcoin block height

## License

MIT

