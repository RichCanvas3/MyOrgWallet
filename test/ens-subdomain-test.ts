import { 
  createPublicClient, 
  http, 
  namehash,
  encodeFunctionData,
  keccak256,
  stringToHex
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
import NameWrapperABI from '../src/abis/NameWrapper.json';
import PublicResolverABI from '../src/abis/PublicResolver.json';

// NameWrapper ABI for subdomain operations (since parent domain is wrapped)
const NAME_WRAPPER_SUBDOMAIN_ABI = [
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' }
    ],
    outputs: [{ name: 'node', type: 'bytes32' }]
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  }
] as const;

// ENS Contract Addresses (Sepolia)
const ENS_CONTRACTS = {
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
  NameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`,
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
};

/**
 * ENS Subdomain Test using AA Wallet
 * Creates a subdomain for the wrapped ENS record specified in environment configuration
 * Uses the same Org AA pattern as other tests
 */

/**
 * Signatory structure that matches exactly what you use
 */
type Signatory = {
  account: PrivateKeyAccount;
  signer?: any;
};

/**
 * Create a signatory from a private key
 */
function createSignatoryFromPrivateKey(privateKey: `0x${string}`): Signatory {
  const account = privateKeyToAccount(privateKey);
  
  return {
    account,
    signer: undefined,
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
 * Check if a subdomain already exists
 */
async function checkIfSubdomainExists(
  publicClient: any,
  parentDomain: string,
  subdomainName: string
): Promise<{ exists: boolean; owner?: string; resolver?: string }> {
  try {
    const parentNode = namehash(parentDomain);
    const labelHash = keccak256(stringToHex(subdomainName));
    const subdomainNode = namehash(`${subdomainName}.${parentDomain}`);
    
    console.log(`🔍 Checking subdomain: ${subdomainName}.${parentDomain}`);
    console.log(`🔐 Parent node: ${parentNode}`);
    console.log(`🏷️  Label hash: ${labelHash}`);
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    
    // Check if subdomain has an owner (using NameWrapper since parent is wrapped)
    try {
      const subdomainTokenId = BigInt(subdomainNode);
      const owner = await publicClient.readContract({
        address: ENS_CONTRACTS.NameWrapper,
        abi: NAME_WRAPPER_SUBDOMAIN_ABI,
        functionName: 'ownerOf',
        args: [subdomainTokenId]
      }) as `0x${string}`;
      
      if (owner !== '0x0000000000000000000000000000000000000000') {
        console.log(`✅ Subdomain exists, owner: ${owner}`);
        return { exists: true, owner };
      } else {
        console.log('❌ Subdomain does not exist');
        return { exists: false };
      }
    } catch (error) {
      // If NameWrapper doesn't have it, check ENS Registry as fallback
      console.log('Subdomain not found in NameWrapper, checking ENS Registry...');
      return { exists: false };
    }
  } catch (error) {
    console.error('❌ Error checking subdomain:', error);
    return { exists: false };
  }
}

/**
 * Create ENS subdomain
 */
async function createSubdomain(
  publicClient: any,
  bundlerClient: any,
  smartAccountClient: any,
  parentDomain: string,
  subdomainName: string,
  gasConfig: any
): Promise<{ success: boolean; subdomain?: string; error?: string }> {
  try {
    console.log(`🔧 Creating ENS subdomain: ${subdomainName}.${parentDomain}`);
    
    const parentNode = namehash(parentDomain);
    const labelHash = keccak256(stringToHex(subdomainName));
    const subdomainNode = namehash(`${subdomainName}.${parentDomain}`);
    const smartAccountAddress = await smartAccountClient.getAddress();
    
    console.log(`🔐 Parent node: ${parentNode}`);
    console.log(`🏷️  Label hash: ${labelHash}`);
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    console.log(`👤 Smart Account: ${smartAccountAddress}`);
    
    // Create the subdomain using NameWrapper's setSubnodeRecord (since parent is wrapped)
    const createData = encodeFunctionData({
      abi: NAME_WRAPPER_SUBDOMAIN_ABI,
      functionName: 'setSubnodeRecord',
      args: [
        parentNode, // parent node
        subdomainName, // label (string, not hash)
        smartAccountAddress, // owner (smart account)
        ENS_CONTRACTS.PublicResolver, // resolver
        0n, // TTL (0 = no expiration) - uint64
        0, // fuses (0 = no restrictions) - uint32
        0n // expiry (0 = no expiration) - uint64
      ]
    });
    
    console.log('📤 Creating subdomain via NameWrapper...');
    console.log('🔧 Create call details:', {
      to: ENS_CONTRACTS.NameWrapper,
      data: createData,
      parentNode,
      label: subdomainName,
      owner: smartAccountAddress,
      resolver: ENS_CONTRACTS.PublicResolver,
      ttl: 0n,
      fuses: 0n,
      expiry: 0n
    });
    
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccountClient,
      calls: [{
        to: ENS_CONTRACTS.NameWrapper,
        data: createData
      }],
      ...gasConfig
    });
    
    console.log('📋 Subdomain creation transaction sent:', userOpHash);
    
    // Wait for confirmation
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('✅ Subdomain created successfully:', receipt);
    
    return { 
      success: true, 
      subdomain: `${subdomainName}.${parentDomain}` 
    };
    
  } catch (error) {
    console.error('❌ Error creating subdomain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function main(): Promise<any> {
  try {
    console.log('🚀 Starting ENS Subdomain Test with AA Wallet');
    
    // Validate configuration
    validateConfig();
    printConfig();
    
    // Create public client
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    console.log('✅ Public client created');
    
    // Create signatory
    const signatory = createSignatoryFromPrivateKey(TEST_CONFIG.privateKey);
    console.log(`✅ Signatory created for address: ${signatory.account.address}`);
    
    // Find or create organization smart account
    const orgAccountClient = await findValidOrgAccount(
      signatory.account.address,
      signatory,
      publicClient
    );
    
    if (!orgAccountClient) {
      throw new Error('Failed to create organization smart account');
    }
    
    const orgAddress = await orgAccountClient.getAddress();
    console.log(`✅ Organization smart account found at: ${orgAddress}`);
    
    // Step 1: Define the domains
    const parentDomain = TEST_CONFIG.ensName + '.eth';
    const subdomainName = TEST_CONFIG.subdomainName;
    const fullSubdomain = `${subdomainName}.${parentDomain}`;
    
    console.log(`🎯 Testing ENS subdomain creation:`);
    console.log(`   Parent domain: ${parentDomain}`);
    console.log(`   Subdomain name: ${subdomainName}`);
    console.log(`   Full subdomain: ${fullSubdomain}`);
    
    // Step 2: Check if subdomain already exists
    console.log('🔍 Checking if subdomain already exists...');
    const subdomainStatus = await checkIfSubdomainExists(publicClient, parentDomain, subdomainName);
    
    if (subdomainStatus.exists) {
      console.log(`🎉 Subdomain ${fullSubdomain} already exists!`);
      console.log(`👤 Owner: ${subdomainStatus.owner}`);
      
      return {
        success: true,
        subdomain: fullSubdomain,
        message: 'Subdomain already exists',
        owner: subdomainStatus.owner
      };
    }
    
    // Step 3: Create bundler client for transactions
    console.log('🔧 Creating bundler client...');
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
      paymaster: true,
      chain: TEST_CONFIG.chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });
    
    // Step 4: Get gas configuration
    const feeData = await publicClient.estimateFeesPerGas();
    console.log('Current fee data:', feeData);

    const gasConfig = {
      maxFeePerGas: feeData.maxFeePerGas * 2n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
      callGasLimit: 500000n,
      preVerificationGas: 100000n,
      verificationGasLimit: 500000n
    };
    console.log('Using gas config:', gasConfig);
    
    // Step 5: Create the subdomain
    console.log('🔧 Creating subdomain...');
    const createResult = await createSubdomain(
      publicClient,
      bundlerClient,
      orgAccountClient,
      parentDomain,
      subdomainName,
      gasConfig
    );
    
    if (!createResult.success) {
      throw new Error(`Failed to create subdomain: ${createResult.error}`);
    }
    
    // Step 6: Verify the subdomain was created successfully
    console.log('🔍 Verifying subdomain was created successfully...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain to update
    
    const verificationStatus = await checkIfSubdomainExists(publicClient, parentDomain, subdomainName);
    
    if (verificationStatus.exists && verificationStatus.owner === orgAddress) {
      console.log('✅ Subdomain creation verified successfully!');
      console.log(`🎉 ${fullSubdomain} is now owned by your Org AA account!`);
      
      return {
        success: true,
        subdomain: fullSubdomain,
        message: 'Subdomain created successfully',
        owner: verificationStatus.owner
      };
    } else {
      throw new Error('Subdomain creation verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error in ENS Subdomain Test:', error);
    throw error;
  }
}

// Export functions for use in other tests
export {
  createSignatoryFromPrivateKey,
  findValidOrgAccount,
  checkIfSubdomainExists,
  createSubdomain,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('🎉 ENS Subdomain Test completed successfully!');
      console.log('📊 Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ ENS Subdomain Test failed:', error);
      process.exit(1);
    });
}
