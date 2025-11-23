# BMCP Project Organization

## Overview

This document describes the organization and structure of the BMCP (Bitcoin Multichain Protocol) monorepo.

## Directory Structure

```
BMCP/
├── docs/                           # 📚 Documentation
│   ├── CCIP_CRE_FLOW.md           # Cross-chain flow with mermaid diagrams
│   ├── PROTOCOL.md                 # Protocol specification v2.0
│   ├── ARCHITECTURE.md             # System architecture
│   ├── BITCOIN_API_DECODER_FLOW.md # Bitcoin API integration
│   ├── BITCOIN_SCANNER.md          # Scanner implementation
│   ├── PROTOCOL_MAGIC.md           # Protocol identifiers
│   ├── QUICKSTART.md               # Quick start guide
│   └── PROJECT_ORGANIZATION.md     # This file
│
├── packages/                       # 📦 Core Packages
│   ├── sdk/                        # Protocol encoding/decoding
│   │   ├── bitcoin/                # Bitcoin-specific encoding
│   │   ├── evm/                    # EVM-specific encoding
│   │   ├── encoding/               # Core message encoder
│   │   └── types/                  # TypeScript types
│   │
│   ├── bitcoin-api/                # Bitcoin RPC integration
│   │   └── src/index.ts            # RPC client implementation
│   │
│   ├── relayer-api/                # HTTP API for relayer
│   │   └── src/index.ts            # Express API server
│   │
│   ├── relayer/                    # CRE Relayer implementation
│   │   ├── src/                    # Scanner and filter logic
│   │   └── my-workflow/            # Workflow automation
│   │
│   ├── contracts/                  # CCIP Receiver contracts
│   │   ├── src/                    # Solidity contracts
│   │   │   ├── BMCPCREReceiver.sol # Main CCIP receiver
│   │   │   ├── interfaces/         # Contract interfaces
│   │   │   └── examples/           # Example contracts
│   │   ├── test/                   # Foundry tests
│   │   └── ignition/               # Hardhat Ignition modules
│   │
│   ├── zkevm-schnorr-contracts/    # Citrea contracts
│   │   ├── src/                    # Schnorr verification
│   │   │   ├── BMCPMessageReceiver.sol
│   │   │   ├── ExampleTargetContract.sol
│   │   │   └── SchnorrVerifyCaller.sol
│   │   ├── script/                 # Deployment scripts
│   │   ├── test/                   # Contract tests
│   │   ├── docs/                   # Contract documentation
│   │   │   ├── DEPLOYMENT_SUMMARY.md
│   │   │   └── screenshots/        # Deployment screenshots
│   │   └── deployments/            # Deployment records
│   │       └── citrea-testnet.json
│   │
│   ├── dashboard/                  # Web dashboard
│   │   ├── src/                    # React application
│   │   │   ├── BMCPDashboard.tsx   # Main dashboard
│   │   │   └── main.tsx            # Entry point
│   │   └── dist/                   # Built dashboard
│   │
│   └── client/                     # Client library (coming soon)
│
├── examples/                       # 💡 Usage Examples
│   ├── bitcoin-api-decoder-flow.ts # Complete flow example
│   ├── bitcoin-encoder-usage.ts    # Encoding examples
│   ├── evm-encoder-usage.ts        # EVM encoding
│   ├── batch-operations.ts         # Batch operations
│   ├── simple-usage.ts             # Simple example
│   └── [... more examples ...]
│
├── tests/                          # 🧪 Tests
│   ├── integration/                # Integration test suites
│   │   ├── bitcoin-encoder.test.ts
│   │   ├── evm-encoder.test.ts
│   │   └── full-flow.test.ts
│   ├── EVMCommandEncoder.test.ts   # Unit tests
│   ├── MessageEncoder.test.ts      # Unit tests
│   └── utils/                      # 🛠️ Test Utilities
│       ├── create-new-bmcp-message.ts
│       ├── test-dashboard-encoding.html
│       ├── test-relayer-api.sh
│       ├── verify-security.sh
│       └── README.md
│
├── dist/                           # Built dashboard assets
├── node_modules/                   # Dependencies
├── package.json                    # Root package config
├── tsconfig.json                   # TypeScript config
├── jest.config.js                  # Jest config
├── vercel.json                     # Vercel deployment
├── LICENSE                         # MIT License
└── README.md                       # Main README
```

