import { sepolia, optimism, linea } from 'viem/chains';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Configuration utility for AA Wallet tests
 * Loads settings from environment variables with sensible defaults
 */
export const TEST_CONFIG = {
  // Chain Configuration
  chain: getChainFromEnv(),
  chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  chainName: process.env.CHAIN_NAME || 'sepolia',

  // RPC Configuration
  rpcUrl: process.env.RPC_URL || 'https://rpc.sepolia.org',
  bundlerUrl: process.env.BUNDLER_URL || 'https://bundler.sepolia.ethpandaops.io',

  // Test Private Key (WARNING: Never use in production)
  privateKey: process.env.PRIVATE_KEY as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,

  // Gas Configuration
  gasLimit: parseInt(process.env.GAS_LIMIT || '500000'),
  maxPriorityFee: parseInt(process.env.MAX_PRIORITY_FEE || '1500000000'),
  maxFeePerGas: parseInt(process.env.MAX_FEE_PER_GAS || '20000000000'),

  // Test Configuration
  testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),

  // ENS Configuration
  ensName: process.env.ENS_NAME || 'trust100',
  subdomainName: process.env.ENS_SUBDOMAIN_NAME || 'subdomain',
  ensDuration: parseInt(process.env.ENS_DURATION || '31536000'), // 1 year in seconds
};

/**
 * Get chain object based on environment configuration
 */
function getChainFromEnv(): typeof sepolia | typeof optimism | typeof linea {
  const chainName = process.env.CHAIN_NAME?.toLowerCase() || 'sepolia';
  
  switch (chainName) {
    case 'optimism':
      return optimism;
    case 'linea':
      return linea;
    case 'sepolia':
    default:
      return sepolia;
  }
}

/**
 * Validate configuration and provide helpful error messages
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required environment variables
  if (!process.env.PRIVATE_KEY) {
    errors.push('PRIVATE_KEY environment variable is required');
  }

  if (!process.env.RPC_URL) {
    errors.push('RPC_URL environment variable is required');
  }

  if (!process.env.BUNDLER_URL) {
    errors.push('BUNDLER_URL environment variable is required');
  }

  // Validate private key format
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey && (!privateKey.startsWith('0x') || privateKey.length !== 66)) {
    errors.push('PRIVATE_KEY must be a valid 0x-prefixed 64-character hex string');
  }

  // Validate chain ID
  const chainId = parseInt(process.env.CHAIN_ID || '11155111');
  if (isNaN(chainId) || chainId <= 0) {
    errors.push('CHAIN_ID must be a valid positive integer');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nPlease check your .env file and ensure all required values are set.');
    process.exit(1);
  }
}

/**
 * Print current configuration (without sensitive data)
 */
export function printConfig(): void {
  console.log('🔧 Test Configuration:');
  console.log(`   Chain: ${TEST_CONFIG.chainName} (ID: ${TEST_CONFIG.chainId})`);
  console.log(`   RPC URL: ${TEST_CONFIG.rpcUrl}`);
  console.log(`   Bundler URL: ${TEST_CONFIG.bundlerUrl}`);
  console.log(`   Gas Limit: ${TEST_CONFIG.gasLimit}`);
  console.log(`   Max Priority Fee: ${TEST_CONFIG.maxPriorityFee} wei`);
  console.log(`   Max Fee Per Gas: ${TEST_CONFIG.maxFeePerGas} wei`);
  console.log(`   Test Timeout: ${TEST_CONFIG.testTimeout}ms`);
  console.log(`   Max Retries: ${TEST_CONFIG.maxRetries}`);
  console.log(`   Private Key: ${TEST_CONFIG.privateKey.substring(0, 10)}...${TEST_CONFIG.privateKey.substring(58)}`);
}

/**
 * Get configuration for specific test scenarios
 */
export const TEST_SCENARIOS = {
  // Fast test configuration (minimal RPC calls)
  fast: {
    ...TEST_CONFIG,
    testTimeout: 10000,
    maxRetries: 1,
  },

  // Comprehensive test configuration (full functionality)
  comprehensive: {
    ...TEST_CONFIG,
    testTimeout: 60000,
    maxRetries: 5,
  },

  // Development configuration (with debugging)
  development: {
    ...TEST_CONFIG,
    testTimeout: 120000,
    maxRetries: 10,
  },
};

// Export individual config values for convenience
export const {
  chain,
  chainId,
  chainName,
  rpcUrl,
  bundlerUrl,
  privateKey,
  gasLimit,
  maxPriorityFee,
  maxFeePerGas,
  testTimeout,
  maxRetries,
  ensName,
  ensDuration,
} = TEST_CONFIG;
