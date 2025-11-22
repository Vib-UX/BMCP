# @bmcp/relayer

CRE (Chainlink Read Event) Relayer for monitoring Bitcoin blockchain and forwarding messages to CCIP.

## Installation

```bash
npm install @bmcp/relayer
```

## Features

- Monitor Bitcoin blockchain for BMCP messages
- Automatic block scanning with protocol ID filtering
- Message extraction from OP_RETURN outputs
- CCIP message transformation and forwarding
- Configurable confirmations and polling intervals

## Usage

### CLI

```bash
# Install globally
npm install -g @bmcp/relayer

# Run relayer
bmcp-relayer
```

### Programmatic

```typescript
import { CRERelayer } from '@bmcp/relayer';

const relayer = new CRERelayer({
  bitcoinRPC: {
    url: 'http://localhost:8332',
    user: 'bitcoin',
    password: 'password',
    network: 'testnet'
  },
  ccipConfig: {
    routerAddress: '0x...',
    chainSelector: 0x424954434f494en,
    gasLimit: 200_000
  },
  startBlock: 850000,
  confirmationBlocks: 6,
  pollIntervalMs: 30000,
  protocolId: 0x4243
});

await relayer.start();
```

## Configuration

Set environment variables or pass configuration object:

- `BITCOIN_RPC_URL` - Bitcoin node RPC URL
- `BITCOIN_RPC_USER` - RPC username
- `BITCOIN_RPC_PASSWORD` - RPC password
- `BITCOIN_NETWORK` - Network (mainnet/testnet/regtest)
- `CRE_START_BLOCK` - Starting block height
- `CRE_CONFIRMATION_BLOCKS` - Required confirmations (default: 6)
- `CRE_POLL_INTERVAL_MS` - Polling interval in milliseconds

## License

MIT