## Recent Organizational Changes

### Root Directory Cleanup (November 23, 2025)

**Moved to `tests/utils/`:**
- `create-new-bmcp-message.ts` → `tests/utils/create-new-bmcp-message.ts`
- `test-dashboard-encoding.html` → `tests/utils/test-dashboard-encoding.html`
- `test-relayer-api.sh` → `tests/utils/test-relayer-api.sh`
- `verify-security.sh` → `tests/utils/verify-security.sh`

**Rationale**: Keep root directory clean and organized by grouping test utilities together.

### New Documentation

**Added:**
- `docs/CCIP_CRE_FLOW.md` - Comprehensive cross-chain flow documentation with:
  - Mermaid sequence diagrams
  - Protocol encoding details
  - Bitcoin transaction examples
  - Deployed contract links
  - Chain selector mappings
  - Integration examples

- `docs/PROJECT_ORGANIZATION.md` - This file

- `tests/utils/README.md` - Documentation for test utilities

- `packages/zkevm-schnorr-contracts/DEPLOYMENT.md` - Citrea deployment details

- `packages/zkevm-schnorr-contracts/docs/DEPLOYMENT_SUMMARY.md` - Visual summary

## Package Responsibilities

### Core Packages

| Package | Purpose | Technology | Status |
|---------|---------|------------|--------|
| **sdk** | Protocol encoding/decoding | TypeScript | ✅ Active |
| **bitcoin-api** | Bitcoin RPC integration | TypeScript, Express | ✅ Active |
| **relayer-api** | Relayer HTTP API | TypeScript, Express | ✅ Active |
| **relayer** | CRE Relayer | TypeScript | ✅ Active |
| **contracts** | CCIP receivers | Solidity, Hardhat | 🚧 In Progress |
| **zkevm-schnorr-contracts** | Schnorr verification | Solidity, Foundry | ✅ Deployed |
| **dashboard** | Web UI | React, Vite | ✅ Active |
| **client** | Client library | TypeScript | 📅 Planned |

### Documentation Files

| File | Purpose |
|------|---------|
| **CCIP_CRE_FLOW.md** | Cross-chain message flow with diagrams |
| **PROTOCOL.md** | Complete protocol specification |
| **ARCHITECTURE.md** | System architecture overview |
| **BITCOIN_API_DECODER_FLOW.md** | Bitcoin API integration details |
| **BITCOIN_SCANNER.md** | Block scanner implementation |
| **PROTOCOL_MAGIC.md** | Protocol identifier constants |
| **QUICKSTART.md** | Getting started guide |
| **PROJECT_ORGANIZATION.md** | This file - project structure |

## Development Workflow

### 1. Adding New Features

```bash
# 1. Choose appropriate package
cd packages/<package-name>

# 2. Implement feature
# 3. Add tests
# 4. Update package README
# 5. Update main README if needed
# 6. Create example in examples/
```

### 2. Adding Documentation

```bash
# Place in docs/ directory
touch docs/NEW_FEATURE.md

# Update README.md with link
# Add to this file if structural change
```

### 3. Adding Test Utilities

```bash
# Place in tests/utils/
touch tests/utils/new-utility.sh
chmod +x tests/utils/new-utility.sh

# Document in tests/utils/README.md
```

### 4. Adding Examples

```bash
# Place in examples/
touch examples/new-example.ts

# Add description to main README
```

## Deployment Documentation

### Citrea Testnet

**Contracts**:
- BMCPMessageReceiver: `0xDeD3f4058Ccdf3C05Bc7f7c38cb07E66A6023893`
- ExampleTargetContract: `0x2314dfD079C2b2cf2C3247fCd552d9d52Ac486De`
- SchnorrVerifyCaller: `0x54AAc9DE386C8185Fe8842456E55d7bF17b1f8aB`

