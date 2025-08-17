import { 
  createPublicClient, 
  http, 
  toHex,
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
  createPimlicoClient 
} from 'permissionless/clients/pimlico';
import { 
  TEST_CONFIG, 
  validateConfig, 
  printConfig 
} from './config';

// Import your actual ABI files (same as main service)
import ETHRegistrarControllerABI from '../src/abis/ETHRegistrarController.json';
import PublicResolverABI from '../src/abis/PublicResolver.json';

// ENS Registry ABI (for checking domain ownership)
const ENS_REGISTRY_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }]
  }
] as const;

/**
 * ENS Registration Test using AA Wallet
 * Registers the ENS domain specified in environment configuration
 * Uses the same logic as your EnsService.createEnsDomainName method
 */

// ENS Contract Addresses (Sepolia)
const ENS_CONTRACTS = {
  ETHRegistrarController: '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968' as `0x${string}`,
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
};

// Use your actual ABI files (same as main service)
const ENS_ABIS = {
  ETHRegistrarController: ETHRegistrarControllerABI.abi,
  PublicResolver: PublicResolverABI.abi
};

/**
 * Signatory structure that matches exactly what you use
 */
type Signatory = {
  account: PrivateKeyAccount;
  signer?: any;
};

/**
 * Creates a signatory from a private key - same as your burnerSignatoryFactory
 */
function createSignatoryFromPrivateKey(privateKey: `0x${string}`): Signatory {
  const account = privateKeyToAccount(privateKey);
  
  return {
    account,
    signer: undefined,
  };
}

/**
 * EXACT copy of your findValidOrgAccount function for ENS registration
 */
async function findValidOrgAccount(
  owner: any, 
  signatory: any, 
  publicClient: any
): Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> {
  const startSeed = 10000;
  const tryCount = 5; // Reduced for testing

  for (let i = 0; i < tryCount; i++) {
    try {
      // build organization AA for EOA Connected Wallet
      const orgAccountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        signatory: signatory,
        deploySalt: `0x${(10000).toString(16)}` as `0x${string}`, // Fixed salt for consistent Org AA account
      });

      const orgAddress = await orgAccountClient.getAddress();
      console.log(`✅ Organization smart account ${i + 1} created at:`, orgAddress);
      
      // Return the first valid account (skip blacklist check for testing)
      return orgAccountClient;
      
    } catch (error) {
      console.error(`Error creating org smart account attempt ${i + 1}:`, error);
      // Continue to next attempt
    }
  }
  
  return undefined;
}

/**
 * Check if ENS domain is available
 */
async function checkDomainAvailability(
  publicClient: any,
  domainName: string
): Promise<boolean> {
  try {
    const available = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ENS_ABIS.ETHRegistrarController,
      functionName: 'available',
      args: [domainName]
    });
    
    return available as boolean;
  } catch (error) {
    console.error('Error checking domain availability:', error);
    return false;
  }
}

/**
 * Get registration price for ENS domain
 */
async function getRegistrationPrice(
  publicClient: any,
  domainName: string,
  duration: number
): Promise<{ base: bigint; premium: bigint }> {
  try {
    const price = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ENS_ABIS.ETHRegistrarController,
      functionName: 'rentPrice',
      args: [domainName, BigInt(duration)]
    }) as { base: bigint; premium: bigint };
    
    return price;
  } catch (error) {
    console.error('Error getting registration price:', error);
    throw error;
  }
}

/**
 * Make commitment for ENS registration
 * Uses the same approach as your main service
 */
async function makeCommitment(
  publicClient: any,
  registrationObject: any
): Promise<`0x${string}`> {
  try {
    const commitment = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ENS_ABIS.ETHRegistrarController,
      functionName: 'makeCommitment',
      args: [registrationObject] // Pass the entire object as single argument
    });
    
    return commitment as `0x${string}`;
  } catch (error) {
    console.error('Error making commitment:', error);
    throw error;
  }
}

/**
 * Check if a domain is already owned by a specific address
 */
async function checkDomainOwnership(
  publicClient: any,
  ensName: string,
  ownerAddress: string
): Promise<boolean> {
  try {
    const ensFullName = `${ensName}.eth`;
    const node = namehash(ensFullName);
    
    const currentOwner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: ENS_REGISTRY_ABI,
      functionName: 'owner',
      args: [node]
    });
    
    return currentOwner === ownerAddress;
  } catch (error) {
    console.error('Error checking domain ownership:', error);
    return false;
  }
}

