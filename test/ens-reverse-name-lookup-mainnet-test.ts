import 'dotenv/config';
import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

// --- Environment Configuration ---
const MAINNET_CONFIG = {
  chain: mainnet,
  chainId: 1,
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  testAddresses: [
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
    '0x2A2A19D1a0ebe0D13e476511fE22b8995b0C0e16', // Your test address
    '0x34aAbdf51508E0Fa7831A5539Ee8F48E1ad015aa', // LINK token contract
    '0xA0b86a33E6441b8c4C8C3c8c3c8c3c8c3c8c3c8c', // Random address (should fail)
  ],
};

// --- Contract Addresses ---
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const REVERSE_REGISTRAR = '0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb' as const;

// --- ABIs ---
const registryAbi = parseAbi([
  'function resolver(bytes32 node) view returns (address)',
  'function owner(bytes32 node) view returns (address)',
]);

const reverseRegistrarAbi = parseAbi([
  'function node(address addr) view returns (bytes32)',
  'function defaultResolver() view returns (address)',
]);

const publicResolverAbi = parseAbi([
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
]);

// --- Helper Functions ---
import { keccak256, hexToBytes, stringToBytes } from 'viem';

function labelhash(label: string): `0x${string}` { 
  return keccak256(stringToBytes(label)); 
}

function namehash(name: string): `0x${string}` {
  let node: `0x${string}` = '0x' + '00'.repeat(32) as `0x${string}`;
  if (name) {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const lh = labelhash(labels[i]);
      node = keccak256(new Uint8Array([...hexToBytes(node), ...hexToBytes(lh)])) as `0x${string}`;
    }
  }
  return node;
}

/**
 * Get the reverse node hash for an Ethereum address using the Reverse Registrar
 */
async function getReverseNode(
  publicClient: any,
  ethAddress: `0x${string}`
): Promise<`0x${string}` | null> {
  try {
    const reverseNode = await publicClient.readContract({
      address: REVERSE_REGISTRAR,
      abi: reverseRegistrarAbi,
      functionName: 'node',
      args: [ethAddress],
    }) as `0x${string}`;
    
    return reverseNode;
  } catch (error) {
    console.error(`❌ Error getting reverse node for ${ethAddress}:`, error);
    return null;
  }
}

/**
 * Get the default resolver address from the Reverse Registrar
 */
async function getDefaultResolver(
  publicClient: any
): Promise<`0x${string}` | null> {
  try {
    const defaultResolver = await publicClient.readContract({
      address: REVERSE_REGISTRAR,
      abi: reverseRegistrarAbi,
      functionName: 'defaultResolver',
      args: [],
    }) as `0x${string}`;
    
    return defaultResolver;
  } catch (error) {
    console.error('❌ Error getting default resolver:', error);
    return null;
  }
}

/**
 * Perform reverse name lookup for an Ethereum address
 */
async function reverseNameLookup(
  publicClient: any,
  ethAddress: `0x${string}`
): Promise<{ 
  address: string; 
  ensName: string | null; 
  reverseNode: string | null; 
  resolver: string | null;
  error?: string;
}> {
  try {
    console.log(`🔍 Performing reverse name lookup for: ${ethAddress}`);
    
    // Step 1: Get the reverse node from the Reverse Registrar
    const reverseNode = await getReverseNode(publicClient, ethAddress);
    if (!reverseNode) {
      return {
        address: ethAddress,
        ensName: null,
        reverseNode: null,
        resolver: null,
        error: 'Failed to get reverse node from Reverse Registrar'
      };
    }
    
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Step 2: Check if there's a resolver set for this reverse node
    const resolver = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'resolver',
      args: [reverseNode],
    }) as `0x${string}`;
    
    if (resolver === '0x0000000000000000000000000000000000000000') {
      console.log('⚠️  No resolver set for reverse node');
      return {
        address: ethAddress,
        ensName: null,
        reverseNode: reverseNode,
        resolver: null,
        error: 'No resolver set for reverse node'
      };
    }
    
    console.log(`📍 Resolver: ${resolver}`);
    
    // Step 3: Try to read the name from the resolver
    let ensName: string | null = null;
    try {
      ensName = await publicClient.readContract({
        address: resolver,
        abi: publicResolverAbi,
        functionName: 'name',
        args: [reverseNode],
      }) as string;
      
      if (ensName && ensName !== '') {
        console.log(`✅ ENS name found: ${ensName}`);
      } else {
        console.log('⚠️  No ENS name set for this address');
        ensName = null;
      }
    } catch (readError) {
      console.log('⚠️  Error reading ENS name from resolver:', readError);
      ensName = null;
    }
    
    return {
      address: ethAddress,
      ensName: ensName,
      reverseNode: reverseNode,
      resolver: resolver,
    };
    
  } catch (error) {
    console.error(`❌ Error during reverse name lookup for ${ethAddress}:`, error);
    return {
      address: ethAddress,
      ensName: null,
      reverseNode: null,
      resolver: null,
      error: `Lookup failed: ${error}`
    };
  }
}

