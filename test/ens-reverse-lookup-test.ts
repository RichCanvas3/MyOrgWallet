import { 
  createPublicClient, 
  http, 
  namehash,
  encodeFunctionData
} from 'viem';
import { 
  privateKeyToAccount, 
  type PrivateKeyAccount 
} from 'viem/accounts';
import { 
  toMetaMaskSmartAccount,
  Implementation,
  type ToMetaMaskSmartAccountReturnType
} from '@metamask/delegation-toolkit';
import { 
  createBundlerClient 
} from 'viem/account-abstraction';
import { 
  TEST_CONFIG, 
  validateConfig, 
  printConfig 
} from './config';

// Import your actual ABI files
import PublicResolverABI from '../src/abis/PublicResolver.json';

// ENS Contract Addresses (Sepolia)
const ENS_CONTRACTS = {
  ENSRegistry: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Will be set dynamically
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
  ReverseRegistrar: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Will be set dynamically
};

// Function to get ENS Registry address based on chain
function getEnsRegistryAddress(chainId: number): `0x${string}` {
  switch (chainId) {
    case 11155111: // Sepolia
      return '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; // Sepolia ENS Registry (same as your working test)
    case 1: // Ethereum Mainnet
      return '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; // Mainnet ENS Registry
    default:
      return '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; // Default ENS Registry
  }
}

// ENS Reverse Lookup ABI
const ENS_REVERSE_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }]
  }
] as const;

/**
 * Signatory structure that matches exactly what you use
 */
type Signatory = {
  account: PrivateKeyAccount;
  signMessage: (message: string) => Promise<`0x${string}`>;
  signTypedData: (typedData: any) => Promise<`0x${string}`>;
};

/**
 * Create a signatory from a private key
 */
function createSignatoryFromPrivateKey(privateKey: `0x${string}`): Signatory {
  const account = privateKeyToAccount(privateKey);
  
  return {
    account,
    signMessage: async (message: string) => {
      return await account.signMessage({ message });
    },
    signTypedData: async (typedData: any) => {
      return await account.signTypedData(typedData);
    }
  };
}

/**
 * Find a valid organization smart account
 */
async function findValidOrgAccount(
  owner: string,
  signatory: Signatory,
  publicClient: any
): Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | null> {
  console.log('🔍 Finding valid organization smart account...');
  
  try {
    // Try to create the smart account
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [owner, [], [], []],
      signatory: signatory,
      deploySalt: `0x${(10000).toString(16)}` as `0x${string}`, // Fixed salt for consistent Org AA account
    });

    console.log('✅ Organization smart account created successfully');
    return smartAccount;
  } catch (error) {
    console.error('❌ Failed to create organization smart account:', error);
    return null;
  }
}

/**
 * Get the ENS name for a given address (reverse lookup)
 */
async function getEnsNameForAddress(
  publicClient: any,
  address: string
): Promise<string | null> {
  try {
    // Create the reverse lookup node
    // Format: <address>.addr.reverse
    const reverseNode = `${address.slice(2).toLowerCase()}.addr.reverse`;
    const nodeHash = namehash(reverseNode);
    
    console.log(`🔍 Looking up ENS name for address: ${address}`);
    console.log(`📝 Reverse node: ${reverseNode}`);
    console.log(`🔐 Node hash: ${nodeHash}`);
    
    // First, check if there's a resolver set for this reverse node
    const resolver = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [
        {
          name: 'resolver',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'node', type: 'bytes32' }],
          outputs: [{ name: '', type: 'address' }]
        }
      ],
      functionName: 'resolver',
      args: [nodeHash]
    });
    
    if (!resolver || resolver === '0x0000000000000000000000000000000000000000') {
      console.log('❌ No resolver set for reverse lookup');
      return null;
    }
    
    console.log(`✅ Resolver found: ${resolver}`);
    
    // Now get the name from the resolver
    const ensName = await publicClient.readContract({
      address: resolver,
      abi: ENS_REVERSE_ABI,
      functionName: 'name',
      args: [nodeHash]
    });
    
    if (!ensName || ensName === '') {
      console.log('❌ No ENS name set for this address');
      return null;
    }
    
    console.log(`✅ ENS name found: ${ensName}`);
    return ensName;
  } catch (error) {
    console.error('❌ Error during reverse lookup:', error);
    return null;
  }
}

/**
 * Set ENS reverse lookup for an address
 */
