# Contributing to BMCP

Thank you for your interest in contributing to BMCP (Bitcoin Multichain Protocol)! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional. We welcome contributors of all skill levels and backgrounds.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourrepo/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs or screenshots

### Suggesting Features

1. Check existing feature requests
2. Create a new issue tagged `enhancement`
3. Describe the feature and its use case
4. Explain why it would be valuable

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourrepo/BMCP.git
   cd BMCP
   git remote add upstream https://github.com/yourrepo/BMCP.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow code style guidelines (see below)
   - Add tests for new features
   - Update documentation

4. **Test your changes**
   ```bash
   npm test
   npm run lint
   cd contracts && npx hardhat test
   ```

5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add support for multiple OP_RETURN outputs"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR on GitHub

## Development Setup

```bash
# Install dependencies
npm install
cd contracts && npm install && cd ..

# Build
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Follow Prettier formatting

```typescript
/**
 * Send a cross-chain message to an EVM chain
 * @param destinationChainSelector CCIP chain selector
 * @param receiver EVM contract address
 * @param data ABI-encoded message data
 * @param options Additional options
 * @returns Transaction receipt
 */
async sendMessage(
  destinationChainSelector: bigint,
  receiver: string,
  data: Uint8Array,
  options?: SendMessageOptions
): Promise<MessageReceipt> {
  // Implementation
}
```

### Solidity

- Use Solidity 0.8.24
- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Add NatSpec comments
- Use `immutable` and `constant` where possible
- Optimize for gas efficiency

```solidity
/**
 * @notice Process incoming message from Bitcoin
 * @param message The CCIP message from Bitcoin
 */
function processMessage(
    Client.Any2EVMMessage calldata message
) external virtual;
```

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `chore:` Maintenance tasks

Examples:
```
feat: add support for Arbitrum chain
fix: handle large message encoding edge case
docs: update quickstart guide
test: add tests for MessageEncoder
```

## Testing Guidelines

### Unit Tests

- Test all public APIs
- Test edge cases and error conditions
- Mock external dependencies
- Aim for >80% code coverage

```typescript
describe('MessageEncoder', () => {
  it('should encode a valid message', () => {
    const message = createValidMessage();
    const encoded = MessageEncoder.encode(message);
    expect(encoded).toBeInstanceOf(Buffer);
  });

  it('should throw on message too large', () => {
    const largeMessage = createLargeMessage();
    expect(() => MessageEncoder.encode(largeMessage)).toThrow();
  });
});
```

### Integration Tests

- Test component interactions
- Use testnet for blockchain tests
- Clean up test data

### Contract Tests

```bash
cd contracts
npx hardhat test
```

Test:
- Happy paths
- Revert conditions
- Events emission
- Gas usage

## Documentation

### Code Documentation

- Add JSDoc/NatSpec for all public APIs
- Explain complex algorithms
- Include usage examples

### User Documentation

Update relevant docs in `/docs`:
- `README.md` - Overview and quick start
- `PROTOCOL.md` - Protocol specification
- `ARCHITECTURE.md` - System architecture
- `QUICKSTART.md` - Getting started guide

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts with `main`
- [ ] PR description clearly explains changes
- [ ] Related issues are linked

## Review Process

1. Maintainers review within 48 hours
2. Address review comments
3. Maintainer approves
4. PR merged to `main`

## Security

For security vulnerabilities:
1. **DO NOT** create a public issue
2. Email security@bmcp.io with details
3. Allow time for patch before disclosure

## License

By contributing, you agree your contributions will be licensed under the MIT License.

## Questions?

- Open a discussion on GitHub
- Join our Discord
- Ask in the community forum

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to contributor calls

Thank you for making BMCP better! 🎉