**Documentation**:
- Deployment details: `packages/zkevm-schnorr-contracts/DEPLOYMENT.md`
- Visual summary: `packages/zkevm-schnorr-contracts/docs/DEPLOYMENT_SUMMARY.md`
- Contract README: `packages/zkevm-schnorr-contracts/README.md`

### Base Sepolia

**Status**: 🚧 Deployment pending

**Documentation**: Will be in `packages/contracts/deployments/`

## Protocol Encoding

### BMCP Protocol Identifier

```
Protocol ID: 0x4243 ("BC")
Version: 0x02 (v2.0)
```

### Message Structure

```
Offset | Size | Field
-------|------|-------
0x00   | 2    | Protocol ID: 0x4243
0x02   | 1    | Version: 0x02
0x03   | 8    | Chain Selector (uint64)
0x0B   | 20   | Receiver Address
0x1F   | 4    | Data Length
0x23   | N    | Data (ABI-encoded)
N+0x23 | 8    | Gas Limit
N+0x2B | 4    | Extra Args Length
N+0x2F | M    | Extra Args
```

## Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches
- `docs/*` - Documentation updates

### Commit Convention

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
test: Add tests
refactor: Refactor code
chore: Update dependencies
```

## Testing Strategy

### Unit Tests

```bash
npm test
```

**Location**: `tests/*.test.ts`

### Integration Tests

```bash
npm run test:integration
```

**Location**: `tests/integration/*.test.ts`

### Contract Tests

```bash
# CCIP contracts
cd packages/contracts && npm test

# Schnorr contracts
cd packages/zkevm-schnorr-contracts && forge test
```

### Utility Scripts

```bash
# Test relayer API
./tests/utils/test-relayer-api.sh

# Verify deployments
./tests/utils/verify-security.sh
```

## CI/CD

### GitHub Actions

- Run on push to `main` and `develop`
- Run tests for all packages
- Build and verify deployments
- Generate documentation

### Vercel Deployment

- Dashboard auto-deploys from `main`
- Preview deployments for PRs
- Configuration: `vercel.json`

## Contributing Guidelines

### Adding New Packages

1. Create in `packages/` directory
2. Add `package.json` with proper workspace references
3. Update root `package.json` workspaces
4. Add README.md
5. Add tests
6. Update this documentation

### File Naming Conventions

- **TypeScript**: `kebab-case.ts`
- **React Components**: `PascalCase.tsx`
- **Solidity**: `PascalCase.sol`
- **Tests**: `*.test.ts` or `*.t.sol`
- **Scripts**: `kebab-case.sh`
- **Documentation**: `SCREAMING_SNAKE_CASE.md` or `kebab-case.md`

### Documentation Standards

- Use Markdown for all documentation
- Include code examples
- Add mermaid diagrams where helpful
- Keep examples up to date
- Document deployment addresses
- Include transaction links

## External References

### Deployed Contracts

**Citrea Testnet**:
- Explorer: https://explorer.testnet.citrea.xyz
- RPC: https://rpc.testnet.citrea.xyz
- Chain ID: 5115

**Base Sepolia**:
- Explorer: https://sepolia.basescan.org
- RPC: https://sepolia.base.org
- Chain ID: 84532

### Protocol Documentation

- Bitcoin Core: https://bitcoincore.org/en/doc/
- Chainlink CCIP: https://docs.chain.link/ccip
- Citrea: https://docs.citrea.xyz
- Foundry: https://book.getfoundry.sh/

## Maintenance

### Regular Tasks

- [ ] Update dependencies monthly
- [ ] Review and update documentation
- [ ] Clean up old deployments
- [ ] Archive unused branches
- [ ] Update deployed contract addresses
- [ ] Verify all links work
- [ ] Update screenshots

### Version Management

```bash
# Update package versions
npm version <major|minor|patch>

# Publish packages (if needed)
npm publish --workspace=packages/sdk
```

---

**Last Updated**: November 23, 2025  
**Version**: 2.0  
**Maintainer**: BMCP Team

