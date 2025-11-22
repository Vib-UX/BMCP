# Environment Setup

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your Tatum API key:**
   
   Open `.env` and replace `your_tatum_api_key_here` with your actual API key from [Tatum.io](https://tatum.io)

   ```env
   TATUM_API_KEY=your_actual_api_key
   TATUM_RPC_URL=https://bitcoin-testnet4.gateway.tatum.io/
   BITCOIN_NETWORK=testnet4
   ```

3. **Run examples:**
   ```bash
   npm run example:decoder-flow YOUR_TXID
   npm run example:scan-tx YOUR_TXID
   npm run example:monitor
   ```

## Getting a Tatum API Key

1. Visit [https://tatum.io](https://tatum.io)
2. Sign up for a free account
3. Navigate to your dashboard
4. Copy your API key
5. Add it to your `.env` file

## Security Notes

- ✅ `.env` is already in `.gitignore` - your API key will NOT be committed
- ✅ Always use `.env.example` as a template (never commit actual keys)
- ✅ The codebase now loads API keys from environment variables only

## Troubleshooting

If you see an error like:
```
❌ Error: TATUM_API_KEY not found in environment variables
```

Make sure:
1. You have created a `.env` file (copy from `.env.example`)
2. Your `.env` file contains `TATUM_API_KEY=your_key`
3. You're running commands from the project root directory

