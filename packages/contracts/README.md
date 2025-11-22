# @bmcp/contracts

Solidity smart contracts for receiving cross-chain messages from Bitcoin on EVM chains.

## Contracts

### BitcoinCCIPReceiver

Abstract base contract for receiving messages from Bitcoin via CCIP.

```solidity
import "@bmcp/contracts/contracts/BitcoinCCIPReceiver.sol";

contract MyReceiver is BitcoinCCIPReceiver {
    constructor(address router, uint64 bitcoinChainSelector)
        BitcoinCCIPReceiver(router, bitcoinChainSelector)
    {}

    function processMessage(Client.Any2EVMMessage calldata message)
        external override
    {
        // Your logic here
    }
}
```

### SimpleBitcoinReceiver

Example implementation demonstrating basic message handling.

### BitcoinDeFiGateway

Advanced DeFi gateway supporting:
- Bitcoin deposits
- Token swaps
- Batch operations
- Balance tracking

## Usage

### Installation

```bash
npm install @bmcp/contracts
```

### Compilation

```bash
npm run compile
```

### Testing

```bash
npm run test
```

### Deployment

```bash
# Deploy to Base Sepolia
npm run deploy:sepolia

# Deploy to Base mainnet
npm run deploy:base
```

## Contract Addresses

After deployment, addresses will be saved to `deployment.json`.

## License

MIT