/**
 * Generate a random available domain name for testing
 */
async function findAvailableDomain(
  publicClient: any,
  baseName: string = 'test'
): Promise<string> {
  const maxAttempts = 10;
  
  for (let i = 0; i < maxAttempts; i++) {
    const testName = `${baseName}${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const isAvailable = await checkDomainAvailability(publicClient, testName);
    
    if (isAvailable) {
      return testName;
    }
  }
  
  throw new Error('Could not find an available domain name after multiple attempts');
}

/**
 * Main ENS registration test function
 */
async function main() {
  try {
    console.log('🚀 Starting ENS Registration Test with AA Wallet');
    
    // Validate configuration
    validateConfig();
    printConfig();
    
    // Step 1: Create the public client
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    console.log('✅ Public client created');

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

    // Step 4: Prepare ENS registration
    let ensName = TEST_CONFIG.ensName;
    let ensFullName = `${ensName}.eth`;
    const duration = TEST_CONFIG.ensDuration;
    
    console.log(`🎯 Preparing to register ENS domain: ${ensFullName}`);
    console.log(`⏱️  Duration: ${duration} seconds (${duration / 86400} days)`);

    // Step 5: Check domain availability
    console.log('🔍 Checking domain availability...');
    let isAvailable = await checkDomainAvailability(publicClient, ensName);
    
    if (!isAvailable) {
      console.log(`⚠️  Domain ${ensFullName} is not available for registration`);
      console.log('This could mean:');
      console.log('  1. The domain is already registered');
      console.log('  2. The domain is reserved');
      console.log('  3. The domain is invalid');
      
      // Let's check if it's already owned by someone
      try {
        const node = namehash(ensFullName);
        const currentOwner = await publicClient.readContract({
          address: ENS_CONTRACTS.ENSRegistry,
          abi: ENS_REGISTRY_ABI,
          functionName: 'owner',
          args: [node]
        });
        
        if (currentOwner !== '0x0000000000000000000000000000000000000000') {
          console.log(`ℹ️  Domain is already owned by: ${currentOwner}`);
          console.log('You can try a different domain name or check if you want to transfer ownership.');
          
          // Check if we own it already
          if (currentOwner === orgAddress) {
            console.log('🎉 You already own this domain!');
            return {
              success: true,
              ensName: ensFullName,
              owner: orgAddress,
              message: 'Domain already owned by this account'
            };
          }
        }
      } catch (error) {
        console.log('Could not determine current owner');
      }
      
      // Try to find an available domain for testing
      console.log('🔍 Searching for an available domain for testing...');
      try {
        ensName = await findAvailableDomain(publicClient, 'test');
        ensFullName = `${ensName}.eth`;
        console.log(`✅ Found available domain: ${ensFullName}`);
        isAvailable = true;
      } catch (error) {
        console.error('❌ Could not find an available domain:', error);
        throw new Error(`Domain ${TEST_CONFIG.ensName}.eth is not available and could not find alternative`);
      }
    }
    
    if (!isAvailable) {
      throw new Error(`Domain ${ensFullName} is not available for registration`);
    }
    console.log('✅ Domain is available for registration');

    // Step 6: Get registration price
    console.log('💰 Getting registration price...');
    const price = await getRegistrationPrice(publicClient, ensName, duration);
    const totalPrice = price.base + price.premium;
    
    console.log('📊 Registration costs:', {
      base: `${Number(price.base) / 1e18} ETH`,
      premium: `${Number(price.premium) / 1e18} ETH`,
      total: `${Number(totalPrice) / 1e18} ETH`
    });

    // Step 7: Check account balance
    const balance = await publicClient.getBalance({
      address: orgAddress
    });
    console.log('💳 Account balance:', `${Number(balance) / 1e18} ETH`);

    if (balance < totalPrice) {
      throw new Error(`Insufficient balance. Need ${Number(totalPrice) / 1e18} ETH but have ${Number(balance) / 1e18} ETH`);
    }

    // Step 8: Prepare registration object (same structure as your main service)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

    const registrationObject = {
      label: ensName,
      owner: orgAddress,
      duration: BigInt(duration),
      secret,
      resolver: ENS_CONTRACTS.PublicResolver,
      data: [],
      reverseRecord: true,
      referrer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
    };

    console.log('📝 Registration object prepared:', {
      ...registrationObject,
      secret: `${secret.substring(0, 10)}...`,
      duration: `${duration} seconds`
    });

    // Step 9: Make commitment
    console.log('🔐 Making commitment...');
    const commitment = await makeCommitment(publicClient, registrationObject);
    console.log('✅ Commitment created:', commitment);

    // Step 10: Create bundler client for transactions (exactly like your main service)
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
      paymaster: true,
      chain: TEST_CONFIG.chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });

    // Step 11: Get gas prices and send commitment transaction (same as your main service)
    const feeData = await publicClient.estimateFeesPerGas();
    console.log('Current fee data:', feeData);

    // Use dynamic gas prices with a buffer (same as your main service)
    const gasConfig = {
      maxFeePerGas: feeData.maxFeePerGas * 2n, // Double the estimated gas price to ensure acceptance
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
    };
    console.log('Using gas config:', gasConfig);

    console.log('📤 Sending commitment transaction...');
    const commitUserOpHash = await bundlerClient.sendUserOperation({
      account: orgAccountClient,
      calls: [{
        to: ENS_CONTRACTS.ETHRegistrarController,
        data: encodeFunctionData({
          abi: ENS_ABIS.ETHRegistrarController,
          functionName: 'commit',
          args: [commitment]
        }),
        value: 0n
      }],
      ...gasConfig
    });

    console.log('📋 Commitment transaction sent:', commitUserOpHash);

    // Step 12: Wait for commitment confirmation
    const { receipt: commitReceipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: commitUserOpHash,
    });
    console.log('✅ Commitment transaction confirmed:', commitReceipt);

    // Step 13: Wait for commitment to be ready (90 seconds)
    console.log('⏳ Waiting for commitment to be ready (90 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 90000));

    // Step 14: Verify commitment is still valid
    console.log('🔍 Verifying commitment...');
    const commitmentStatus = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ENS_ABIS.ETHRegistrarController,
      functionName: 'commitments',
      args: [commitment]
    });

    if (!commitmentStatus) {
      throw new Error('Commitment not found or expired');
    }
    console.log('✅ Commitment is still valid');

    // Step 15: Register the domain (same approach as your main service)
    console.log('📝 Preparing registration transaction...');
    const registerData = encodeFunctionData({
      abi: ENS_ABIS.ETHRegistrarController,
      functionName: 'register',
      args: [registrationObject] // Pass the entire object as single argument
    });

    console.log('📤 Sending registration transaction...');
    const registerUserOpHash = await bundlerClient.sendUserOperation({
      account: orgAccountClient,
      calls: [{
        to: ENS_CONTRACTS.ETHRegistrarController,
        data: registerData,
        value: totalPrice
      }],
      ...gasConfig
    });

    console.log('📋 Registration transaction sent:', registerUserOpHash);

    // Step 16: Wait for registration confirmation
    const { receipt: registerReceipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: registerUserOpHash,
    });
    console.log('✅ Registration transaction confirmed:', registerReceipt);

    // Step 17: Verify registration
    console.log('🔍 Verifying ENS registration...');
    const node = namehash(ensFullName);
    
    // Check if the domain is now owned by our smart account
    const domainOwner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: ENS_REGISTRY_ABI,
      functionName: 'owner',
      args: [node]
    });

    if (domainOwner === orgAddress) {
      console.log(`🎉 ENS domain "${ensFullName}" registered successfully!`);
      console.log(`👤 Owner: ${orgAddress}`);
      console.log(`🔗 View: https://sepolia.app.ens.domains/${ensFullName}`);
      
      return {
        success: true,
        ensName: ensFullName,
        owner: orgAddress,
        commitmentHash: commitReceipt,
        registrationHash: registerReceipt,
        totalCost: `${Number(totalPrice) / 1e18} ETH`
      };
    } else {
      throw new Error(`Registration verification failed. Expected owner: ${orgAddress}, Got: ${domainOwner}`);
    }

  } catch (error) {
    console.error('❌ Error in ENS registration test:', error);
    throw error;
  }
}

// Export functions for use in other modules
export {
  createSignatoryFromPrivateKey,
  findValidOrgAccount,
  checkDomainAvailability,
  checkDomainOwnership,
  getRegistrationPrice,
  makeCommitment,
  findAvailableDomain,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n🎯 ENS Registration Test completed successfully!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ ENS Registration Test failed:', error);
      process.exit(1);
    });
}