/**
 * Validate mainnet configuration
 */
function validateMainnetConfig(): void {
  const errors: string[] = [];

  if (!process.env.MAINNET_RPC_URL) {
    errors.push('MAINNET_RPC_URL environment variable is recommended for better performance');
  }

  if (errors.length > 0) {
    console.warn(`⚠️  Configuration warnings:\n${errors.join('\n')}`);
  }
}

/**
 * Print mainnet configuration
 */
function printMainnetConfig(): void {
  console.log('📋 Mainnet Configuration:');
  console.log(`   Chain: mainnet (ID: ${MAINNET_CONFIG.chainId})`);
  console.log(`   RPC URL: ${MAINNET_CONFIG.rpcUrl}`);
  console.log(`   Test Addresses: ${MAINNET_CONFIG.testAddresses.length}`);
  console.log(`   ENS Registry: ${ENS_REGISTRY}`);
  console.log(`   Reverse Registrar: ${REVERSE_REGISTRAR}`);
  console.log('');
}

/**
 * Main function to test reverse name lookup
 */
async function main(): Promise<{
  success: boolean;
  results: Array<{
    address: string;
    ensName: string | null;
    reverseNode: string | null;
    resolver: string | null;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    withNames: number;
    withoutNames: number;
    errors: number;
  };
  message: string;
}> {
  try {
    console.log('🚀 Starting ENS Reverse Name Lookup Test on Mainnet...');
    console.log('🔍 This test looks up ENS names for Ethereum addresses using the Reverse Registrar');
    console.log('');
    
    // Validate configuration
    validateMainnetConfig();
    printMainnetConfig();
    
    // Create public client for blockchain interactions
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });
    
    console.log('✅ Public client created');
    
    // Get default resolver for reference
    console.log('🔍 Getting default resolver from Reverse Registrar...');
    const defaultResolver = await getDefaultResolver(publicClient);
    if (defaultResolver) {
      console.log(`📍 Default resolver: ${defaultResolver}`);
    } else {
      console.log('⚠️  Could not get default resolver');
    }
    console.log('');
    
    // Perform reverse name lookups for test addresses
    console.log('🔍 Starting reverse name lookups...');
    console.log('');
    
    const results = [];
    let successful = 0;
    let withNames = 0;
    let withoutNames = 0;
    let errors = 0;
    
    for (const address of MAINNET_CONFIG.testAddresses) {
      const result = await reverseNameLookup(publicClient, address as `0x${string}`);
      results.push(result);
      
      if (result.error) {
        errors++;
      } else {
        successful++;
        if (result.ensName) {
          withNames++;
        } else {
          withoutNames++;
        }
      }
      
      console.log(''); // Add spacing between lookups
    }
    
    // Generate summary
    const summary = {
      total: MAINNET_CONFIG.testAddresses.length,
      successful,
      withNames,
      withoutNames,
      errors,
    };
    
    console.log('📊 Lookup Results Summary:');
    console.log(`   Total addresses tested: ${summary.total}`);
    console.log(`   Successful lookups: ${summary.successful}`);
    console.log(`   Addresses with ENS names: ${summary.withNames}`);
    console.log(`   Addresses without ENS names: ${summary.withoutNames}`);
    console.log(`   Errors: ${summary.errors}`);
    console.log('');
    
    // Show detailed results
    console.log('📋 Detailed Results:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.address}`);
      if (result.ensName) {
        console.log(`   ✅ ENS Name: ${result.ensName}`);
      } else if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ⚠️  No ENS name set`);
      }
      if (result.reverseNode) {
        console.log(`   🔐 Reverse Node: ${result.reverseNode}`);
      }
      if (result.resolver) {
        console.log(`   🔧 Resolver: ${result.resolver}`);
      }
      console.log('');
    });
    
    const message = `Reverse name lookup test completed. ${summary.withNames} out of ${summary.total} addresses have ENS names.`;
    
    return {
      success: summary.errors === 0,
      results,
      summary,
      message,
    };
    
  } catch (error) {
    console.error('❌ Error in ENS reverse name lookup test:', error);
    throw error;
  }
}

// Export functions for use in other modules
export {
  getReverseNode,
  getDefaultResolver,
  reverseNameLookup,
  main,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n🎯 ENS Reverse Name Lookup Test completed!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ ENS Reverse Name Lookup Test failed:', error);
      process.exit(1);
    });
}
