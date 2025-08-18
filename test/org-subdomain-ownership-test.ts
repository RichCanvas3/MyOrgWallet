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

// ENS Contract Addresses (Sepolia)
const ENS_CONTRACTS = {
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
  NameWrapper: '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`,
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
};

/**
 * Organization Subdomain Ownership Test
 * Uses ORG_PRIVATE_KEY for an EOA that is associated with an ORG AA
 * The ORG AA becomes the owner of a subdomain created by the EOA/AA associated with PRIVATE_KEY
 * The EOA/AA associated with PRIVATE_KEY owns the ENS_NAME and creates the subdomain
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
 * Find a valid individual smart account (for the ENS owner)
 */
async function findValidIndivAccount(
  owner: string,
  signatory: Signatory,
  publicClient: any
): Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | null> {
  console.log('🔍 Finding valid individual smart account...');
  
  try {
    // Try to create the smart account
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [owner, [], [], []],
      signatory: signatory,
      deploySalt: `0x${(100).toString(16)}` as `0x${string}`, // Individual salt
    });

    console.log('✅ Individual smart account created successfully');
    return smartAccount;
  } catch (error) {
    console.error('❌ Failed to create individual smart account:', error);
    return null;
  }
}

/**
 * Find a valid organization smart account (for the ORG EOA)
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
 * Check if a subdomain exists and who owns it
 */
async function checkSubdomainOwnership(
  publicClient: any,
  subdomain: string
): Promise<{ exists: boolean; owner?: string; resolver?: string }> {
  try {
    const subdomainNode = namehash(subdomain);
    
    console.log(`🔍 Checking ownership for subdomain: ${subdomain}`);
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    
    // Check if the subdomain has an owner
    const owner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [{ name: 'owner', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
      functionName: 'owner',
      args: [subdomainNode]
    }) as `0x${string}`;
    
    if (owner === '0x0000000000000000000000000000000000000000') {
      console.log('❌ Subdomain does not exist or has no owner');
      return { exists: false };
    }
    
    console.log(`👤 Subdomain owner: ${owner}`);
    
    // Check if the subdomain has a resolver set
    const resolver = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [{ name: 'resolver', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
      functionName: 'resolver',
      args: [subdomainNode]
    }) as `0x${string}`;
    
    console.log(`🔧 Resolver: ${resolver}`);
    
    return { exists: true, owner, resolver };
    
  } catch (error) {
    console.error('❌ Error checking subdomain ownership:', error);
    return { exists: false };
  }
}

/**
 * Create subdomain and transfer ownership to ORG AA
 */
