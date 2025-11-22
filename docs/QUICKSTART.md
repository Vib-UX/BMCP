# BMCP Quick Start Guide

Get started with Bitcoin to EVM cross-chain messaging in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Bitcoin node with RPC access (or testnet access)
- EVM wallet with Base testnet ETH
- Basic knowledge of Bitcoin and Ethereum

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/BMCP.git
cd BMCP

# Install dependencies
npm install

# Install contract dependencies
cd contracts && npm install && cd ..

# Copy environment template
cp .env.example .env
```

## Configuration

Edit `.env` with your settings:

```env
# Bitcoin Testnet Node
BITCOIN_RPC_URL=http://localhost:18332
BITCOIN_RPC_USER=your_user
BITCOIN_RPC_PASSWORD=your_password
BITCOIN_NETWORK=testnet

# Base Sepolia Testnet
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here

# Use testnet chain selector
BITCOIN_CHAIN_SELECTOR=0x424954434f494e
```

## Deploy Contracts (Base Sepolia)

```bash
cd contracts

# Compile contracts
npx hardhat compile

# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy.ts --network baseSepolia

# Note the deployed contract addresses!
```

## Send Your First Message

Create `my-first-message.ts`:

```typescript
import { BitcoinCCIPClient } from 'bmcp';
import { ethers } from 'ethers';

const client = new BitcoinCCIPClient({
  url: process.env.BITCOIN_RPC_URL!,
  user: process.env.BITCOIN_RPC_USER!,
  password: process.env.BITCOIN_RPC_PASSWORD!,
  network: 'testnet',
});

// Your deployed contract address
const receiverContract = '0xYourDeployedContract';

// Encode a deposit message
const recipient = '0xYourAddress';
const amount = ethers.parseEther('0.001'); // 0.001 BTC

const messageData = BitcoinCCIPClient.encodeDepositMessage(
  recipient,
  amount
);

// Send to Base Sepolia
const receipt = await client.sendToBaseSepolia(
  receiverContract,
  messageData,
  { gasLimit: 300_000 }
);

console.log('✅ Message sent!');
console.log('Transaction:', receipt.txid);
console.log('View at:', `https://blockstream.info/testnet/tx/${receipt.txid}`);
```

Run it:

```bash
npx ts-node my-first-message.ts
```

## Start the Relayer

In a separate terminal:

```bash
# Build the project
npm run build

# Start the CRE relayer
npm run start:relayer
```

The relayer will:
1. Monitor Bitcoin testnet for your message
2. Wait for 6 confirmations (~60 minutes)
3. Relay to CCIP network
4. Forward to Base Sepolia

## Monitor Your Message

### Bitcoin Side

Check your transaction on Bitcoin testnet:
```
https://blockstream.info/testnet/tx/YOUR_TXID
```

Wait for confirmations (1 block = ~10 minutes)

### Base Side

Once relayed, check Base Sepolia:
```
https://sepolia.basescan.org/address/YOUR_RECEIVER_CONTRACT
```

Look for `MessageReceivedFromBitcoin` event!

## Example: Batch Operations

```typescript
import { BitcoinCCIPClient, CHAIN_SELECTORS } from 'bmcp';
import { ethers } from 'ethers';

const client = new BitcoinCCIPClient({
  url: process.env.BITCOIN_RPC_URL!,
  user: process.env.BITCOIN_RPC_USER!,
  password: process.env.BITCOIN_RPC_PASSWORD!,
  network: 'testnet',
});

// Example: Swap + Deposit in one message
const operations = {
  targets: ['0xDEX', '0xLendingPool'],
  calls: [
    // Swap BTC to USDC
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256'],
      ['0xWBTC', '0xUSDC', ethers.parseEther('0.1')]
    ),
    // Deposit USDC
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      ['0xUSDC', ethers.parseUnits('3000', 6)]
    ),
  ],
};

const batchData = ethers.AbiCoder.defaultAbiCoder().encode(
  ['bytes4', 'address[]', 'bytes[]'],
  [
    ethers.id('batchExecute(address[],bytes[])').slice(0, 10),
    operations.targets,
    operations.calls,
  ]
);

const receipt = await client.sendToBaseSepolia(
  '0xDeFiGateway',
  batchData,
  { gasLimit: 800_000 }
);

console.log('✅ Batch operation sent!', receipt.txid);
```

## Testing Locally

### 1. Start Bitcoin Regtest

```bash
bitcoind -regtest -txindex -rpcuser=test -rpcpassword=test -rpcport=18443
```

### 2. Start Local Hardhat Node

```bash
cd contracts
npx hardhat node
```

### 3. Deploy Contracts Locally

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### 4. Run Examples

```bash
cd ..
npm run dev
```

## Troubleshooting

### "Insufficient funds"
- Fund your Bitcoin wallet: Get testnet BTC from a faucet
- Check balance: `bitcoin-cli -testnet getbalance`

### "Invalid receiver address"
- Ensure address starts with 0x
- Must be 42 characters (0x + 40 hex)
- Use checksummed address

### "Message too large"
- Check message size: `messageData.length`
- Must be < 100,000 bytes
- Consider compression or splitting

### "Relayer not detecting message"
- Check Bitcoin confirmations (need 6)
- Verify protocol ID in OP_RETURN
- Check relayer logs for errors
- Ensure relayer is running and synced

## Next Steps

1. **Read the Protocol Spec**: [docs/PROTOCOL.md](PROTOCOL.md)
2. **Study Architecture**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
3. **Run Examples**: Check `/examples` directory
4. **Build Your DApp**: Create custom receiver contracts
5. **Join Community**: Discord, Twitter, GitHub discussions

## Common Use Cases

### 1. Bitcoin → EVM Token Deposits
Deposit BTC and receive wrapped tokens on Base

### 2. Cross-Chain DeFi
Execute DeFi operations on Base, initiated from Bitcoin

### 3. DAO Governance
Bitcoin holders vote on EVM DAO proposals

### 4. NFT Minting
Mint NFTs on Base by sending Bitcoin transactions

### 5. Cross-Chain Swaps
Swap BTC for EVM tokens in one atomic operation

## Resources

- **Documentation**: [/docs](/docs)
- **Examples**: [/examples](/examples)
- **Contracts**: [/contracts](/contracts)
- **Tests**: [/tests](/tests)

## Get Help

- GitHub Issues: [github.com/yourrepo/issues](https://github.com/yourrepo/issues)
- Discord: [discord.gg/bmcp](https://discord.gg/bmcp)
- Twitter: [@yourtwitter](https://twitter.com/yourtwitter)

## Production Checklist

Before going to mainnet:

- [ ] Security audit of smart contracts
- [ ] Test on testnet for 1+ weeks
- [ ] Deploy multiple redundant relayers
- [ ] Set up monitoring and alerts
- [ ] Document incident response procedures
- [ ] Get CCIP mainnet access from Chainlink
- [ ] Fund relayer with LINK tokens
- [ ] Set appropriate confirmation requirements (6+ for mainnet)
- [ ] Implement fee estimation and management
- [ ] Set up user support channels

---

**Ready to build cross-chain Bitcoin apps? Let's go! 🚀**

