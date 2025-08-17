# AA Wallet Test Suite

This test directory demonstrates how to construct Account Abstraction (AA) wallets using private keys with the signatory pattern, **using exactly the same approach as your current MyOrgWallet solution**.

## Overview

The test suite replicates the exact patterns and functions from your `walletConnectContext.tsx` file, showing how to:
- Create signatories from private keys (same as your `burnerSignatoryFactory`)
- Use `toMetaMaskSmartAccount` with `Implementation.Hybrid` (same as your context)
- Implement the `findValidIndivAccount` and `findValidOrgAccount` functions (exact copies)
- Handle smart account creation, address generation, and basic functionality

## Files

### `aa-wallet-simple-test.ts` ⭐ **MAIN TEST FILE**
**Core test** that demonstrates your AA wallet creation:
- ✅ Smart account creation using your exact functions
- ✅ Address generation and verification
- ✅ Basic functionality testing
- ✅ Fast and reliable for testing

### `ens-registration-test.ts` 🌐 **ENS REGISTRATION TEST**
**ENS domain registration** using your AA wallet:
- ✅ Registers ENS domain specified in environment (default: trust100.eth)
- ✅ Uses your exact signatory and smart account patterns
- ✅ Follows the same logic as your EnsService.createEnsDomainName
- ✅ Complete registration flow: commitment → wait → register → verify

### `ens-reverse-lookup-test.ts` 🔍 **ENS REVERSE LOOKUP TEST**
**ENS reverse lookup** functionality using your AA wallet:
- ✅ Tests reverse lookup for an address (address → ENS name)
- ✅ Sets up reverse lookup if none exists
- ✅ Uses your exact signatory and smart account patterns
- ✅ Verifies the reverse lookup was set correctly

### `ens-nft-wrapper-test.ts` 🎨 **ENS NFT WRAPPER TEST**
**ENS NFT wrapper** functionality using your AA wallet:
- ✅ Checks if ENS domain is already wrapped
- ✅ Wraps ENS domains into ERC-1155 NFTs using NameWrapper
- ✅ Uses your exact signatory and smart account patterns
- ✅ Supports both .eth domains and subdomains
- ✅ Verifies wrapping was successful

### `config.ts`
**Configuration utility** that manages environment variables:
- ✅ Environment loading from `.env` files
- ✅ Configuration validation
- ✅ Fallback values and scenarios
- ✅ Security features (data masking)

### `env.example`
**Environment template** showing all available configuration options

### `package.json`
**Dependencies** matching your main project versions

## Key Concepts

### 1. **Signatory Pattern** (Same as Your Solution)
```typescript
type Signatory = {
  account: PrivateKeyAccount;
  signer?: any;
};

// Same pattern as your burnerSignatoryFactory
function createSignatoryFromPrivateKey(privateKey: `0x${string}`): Signatory {
  const account = privateKeyToAccount(privateKey);
  return { account, signer: undefined };
}
```

### 2. **Smart Account Creation** (Exact Copy of Your Functions)
```typescript
// EXACT copy of your findValidIndivAccount function
async function findValidIndivAccount(
  owner: any, 
  signatory: any, 
  publicClient: any
): Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> {
  const startSeed = 100;
  const tryCount = 30;

  for (let i = 0; i < tryCount; i++) {
    try {
      const accountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        signatory: signatory,
        deploySalt: toHex(startSeed + i),
      });
      
      const address = await accountClient.getAddress();
      return accountClient;
    } catch (error) {
      console.error(`Error creating smart account attempt ${i + 1}:`, error);
    }
  }
  return undefined;
}
```

### 3. **Same Dependencies** (As Your Project)
- `@metamask/delegation-toolkit@^0.11.0` (same version you use)
- `viem@^2.31.4` (same version you use)
- `permissionless@^0.2.42` (same version you use)

## Environment Configuration

The test suite uses environment variables for configuration. Create a `.env` file in the test directory:

```bash
# Copy the example file
cp env.example .env

# Edit with your actual values
nano .env
```