async function setEnsReverseLookup(
  publicClient: any,
  bundlerClient: any,
  smartAccountClient: any,
  address: string,
  ensName: string,
  gasConfig?: any
): Promise<boolean> {
  try {
    console.log(`🔧 Setting ENS reverse lookup for ${address} to ${ensName}`);
    
    // Create the reverse lookup node
    const reverseNode = `${address.slice(2).toLowerCase()}.addr.reverse`;
    const nodeHash = namehash(reverseNode);
    
    console.log(`📝 Reverse node: ${reverseNode}`);
    console.log(`🔐 Node hash: ${nodeHash}`);
    
    // Set the name in the resolver
    const setData = {
      to: ENS_CONTRACTS.PublicResolver,
      data: encodeFunctionData({
        abi: [
          {
            name: 'setName',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'node', type: 'bytes32' },
              { name: 'name', type: 'string' }
            ],
            outputs: []
          }
        ],
        functionName: 'setName',
        args: [nodeHash, ensName]
      })
    };
    
    console.log('📤 Setting ENS name via reverse lookup...');
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccountClient,
      calls: [setData],
      ...(gasConfig || {})
    });
    
    console.log('📋 Transaction sent:', userOpHash);
    
    // Wait for confirmation
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('✅ Reverse lookup set successfully:', receipt);
    return true;
  } catch (error) {
    console.error('❌ Error setting reverse lookup:', error);
    return false;
  }
}

/**
 * Main ENS reverse lookup test function
 */
async function main() {
  try {
    console.log('🚀 Starting ENS Reverse Lookup Test with AA Wallet');
    
    // Validate configuration
    validateConfig();
    printConfig();
    
    // Step 1: Create the public client
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    console.log('✅ Public client created');

    // Set ENS Registry address based on chain
    ENS_CONTRACTS.ENSRegistry = getEnsRegistryAddress(TEST_CONFIG.chainId);
    console.log(`🔗 Using ENS Registry: ${ENS_CONTRACTS.ENSRegistry}`);

    // Step 2: Create a signatory from the private key
    const signatory = createSignatoryFromPrivateKey(TEST_CONFIG.privateKey);
    console.log('✅ Signatory created for address:', signatory.account.address);

    // Step 3: Find a valid organization smart account
    const owner = signatory.account.address;
    console.log('🔍 Finding valid organization smart account for owner:', owner);
    
    const orgAccountClient = await findValidOrgAccount(owner, signatory, publicClient);
    if (!orgAccountClient) {
      throw new Error('Failed to find valid organization smart account');
    }
    
    const orgAddress = await orgAccountClient.getAddress();
    console.log('✅ Organization smart account found at:', orgAddress);

    // Step 4: Test reverse lookup for the smart account address
    console.log(`🎯 Testing reverse lookup for AA address: ${orgAddress}`);
    
    // First, check if there's already a reverse lookup set
    let existingName = await getEnsNameForAddress(publicClient, orgAddress);
    
    if (existingName) {
      console.log(`🎉 Reverse lookup already exists: ${orgAddress} → ${existingName}`);
      return {
        success: true,
        address: orgAddress,
        ensName: existingName,
        message: 'Reverse lookup already exists'
      };
    }
    
    // Step 5: Set up reverse lookup if none exists
    console.log('🔧 No reverse lookup found, setting one up...');
    
    // Create bundler client for transactions (with paymaster - same as your main service)
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
      paymaster: true,
      chain: TEST_CONFIG.chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });
    
    // Get gas prices and configuration (same as your main service)
    const feeData = await publicClient.estimateFeesPerGas();
    console.log('Current fee data:', feeData);

    // Use dynamic gas prices with a buffer (same as your main service)
    const gasConfig = {
      maxFeePerGas: feeData.maxFeePerGas * 2n, // Double the estimated gas price to ensure acceptance
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
    };
    console.log('Using gas config:', gasConfig);
    
    // Generate a test name for this address
    const testName = `test-${Date.now()}.eth`;
    console.log(`📝 Using test name: ${testName}`);
    
    // Set the reverse lookup
    const success = await setEnsReverseLookup(
      publicClient,
      bundlerClient,
      orgAccountClient,
      orgAddress,
      testName,
      gasConfig
    );
    
    if (!success) {
      throw new Error('Failed to set reverse lookup');
    }
    
    // Step 6: Verify the reverse lookup was set
    console.log('🔍 Verifying reverse lookup was set...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain to update
    
    const verifiedName = await getEnsNameForAddress(publicClient, orgAddress);
    
    if (verifiedName === testName) {
      console.log('✅ Reverse lookup verified successfully!');
      return {
        success: true,
        address: orgAddress,
        ensName: verifiedName,
        message: 'Reverse lookup set and verified'
      };
    } else {
      throw new Error(`Reverse lookup verification failed. Expected: ${testName}, Got: ${verifiedName}`);
    }
    
  } catch (error) {
    console.error('❌ Error in ENS reverse lookup test:', error);
    throw error;
  }
}

// Export functions for use in other tests
export {
  createSignatoryFromPrivateKey,
  findValidOrgAccount,
  getEnsNameForAddress,
  setEnsReverseLookup,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('🎉 ENS Reverse Lookup Test completed successfully!');
      console.log('📊 Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ ENS Reverse Lookup Test failed:', error);
      process.exit(1);
    });
}
