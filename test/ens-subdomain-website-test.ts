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
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
  NameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`,
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
};

/**
 * ENS Subdomain Website Test using AA Wallet
 * Sets a website URL for the ENS subdomain specified in environment configuration
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
 * Check if a subdomain has a website URL set
 */
async function checkSubdomainWebsite(
  publicClient: any,
  subdomain: string
): Promise<{ hasWebsite: boolean; website?: string; resolver?: string }> {
  try {
    const subdomainNode = namehash(subdomain);
    
    console.log(`🔍 Checking website for subdomain: ${subdomain}`);
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    
    // First check if the subdomain has a resolver set
    const resolver = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [{ name: 'resolver', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
      functionName: 'resolver',
      args: [subdomainNode]
    }) as `0x${string}`;
    
    if (resolver === '0x0000000000000000000000000000000000000000') {
      console.log('❌ No resolver set for subdomain');
      return { hasWebsite: false };
    }
    
    console.log(`🔧 Resolver: ${resolver}`);
    
    // Check if the resolver is our PublicResolver
    if (resolver.toLowerCase() !== ENS_CONTRACTS.PublicResolver.toLowerCase()) {
      console.log('⚠️  Resolver is not our PublicResolver');
      return { hasWebsite: false, resolver };
    }
    
    // Check if website URL is set via text record
    try {
      const websiteUrl = await publicClient.readContract({
        address: ENS_CONTRACTS.PublicResolver,
        abi: PublicResolverABI.abi,
        functionName: 'text',
        args: [subdomainNode, 'url']
      }) as string;
      
      if (websiteUrl && websiteUrl !== '') {
        console.log(`✅ Website found: ${websiteUrl}`);
        return { hasWebsite: true, website: websiteUrl, resolver };
      } else {
        console.log('❌ No website URL set');
        return { hasWebsite: false, resolver };
      }
    } catch (error) {
      console.log('⚠️  Could not read website URL:', error.message);
      return { hasWebsite: false, resolver };
    }
    
  } catch (error) {
    console.error('❌ Error checking subdomain website:', error);
    return { hasWebsite: false };
  }
}

/**
 * Set website URL for ENS subdomain
 */
async function setSubdomainWebsite(
  publicClient: any,
  bundlerClient: any,
  smartAccountClient: any,
  subdomain: string,
  websiteUrl: string,
  gasConfig: any
): Promise<{ success: boolean; subdomain?: string; website?: string; error?: string }> {
  try {
    console.log(`🔧 Setting website URL for ENS subdomain: ${subdomain}`);
    console.log(`🌐 Website URL: ${websiteUrl}`);
    
    const subdomainNode = namehash(subdomain);
    const smartAccountAddress = await smartAccountClient.getAddress();
    
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    console.log(`👤 Smart Account: ${smartAccountAddress}`);
    
    // Set the website URL using setText (same approach as main project)
    // This is much simpler and more reliable than contenthash
    console.log(`🔗 Setting website URL: ${websiteUrl}`);
    
    // Set the website URL using PublicResolver setText function
    const setWebsiteData = encodeFunctionData({
      abi: PublicResolverABI.abi,
      functionName: 'setText',
      args: [
        subdomainNode, // node
        'url', // key (standard ENS text record key for website)
        websiteUrl // value (the actual website URL)
      ]
    });
    
    console.log('📤 Setting website URL via PublicResolver setText...');
    console.log('🔧 Set website call details:', {
      to: ENS_CONTRACTS.PublicResolver,
      data: setWebsiteData,
      node: subdomainNode,
      key: 'url',
      value: websiteUrl
    });
    
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccountClient,
      calls: [{
        to: ENS_CONTRACTS.PublicResolver,
        data: setWebsiteData
      }],
      ...gasConfig
    });
    
    console.log('📋 Website URL setting transaction sent:', userOpHash);
    
    // Wait for confirmation
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('✅ Website URL set successfully:', receipt);
    
    return { 
      success: true, 
      subdomain: subdomain,
      website: websiteUrl
    };
    
  } catch (error) {
    console.error('❌ Error setting subdomain website:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function main(): Promise<any> {
  try {
    console.log('🚀 Starting ENS Subdomain Website Test with AA Wallet');
    
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
    
    // Step 1: Define the subdomain and website
    const subdomain = `${TEST_CONFIG.subdomainName}.${TEST_CONFIG.ensName}.eth`;
    const websiteUrl = TEST_CONFIG.subdomainWebsite;
    
    console.log(`🎯 Testing ENS subdomain website setting:`);
    console.log(`   Subdomain: ${subdomain}`);
    console.log(`   Website URL: ${websiteUrl}`);
    
    // Step 2: Check if subdomain already has a website
    console.log('🔍 Checking if subdomain already has a website...');
    const websiteStatus = await checkSubdomainWebsite(publicClient, subdomain);
    
    if (websiteStatus.hasWebsite) {
      console.log(`🎉 Subdomain ${subdomain} already has a website!`);
      console.log(`🌐 Current website: ${websiteStatus.website}`);
      console.log(`🔧 Resolver: ${websiteStatus.resolver}`);
      
      return {
        success: true,
        subdomain: subdomain,
        message: 'Website already set',
        website: websiteStatus.website,
        resolver: websiteStatus.resolver
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
    
    // Step 5: Set the website URL
    console.log('🔧 Setting website URL...');
    const setWebsiteResult = await setSubdomainWebsite(
      publicClient,
      bundlerClient,
      orgAccountClient,
      subdomain,
      websiteUrl,
      gasConfig
    );
    
    if (!setWebsiteResult.success) {
      throw new Error(`Failed to set website URL: ${setWebsiteResult.error}`);
    }
    
    // Step 6: Verify the website URL was set successfully
    console.log('🔍 Verifying website URL was set successfully...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain to update
    
    const verificationStatus = await checkSubdomainWebsite(publicClient, subdomain);
    
    if (verificationStatus.hasWebsite) {
      console.log('✅ Website URL setting verified successfully!');
      console.log(`🎉 ${subdomain} now points to ${websiteUrl}!`);
      
      return {
        success: true,
        subdomain: subdomain,
        message: 'Website URL set successfully',
        website: websiteUrl,
        resolver: verificationStatus.resolver
      };
    } else {
      throw new Error('Website URL setting verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error in ENS Subdomain Website Test:', error);
    throw error;
  }
}

// Export functions for use in other tests
export {
  createSignatoryFromPrivateKey,
  findValidOrgAccount,
  checkSubdomainWebsite,
  setSubdomainWebsite,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('🎉 ENS Subdomain Website Test completed successfully!');
      console.log('📊 Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ ENS Subdomain Website Test failed:', error);
      process.exit(1);
    });
}