### Required Environment Variables

```bash
# Chain Configuration
CHAIN_ID=11155111
CHAIN_NAME=sepolia

# RPC Configuration
RPC_URL=https://your-rpc-endpoint.com
BUNDLER_URL=https://your-bundler-endpoint.com

# Test Private Key (NEVER USE IN PRODUCTION)
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234

# Optional: Gas Configuration
GAS_LIMIT=500000
MAX_PRIORITY_FEE=1500000000
MAX_FEE_PER_GAS=20000000000

# Optional: Test Configuration
TEST_TIMEOUT=30000
MAX_RETRIES=3

# ENS Configuration
ENS_NAME=trust100
ENS_DURATION=31536000
```

### Configuration Validation

The test suite automatically validates your configuration and provides helpful error messages if anything is missing or invalid.

### Configuration Utility

The `config.ts` file provides:

- **Environment Loading**: Automatically loads from `.env` files
- **Validation**: Checks required variables and formats
- **Fallbacks**: Sensible defaults for optional values
- **Scenarios**: Pre-configured settings for different test types
- **Security**: Masks sensitive data in logs

```typescript
import { TEST_CONFIG, validateConfig, printConfig } from './config';

// Validate before running tests
validateConfig();

// Print current configuration (safe)
printConfig();

// Use configuration values
const { chain, rpcUrl, privateKey } = TEST_CONFIG;
```

## Usage

### Quick Test (Recommended)
```bash
cd test
npm install
npx tsx aa-wallet-simple-test.ts
```

### ENS Registration Test
```bash
cd test
npm install
npm run ens:register
```

**Note**: ENS registration requires:
- Sufficient ETH balance in your AA wallet
- Domain availability (check first)
- 90-second wait between commitment and registration

## What This Demonstrates

✅ **Your exact signatory pattern** from `burnerSignatoryFactory`  
✅ **Your exact smart account creation** using `toMetaMaskSmartAccount`  
✅ **Your exact implementation** with `Implementation.Hybrid`  
✅ **Your exact deployment parameters** `[owner, [], [], []]`  
✅ **Your exact salt generation** with `startSeed` values  
✅ **Your exact error handling** and retry logic  
✅ **Your exact client setup** with `createPublicClient`  

## Integration with Your Existing Code

This test suite is designed to work seamlessly with your existing codebase:

1. **Same imports**: Uses the exact same imports from `@metamask/delegation-toolkit`
2. **Same functions**: Replicates your `findValidIndivAccount` and `findValidOrgAccount` functions
3. **Same patterns**: Follows your signatory factory pattern
4. **Same configuration**: Uses your chain and RPC configurations
5. **Same types**: Uses your exact type definitions

## Benefits

- **No external dependencies**: Uses exactly what you already have
- **Proven approach**: Tests your actual implementation patterns
- **Easy integration**: Can be imported into your existing tests
- **Real-world usage**: Demonstrates actual smart account creation
- **Debugging support**: Helps identify issues in your current implementation

## Troubleshooting

### Import Issues
If you get import errors:
- Ensure you're using the same package versions as your main project
- Check that `@metamask/delegation-toolkit@^0.11.0` is installed

### Configuration Issues
- Update the RPC and bundler URLs in the test files to match your environment
- Ensure the test private key is valid (never use in production)

## Security Notes

⚠️ **IMPORTANT**: The test files use a hardcoded private key for demonstration purposes.  
🚫 **NEVER** use this private key in production or commit it to version control.  
✅ **ALWAYS** use environment variables or secure key management in production.

## Next Steps

1. **Run the test** to verify your approach works: `npx tsx aa-wallet-simple-test.ts`
2. **Customize the configuration** with your actual RPC URLs and test private keys
3. **Integrate the test functions** into your existing test suite
4. **Extend the tests** to cover your specific use cases

This test suite proves that your current AA wallet implementation is working correctly and provides a solid foundation for testing and extending your smart account functionality.
