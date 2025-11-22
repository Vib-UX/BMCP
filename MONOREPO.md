# BMCP Monorepo Guide

This document explains the monorepo structure and how to work with it.

## Structure

```
BMCP/
├── packages/
│   ├── sdk/          # @bmcp/sdk - Core SDK
│   ├── client/       # @bmcp/client - Bitcoin CCIP Client
│   ├── relayer/      # @bmcp/relayer - CRE Relayer
│   └── contracts/    # @bmcp/contracts - Solidity Contracts
├── examples/         # Usage examples
├── docs/            # Documentation
└── tests/           # Integration tests
```

## Packages

### @bmcp/sdk

**Purpose**: Core types, utilities, and message encoding/decoding

**Contains**:
- TypeScript type definitions
- Protocol constants and chain selectors
- Message encoder for Bitcoin OP_RETURN
- Shared utilities

**Usage**:
```typescript
import { MessageEncoder, CHAIN_SELECTORS, PROTOCOL_CONSTANTS } from '@bmcp/sdk';
```

### @bmcp/client

**Purpose**: Bitcoin CCIP Client for sending cross-chain messages

**Contains**:
- BitcoinCCIPClient class
- Bitcoin RPC integration
- Message construction and broadcasting

**Dependencies**: `@bmcp/sdk`

**Usage**:
```typescript
import { BitcoinCCIPClient } from '@bmcp/client';
```

### @bmcp/relayer

**Purpose**: CRE Relayer for monitoring Bitcoin and forwarding to CCIP

**Contains**:
- Block monitoring and scanning
- Message extraction from OP_RETURN
- CCIP forwarding logic

**Dependencies**: `@bmcp/sdk`

**Usage**:
```typescript
import { CRERelayer } from '@bmcp/relayer';
```

**CLI**:
```bash
npx @bmcp/relayer
```

### @bmcp/contracts

**Purpose**: Solidity smart contracts for EVM chains

**Contains**:
- BitcoinCCIPReceiver base contract
- Example receiver implementations
- Deployment scripts

**Usage**:
```solidity
import "@bmcp/contracts/contracts/BitcoinCCIPReceiver.sol";
```

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourorg/BMCP.git
cd BMCP

# Install all dependencies (npm workspaces handles linking)
npm install
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @bmcp/sdk
npm run build -w @bmcp/client
npm run build -w @bmcp/relayer
```

### Testing

```bash
# Test all packages
npm test

# Test specific package
npm test -w @bmcp/client

# Test contracts
npm run test -w @bmcp/contracts
```

### Running Examples

```bash
# Run simple example
npx ts-node examples/simple-usage.ts

# Run batch operations example
npx ts-node examples/batch-operations.ts
```

### Starting the Relayer

```bash
# Method 1: Via workspace
npm run start:relayer

# Method 2: Directly
npm run start -w @bmcp/relayer

# Method 3: Development mode
npm run dev -w @bmcp/relayer
```

### Contract Development

```bash
# Compile contracts
npm run compile:contracts

# Run contract tests
npm run test -w @bmcp/contracts

# Deploy contracts
npm run deploy:sepolia
npm run deploy:base
```

## Adding Dependencies

### To a specific package

```bash
# Add to client package
npm install axios -w @bmcp/client

# Add dev dependency
npm install -D @types/node -w @bmcp/client
```

### To root (shared dev tools)

```bash
npm install -D prettier --save-dev
```

## Inter-package Dependencies

Packages can depend on each other using workspace protocol:

```json
{
  "dependencies": {
    "@bmcp/sdk": "^1.0.0"
  }
}
```

npm workspaces automatically links local packages during development.

## Publishing

### Publishing Individual Packages

```bash
# Build all packages first
npm run build

# Publish SDK
cd packages/sdk && npm publish --access public

# Publish client
cd packages/client && npm publish --access public

# Publish relayer
cd packages/relayer && npm publish --access public

# Publish contracts
cd packages/contracts && npm publish --access public
```

### Version Management

```bash
# Update version in specific package
cd packages/sdk
npm version patch  # or minor, major

# Update all packages (manual)
# Edit each package.json version field
```

## Benefits of Monorepo

1. **Code Sharing**: Easy to share code between packages via `@bmcp/*`
2. **Atomic Changes**: Make changes across multiple packages in one commit
3. **Unified Testing**: Run all tests from root
4. **Consistent Tooling**: Shared ESLint, Prettier, TypeScript configs
5. **Simplified CI/CD**: Build and test all packages together
6. **Better DX**: Single `npm install` for entire project
7. **Type Safety**: TypeScript works seamlessly across packages

## Common Commands

```bash
# Install dependencies
npm install

# Build everything
npm run build

# Test everything
npm test

# Lint everything
npm run lint

# Format code
npm run format

# Clean all build artifacts
npm run clean

# Run specific package script
npm run <script> -w @bmcp/<package>
```

## Package Scripts Quick Reference

### Root Level
- `npm run build` - Build all packages
- `npm test` - Test all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format all code
- `npm run compile:contracts` - Compile Solidity contracts
- `npm run start:relayer` - Start the CRE relayer

### Package Level (use `-w @bmcp/<package>`)
- `npm run build -w @bmcp/sdk` - Build SDK
- `npm run test -w @bmcp/client` - Test client
- `npm run start -w @bmcp/relayer` - Start relayer

## Troubleshooting

### "Cannot find module '@bmcp/sdk'"

```bash
# Reinstall and relink packages
npm install
```

### Build order issues

```bash
# Build in dependency order
npm run build -w @bmcp/sdk
npm run build -w @bmcp/client
npm run build -w @bmcp/relayer
```

### TypeScript errors across packages

```bash
# Rebuild SDK first (it's a dependency)
npm run build -w @bmcp/sdk
```

## CI/CD Considerations

Example GitHub Actions workflow:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm run lint
```

## Migration Notes

If migrating from the previous structure:
1. Update imports from `../src/` to `@bmcp/*`
2. Run `npm install` to link packages
3. Build packages in dependency order
4. Update any paths in scripts

## Resources

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Monorepo Best Practices](https://monorepo.tools/)