async function createSubdomainForOrg(
  publicClient: any,
  bundlerClient: any,
  ensOwnerClient: any,
  orgAccountAddress: string,
  subdomain: string,
  gasConfig: any
): Promise<{ success: boolean; subdomain?: string; owner?: string; error?: string }> {
  try {
    console.log(`🔧 Creating subdomain for ORG AA: ${subdomain}`);
    console.log(`👤 New owner (ORG AA): ${orgAccountAddress}`);
    
    const parentDomain = `${TEST_CONFIG.ensName}.eth`;
    const parentNode = namehash(parentDomain);
    const subdomainName = TEST_CONFIG.subdomainName;
    const subdomainNode = namehash(subdomain);
    
    console.log(`🔗 Parent domain: ${parentDomain}`);
    console.log(`🔗 Parent node: ${parentNode}`);
    console.log(`🔗 Subdomain name: ${subdomainName}`);
    console.log(`🔗 Subdomain node: ${subdomainNode}`);
    
    // Create subdomain using NameWrapper's setSubnodeRecord
    // This creates the subdomain and sets the ORG AA as the owner
    const createSubdomainData = encodeFunctionData({
      abi: NameWrapperABI.abi,
      functionName: 'setSubnodeRecord',
      args: [
        parentNode, // parent node
        subdomainName, // label (string, not hash)
        orgAccountAddress as `0x${string}`, // owner (ORG AA address)
        ENS_CONTRACTS.PublicResolver, // resolver
        0n, // TTL (0 = no expiration) - uint64
        0, // fuses (0 = no restrictions) - uint32
        0n // expiry (0 = no expiration) - uint64
      ]
    });
    
    console.log('📤 Creating subdomain via NameWrapper...');
    console.log('🔧 Create subdomain call details:', {
      to: ENS_CONTRACTS.NameWrapper,
      data: createSubdomainData,
      parentNode,
      label: subdomainName,
      owner: orgAccountAddress,
      resolver: ENS_CONTRACTS.PublicResolver,
      ttl: 0n,
      fuses: 0,
      expiry: 0n
    });
    
    const userOpHash = await bundlerClient.sendUserOperation({
      account: ensOwnerClient,
      calls: [{
        to: ENS_CONTRACTS.NameWrapper,
        data: createSubdomainData
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
      subdomain: subdomain,
      owner: orgAccountAddress
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
    console.log('🚀 Starting Organization Subdomain Ownership Test');
    
    // Validate configuration
    validateConfig();
    printConfig();
    
    // Create public client
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    console.log('✅ Public client created');
    
    // Step 1: Create signatories for both EOAs
    const ensOwnerSignatory = createSignatoryFromPrivateKey(TEST_CONFIG.privateKey);
    const orgSignatory = createSignatoryFromPrivateKey(TEST_CONFIG.orgPrivateKey);
    
    console.log(`✅ ENS Owner signatory created for address: ${ensOwnerSignatory.account.address}`);
    console.log(`✅ ORG signatory created for address: ${orgSignatory.account.address}`);
    
    // Step 2: Create individual smart account for ENS owner (PRIVATE_KEY)
    console.log('🔍 Creating individual smart account for ENS owner...');
    const ensOwnerAccountClient = await findValidIndivAccount(
      ensOwnerSignatory.account.address,
      ensOwnerSignatory,
      publicClient
    );
    
    if (!ensOwnerAccountClient) {
      throw new Error('Failed to create individual smart account for ENS owner');
    }
    
    const ensOwnerAddress = await ensOwnerAccountClient.getAddress();
    console.log(`✅ ENS Owner smart account found at: ${ensOwnerAddress}`);
    
    // Step 3: Create organization smart account for ORG EOA (ORG_PRIVATE_KEY)
    console.log('🔍 Creating organization smart account for ORG EOA...');
    const orgAccountClient = await findValidOrgAccount(
      orgSignatory.account.address,
      orgSignatory,
      publicClient
    );
    
    if (!orgAccountClient) {
      throw new Error('Failed to create organization smart account for ORG EOA');
    }
    
    const orgAccountAddress = await orgAccountClient.getAddress();
    console.log(`✅ ORG smart account found at: ${orgAccountAddress}`);
    
    // Step 4: Define the subdomain
    const subdomain = `${TEST_CONFIG.subdomainName}.${TEST_CONFIG.ensName}.eth`;
    
    console.log(`🎯 Testing organization subdomain ownership:`);
    console.log(`   Parent ENS: ${TEST_CONFIG.ensName}.eth`);
    console.log(`   Subdomain: ${subdomain}`);
    console.log(`   ENS Owner EOA: ${ensOwnerSignatory.account.address}`);
    console.log(`   ENS Owner AA: ${ensOwnerAddress}`);
    console.log(`   ORG EOA: ${orgSignatory.account.address}`);
    console.log(`   ORG AA: ${orgAccountAddress}`);
    
    // Step 5: Get the actual owner of the wrapped domain to create subdomain
    console.log('🔍 Getting actual owner of wrapped domain...');
    const parentDomain = `${TEST_CONFIG.ensName}.eth`;
    const parentNode = namehash(parentDomain);
    
    // Check if the parent domain exists and who owns it
    const parentOwner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [{ name: 'owner', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
      functionName: 'owner',
      args: [parentNode]
    }) as `0x${string}`;
    
    console.log(`🔗 Parent domain: ${parentDomain}`);
    console.log(`🔗 Parent node: ${parentNode}`);
    console.log(`👤 Parent owner: ${parentOwner}`);
    
    if (parentOwner === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Parent domain ${parentDomain} does not exist or has no owner`);
    }
    
    // For wrapped ENS records, we need to get the actual owner from NameWrapper
    let actualOwner: string;
    if (parentOwner.toLowerCase() === ENS_CONTRACTS.NameWrapper.toLowerCase()) {
      console.log('✅ Parent domain is wrapped, getting NameWrapper owner...');
      
      try {
        const parentNode = namehash(`${TEST_CONFIG.ensName}.eth`);
        const tokenId = BigInt(parentNode);
        actualOwner = await publicClient.readContract({
          address: ENS_CONTRACTS.NameWrapper,
          abi: NameWrapperABI.abi,
          functionName: 'ownerOf',
          args: [tokenId]
        }) as `0x${string}`;
        
        console.log(`🎯 NameWrapper owner: ${actualOwner}`);
      } catch (error) {
        console.error('❌ Error getting NameWrapper owner:', error);
        throw new Error(`Failed to get NameWrapper owner: ${error.message}`);
      }
    } else {
      actualOwner = parentOwner;
      console.log(`🎯 Direct owner: ${actualOwner}`);
    }
    
    // Now we need to create a smart account for the actual owner to create the subdomain
    // The actual owner is the organization smart account created from TEST_CONFIG.privateKey (same as wrapper test)
    console.log('🔧 Creating smart account for actual domain owner...');
    
    // Create signatory for the actual owner (using the same private key as wrapper test)
    const actualOwnerSignatory = createSignatoryFromPrivateKey(TEST_CONFIG.privateKey);
    console.log(`✅ Actual owner signatory created for address: ${actualOwnerSignatory.account.address}`);
    
    // Find or create the actual owner's smart account (organization account, same as wrapper test)
    const actualOwnerAccount = await findValidOrgAccount(
      actualOwnerSignatory.account.address,
      actualOwnerSignatory,
      publicClient
    );
    
    if (!actualOwnerAccount) {
      throw new Error('Failed to create smart account for actual domain owner');
    }
    
    const actualOwnerAddress = await actualOwnerAccount.getAddress();
    console.log(`✅ Actual owner smart account found at: ${actualOwnerAddress}`);
    
    // Verify this matches the actual owner from NameWrapper
    if (actualOwnerAddress.toLowerCase() !== actualOwner.toLowerCase()) {
      console.log('⚠️  Warning: Actual owner smart account does not match NameWrapper owner');
      console.log(`Expected: ${actualOwner}`);
      console.log(`Actual: ${actualOwnerAddress}`);
      // Continue anyway as the smart account might be the correct one
    }
    
    // Step 6: Check if subdomain already exists
    console.log('🔍 Checking if subdomain already exists...');
    const ownershipStatus = await checkSubdomainOwnership(publicClient, subdomain);
    
    if (ownershipStatus.exists) {
      console.log(`🎉 Subdomain ${subdomain} already exists!`);
      console.log(`👤 Current owner: ${ownershipStatus.owner}`);
      console.log(`🔧 Resolver: ${ownershipStatus.resolver}`);
      
      if (ownershipStatus.owner?.toLowerCase() === orgAccountAddress.toLowerCase()) {
        console.log('✅ Subdomain is already owned by the ORG AA!');
        return {
          success: true,
          subdomain: subdomain,
          message: 'Subdomain already owned by ORG AA',
          owner: ownershipStatus.owner,
          resolver: ownershipStatus.resolver
        };
      } else {
        console.log('⚠️  Subdomain exists but is not owned by ORG AA');
        console.log(`Expected: ${orgAccountAddress}`);
        console.log(`Actual: ${ownershipStatus.owner}`);
      }
    }
    
    // Step 7: Create bundler client for transactions
    console.log('🔧 Creating bundler client...');
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
      paymaster: true,
      chain: TEST_CONFIG.chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });
    
    // Step 8: Get gas configuration
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
    
    // Step 9: Create subdomain and transfer ownership to ORG AA
    console.log('🔧 Creating subdomain for ORG AA...');
    const createResult = await createSubdomainForOrg(
      publicClient,
      bundlerClient,
      actualOwnerAccount, // Use the actual owner's smart account instead of ENS Owner AA
      orgAccountAddress,
      subdomain,
      gasConfig
    );
    
    if (!createResult.success) {
      throw new Error(`Failed to create subdomain: ${createResult.error}`);
    }
    
    // Step 10: Verify the subdomain ownership
    console.log('🔍 Verifying subdomain ownership...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain to update
    
    const verificationStatus = await checkSubdomainOwnership(publicClient, subdomain);
    
    if (verificationStatus.exists && verificationStatus.owner?.toLowerCase() === orgAccountAddress.toLowerCase()) {
      console.log('✅ Subdomain ownership verified successfully!');
      console.log(`🎉 ${subdomain} is now owned by ORG AA ${orgAccountAddress}!`);
      
      return {
        success: true,
        subdomain: subdomain,
        message: 'Subdomain created and owned by ORG AA',
        owner: verificationStatus.owner,
        resolver: verificationStatus.resolver,
        ensOwnerEOA: ensOwnerSignatory.account.address,
        ensOwnerAA: ensOwnerAddress,
        orgEOA: orgSignatory.account.address,
        orgAA: orgAccountAddress
      };
    } else {
      throw new Error('Subdomain ownership verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error in Organization Subdomain Ownership Test:', error);
    throw error;
  }
}

// Export functions for use in other tests
export {
  createSignatoryFromPrivateKey,
  findValidIndivAccount,
  findValidOrgAccount,
  checkSubdomainOwnership,
  createSubdomainForOrg,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('🎉 Organization Subdomain Ownership Test completed successfully!');
      console.log('📊 Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Organization Subdomain Ownership Test failed:', error);
      process.exit(1);
    });
}
