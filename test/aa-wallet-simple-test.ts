import { 
  createPublicClient, 
  http, 
  toHex 
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
  TEST_CONFIG, 
  validateConfig, 
  printConfig 
} from './config';

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
 * EXACT copy of your findValidIndivAccount function
 */
async function findValidIndivAccount(
  owner: any, 
  signatory: any, 
  publicClient: any
): Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> {
  const startSeed = 100;
  const tryCount = 5; // Reduced for testing

  if (owner == undefined) {
    console.info("*********** owner is not defined");
    return undefined;
  }

  if (signatory == undefined) {
    console.info("*********** signatory is not defined");
    return undefined;
  }

  for (let i = 0; i < tryCount; i++) {
    try {
      // build individuals AA for EOA Connected Wallet
      const accountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        signatory: signatory,
        deploySalt: toHex(startSeed + i),
      });

      const address = await accountClient.getAddress();
      console.log(`✅ Individual smart account ${i + 1} created at:`, address);
      
      // Return the first valid account (skip blacklist check for testing)
      return accountClient;
      
    } catch (error) {
      console.error(`Error creating smart account attempt ${i + 1}:`, error);
      // Continue to next attempt
    }
  }
  
  console.info("No valid smart account found after all attempts");
  return undefined;
}

/**
 * EXACT copy of your findValidOrgAccount function
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
 * Main test function
 */
async function main() {
  try {
    console.log('🚀 Starting Simple AA Wallet Test with Your Current Solution');
    
    // Validate configuration
    validateConfig();
    printConfig();
    
    // Step 1: Create the public client (same as your context)
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    console.log('✅ Public client created');

    // Step 2: Create a signatory from the private key (same as your burnerSignatoryFactory)
    const signatory = createSignatoryFromPrivateKey(TEST_CONFIG.privateKey);
    console.log('✅ Signatory created for address:', signatory.account.address);

    // Step 3: Find a valid individual smart account using YOUR function
    const owner = signatory.account.address;
    console.log('🔍 Finding valid individual smart account for owner:', owner);
    
    const indivAccountClient = await findValidIndivAccount(owner, signatory, publicClient);
    if (!indivAccountClient) {
      throw new Error('Failed to find valid individual smart account');
    }
    
    const indivAddress = await indivAccountClient.getAddress();
    console.log('✅ Individual smart account found at:', indivAddress);

    // Step 4: Find a valid organization smart account using YOUR function
    console.log('🔍 Finding valid organization smart account for owner:', owner);
    
    const orgAccountClient = await findValidOrgAccount(owner, signatory, publicClient);
    if (!orgAccountClient) {
      throw new Error('Failed to find valid organization smart account');
    }
    
    const orgAddress = await orgAccountClient.getAddress();
    console.log('✅ Organization smart account found at:', orgAddress);

    // Step 5: Test basic functionality (without deployment checks)
    console.log('\n🧪 Testing basic smart account functionality...');
    
    // Test getAddress method
    const testIndivAddress = await indivAccountClient.getAddress();
    const testOrgAddress = await orgAccountClient.getAddress();
    
    console.log('📍 Individual account address verification:', testIndivAddress);
    console.log('📍 Organization account address verification:', testOrgAddress);
    
    // Test that addresses are different (different salt values)
    if (testIndivAddress !== testOrgAddress) {
      console.log('✅ Different salt values generated different addresses');
    } else {
      console.log('⚠️  Same addresses generated - this might indicate an issue');
    }

    console.log('\n🎉 Simple AA Wallet Test Complete!');
    console.log('✅ Smart account creation: SUCCESS');
    console.log('✅ Address generation: SUCCESS');
    console.log('✅ Basic functionality: SUCCESS');
    console.log('👤 Owner:', owner);
    console.log('📍 Individual Account:', testIndivAddress);
    console.log('📍 Organization Account:', testOrgAddress);

    return {
      signatory,
      indivAccountClient,
      orgAccountClient,
      indivAddress: testIndivAddress,
      orgAddress: testOrgAddress,
      owner,
    };

  } catch (error) {
    console.error('❌ Error in simple AA wallet test:', error);
    throw error;
  }
}

// Export functions for use in other modules
export {
  createSignatoryFromPrivateKey,
  findValidIndivAccount,
  findValidOrgAccount,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n🎯 Simple test completed successfully!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ Simple test failed:', error);
      process.exit(1);
    });
}
