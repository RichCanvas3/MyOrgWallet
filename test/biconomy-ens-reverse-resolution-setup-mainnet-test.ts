import 'dotenv/config';
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from '@biconomy/account';

// --- Environment Configuration ---
const MAINNET_CONFIG = {
  chain: mainnet,
  chainId: 1,
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  ownerPrivateKey: process.env.OWNER_PK as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
  bundlerUrl: process.env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io/api/v3/1/native',
  ensName: process.env.MAINNET_ENS_NAME || 'example',
  ethAddress: process.env.ETH_ADDRESS as `0x${string}` || 
    '0x2A2A19D1a0ebe0D13e476511fE22b8995b0C0e16' as `0x${string}`,
  publicResolver: process.env.PUBLIC_RESOLVER_ADDRESS as `0x${string}` || 
    '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as `0x${string}`,
};

// --- Contract Addresses ---
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const REVERSE_REGISTRAR = '0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb' as const;

// --- ABIs ---
const ensRegistryAbi = parseAbi([
  'function resolver(bytes32 node) view returns (address)',
  'function owner(bytes32 node) view returns (address)',
]);

const reverseRegistrarAbi = parseAbi([
  'function claim(address owner) returns (bytes32)',
  'function claimWithResolver(address owner, address resolver) returns (bytes32)',
  'function setName(string name) returns (bytes32)',
  'function node(address addr) view returns (bytes32)',
]);

// --- Helper Functions ---
/**
 * Ensures ENS name has .eth suffix
 */
function ensureEthSuffix(name: string): string {
  return name.endsWith('.eth') ? name : `${name}.eth`;
}

const publicResolverAbi = parseAbi([
  'function setName(bytes32 node, string name)',
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
]);

/**
 * Creates a Biconomy smart account client
 */
async function createBiconomySmartAccount(
  privateKey: `0x${string}`
): Promise<any> {
  try {
    // Create a signer from the private key
    const signer = privateKeyToAccount(privateKey);
    
    // Create smart account client
    const sa = await createSmartAccountClient({
      signer,
      chainId: MAINNET_CONFIG.chainId,
      rpcUrl: MAINNET_CONFIG.rpcUrl,
      bundlerUrl: MAINNET_CONFIG.bundlerUrl,
    });
    
    console.log('✅ Created Biconomy Smart Account Client');
    return sa;
  } catch (error) {
    console.error('❌ Error creating Biconomy Smart Account Client:', error);
    throw error;
  }
}

/**
 * Check current reverse resolution status
 */
async function checkReverseResolution(
  publicClient: any,
  ethAddress: `0x${string}`
): Promise<{ isConfigured: boolean; ensName?: string; error?: string; reverseNode?: string }> {
  try {
    // Get the reverse node from the Reverse Registrar
    const reverseNode = await publicClient.readContract({
      address: REVERSE_REGISTRAR,
      abi: reverseRegistrarAbi,
      functionName: 'node',
      args: [ethAddress],
    }) as `0x${string}`;
    
    console.log(`🔍 Checking reverse resolution for ${ethAddress}`);
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Check if there's a resolver set for the reverse node
    // We need to check the ENS Registry for the resolver, not the Reverse Registrar
    const reverseResolverAddr = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: ensRegistryAbi,
      functionName: 'resolver',
      args: [reverseNode],
    }) as `0x${string}`;
    
    if (reverseResolverAddr === '0x0000000000000000000000000000000000000000') {
      console.log('⚠️  No reverse resolver configured');
      return { isConfigured: false, error: 'No reverse resolver set', reverseNode };
    }
    
    console.log(`📍 Reverse resolver: ${reverseResolverAddr}`);
    
    // Try to read the name from the reverse resolver
    try {
      const ensName = await publicClient.readContract({
        address: reverseResolverAddr,
        abi: publicResolverAbi,
        functionName: 'name',
        args: [reverseNode],
      }) as string;
      
      if (ensName && ensName !== '') {
        console.log(`✅ Reverse resolution configured: ${ensName}`);
        return { isConfigured: true, ensName, reverseNode };
      } else {
        console.log('⚠️  Reverse resolver exists but no name set');
        return { isConfigured: false, error: 'Resolver exists but no name configured', reverseNode };
      }
    } catch (readError) {
      console.log('⚠️  Error reading reverse name:', readError);
      return { isConfigured: false, error: `Failed to read name: ${readError}`, reverseNode };
    }
    
  } catch (error) {
    console.error('❌ Error checking reverse resolution:', error);
    return { isConfigured: false, error: `Check failed: ${error}` };
  }
}

/**
 * Set up complete reverse resolution
 */
async function setupCompleteReverseResolution(
  publicClient: any,
  smartAccount: any,
  ethAddress: `0x${string}`,
  ensName: string
): Promise<{ success: boolean; error?: string; steps?: string[] }> {
  try {
    console.log(`🔧 Setting up complete reverse resolution for ${ethAddress} -> ${ensName}`);
    
    // Get the reverse node from the Reverse Registrar
    const reverseNode = await publicClient.readContract({
      address: REVERSE_REGISTRAR,
      abi: reverseRegistrarAbi,
      functionName: 'node',
      args: [ethAddress],
    }) as `0x${string}`;
    
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Step 1: Check current status
    const currentStatus = await checkReverseResolution(publicClient, ethAddress);
    
    if (currentStatus.isConfigured) {
      const expectedName = ensureEthSuffix(ensName);
      if (currentStatus.ensName === expectedName) {
        console.log('✅ Reverse resolution already configured correctly!');
        return { success: true, steps: ['Already configured correctly'] };
      } else {
        console.log(`⚠️  Reverse resolution exists but needs updating:`);
        console.log(`   Current: ${currentStatus.ensName}`);
        console.log(`   Target: ${expectedName}`);
        console.log(`🔧 Proceeding to update the reverse name...`);
      }
    }
    
    // Step 2: Claim the reverse node with resolver in one transaction (if not already owned)
    if (!currentStatus.isConfigured) {
      console.log('🔧 Step 1: Claiming reverse node with resolver...');
      
      const claimWithResolverData = encodeFunctionData({
      abi: reverseRegistrarAbi,
      functionName: 'claimWithResolver',
      args: [ethAddress, MAINNET_CONFIG.publicResolver],
    });
    
    console.log(`📍 Claiming reverse node for: ${ethAddress}`);
    console.log(`📍 Setting resolver to: ${MAINNET_CONFIG.publicResolver}`);
    console.log(`📍 Encoded data: ${claimWithResolverData}`);
    
    let claimReverseNodeTx;
    try {
      claimReverseNodeTx = await smartAccount.sendTransaction({
        to: REVERSE_REGISTRAR,
        data: claimWithResolverData,
        value: 0n
      });
      console.log('✅ Claim reverse node transaction sent');
    } catch (error) {
      console.error('❌ Error claiming reverse node:', error);
      return { success: false, error: `Failed to claim reverse node: ${error}` };
    }
    
    // Wait for claim transaction
    console.log('⏳ Waiting for reverse node claim transaction confirmation...');
    let claimReceipt;
    try {
      claimReceipt = await claimReverseNodeTx.wait();
      
      if (claimReceipt && typeof claimReceipt === 'object' && 'userOpHash' in claimReceipt) {
        console.log('✅ Claim reverse node UserOp completed!');
        console.log(`📍 UserOp Hash: ${claimReceipt.userOpHash}`);
        console.log(`📍 Success: ${claimReceipt.success}`);
        
        if (claimReceipt.success === 'false') {
          throw new Error(`Claim reverse node UserOp failed: ${claimReceipt.reason || 'Unknown error'}`);
        }
      } else {
        console.log('✅ Claim reverse node transaction confirmed!');
        console.log(`📍 Transaction hash: ${claimReceipt.transactionHash}`);
      }
    } catch (error) {
      console.error('❌ Error confirming claim transaction:', error);
      return { success: false, error: `Failed to confirm claim transaction: ${error}` };
    }
    
    // Wait for blockchain state to update
    console.log('⏳ Waiting for blockchain state to update after claim...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verify ownership was transferred
    const newOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: ensRegistryAbi,
      functionName: 'owner',
      args: [reverseNode],
    }) as `0x${string}`;
    
    if (newOwner.toLowerCase() !== ethAddress.toLowerCase()) {
      console.error('❌ Reverse node ownership verification failed after claim');
      return { success: false, error: 'Reverse node ownership not transferred after claim' };
    }
    
    console.log('✅ Reverse node successfully claimed and ownership verified');
    console.log('✅ Resolver already set during reverse node claim');
    } else {
      console.log('✅ Reverse node already owned, proceeding to update name...');
    }
    
    // Step 3: Set the name on the resolver
    if (!currentStatus.isConfigured) {
      console.log('🔧 Step 2: Setting name on resolver...');
    } else {
      console.log('🔧 Step 1: Updating reverse name...');
    }
    
    // Ensure the ENS name includes the .eth suffix
    const fullEnsName = ensureEthSuffix(ensName);
    
    const setNameData = encodeFunctionData({
      abi: reverseRegistrarAbi,
      functionName: 'setName',
      args: [fullEnsName],
    });
    
    console.log(`📍 Setting name: ${fullEnsName}`);
    console.log(`📍 Encoded data: ${setNameData}`);
    
    let setNameTx;
    try {
      setNameTx = await smartAccount.sendTransaction({
        to: REVERSE_REGISTRAR,
        data: setNameData,
        value: 0n
      });
      console.log('✅ Set name transaction sent');
    } catch (error) {
      console.error('❌ Error setting name:', error);
      return { success: false, error: `Failed to set name: ${error}` };
    }
    
    // Wait for name transaction
    console.log('⏳ Waiting for name transaction confirmation...');
    let nameReceipt;
    try {
      nameReceipt = await setNameTx.wait();
      
      if (nameReceipt && typeof nameReceipt === 'object' && 'userOpHash' in nameReceipt) {
        console.log('✅ Set name UserOp completed!');
        console.log(`📍 UserOp Hash: ${nameReceipt.userOpHash}`);
        console.log(`📍 Success: ${nameReceipt.success}`);
        
        if (nameReceipt.success === 'false') {
          throw new Error(`Set name UserOp failed: ${nameReceipt.reason || 'Unknown error'}`);
        }
      } else {
        console.log('✅ Set name transaction confirmed!');
        console.log(`📍 Transaction hash: ${nameReceipt.transactionHash}`);
      }
    } catch (error) {
      console.error('❌ Error confirming name transaction:', error);
      return { success: false, error: `Failed to confirm name transaction: ${error}` };
    }
    
    // Step 4: Verify the setup
    if (!currentStatus.isConfigured) {
      console.log('🔍 Verifying reverse resolution setup...');
    } else {
      console.log('🔍 Verifying reverse name update...');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalCheck = await checkReverseResolution(publicClient, ethAddress);
    
    if (finalCheck.isConfigured && finalCheck.ensName === fullEnsName) {
      console.log('✅ Reverse resolution setup completed successfully!');
      return { 
        success: true, 
        steps: currentStatus.isConfigured ? [
          'Update reverse name',
          'Verification passed'
        ] : [
          'Claim reverse node with resolver',
          'Set name on resolver',
          'Verification passed'
        ]
      };
    } else {
      console.log('⚠️  Reverse resolution setup may have failed');
      console.log(`📍 Expected: ${fullEnsName}`);
      console.log(`📍 Got: ${finalCheck.ensName || 'Not configured'}`);
      return { 
        success: false, 
        error: 'Setup completed but verification failed' 
      };
    }
    
  } catch (error) {
    console.error('❌ Error setting up complete reverse resolution:', error);
    return { 
      success: false, 
      error: `Setup failed: ${error}` 
    };
  }
}

/**
 * Validate mainnet configuration
 */
function validateMainnetConfig(): void {
  const errors: string[] = [];

  if (!process.env.OWNER_PK) {
    errors.push('OWNER_PK environment variable is required');
  }
  if (!process.env.MAINNET_ENS_NAME) {
    errors.push('MAINNET_ENS_NAME environment variable is required');
  }
  if (!process.env.ETH_ADDRESS) {
    errors.push('ETH_ADDRESS environment variable is required');
  }
  if (!process.env.BICONOMY_BUNDLER_URL) {
    errors.push('BICONOMY_BUNDLER_URL environment variable is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Print mainnet configuration (without sensitive data)
 */
function printMainnetConfig(): void {
  console.log('📋 Mainnet Configuration:');
  console.log(`   Chain: mainnet (ID: ${MAINNET_CONFIG.chainId})`);
  console.log(`   RPC URL: ${MAINNET_CONFIG.rpcUrl}`);
  console.log(`   Bundler URL: ${MAINNET_CONFIG.bundlerUrl}`);
  console.log(`   ENS Name: ${ensureEthSuffix(MAINNET_CONFIG.ensName)}`);
  console.log(`   ETH Address: ${MAINNET_CONFIG.ethAddress}`);
  console.log(`   ENS Registry: ${ENS_REGISTRY}`);
  console.log(`   Public Resolver: ${MAINNET_CONFIG.publicResolver}`);
  console.log(`   Owner Private Key: ${MAINNET_CONFIG.ownerPrivateKey ? 'Set' : 'Not set'}`);
  console.log(`   Reverse Registrar: ${REVERSE_REGISTRAR}`);
  console.log('');
}

/**
 * Main function to set up complete reverse resolution
 */
async function main(): Promise<{
  ensName: string;
  ethAddress: string;
  success: boolean;
  steps?: string[];
  error?: string;
  message: string;
  status: string;
}> {
  try {
    console.log('🚀 Starting Biconomy ENS Reverse Resolution Setup Test...');
    console.log('⚠️  WARNING: This will run on Ethereum Mainnet');
    console.log('   Any transactions will cost real ETH');
    console.log('');
    
    // Validate configuration
    validateMainnetConfig();
    printMainnetConfig();
    
    // Create public client for blockchain interactions
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });
    
    // Step 1: Create Biconomy smart account
    console.log('🔍 Creating Biconomy smart account...');
    const owner = privateKeyToAccount(MAINNET_CONFIG.ownerPrivateKey);
    console.log(`📍 Owner EOA Address: ${owner.address}`);
    
    const sa = await createBiconomySmartAccount(MAINNET_CONFIG.ownerPrivateKey);
    const smartAccountAddress = await sa.getAccountAddress();
    console.log(`📍 Smart Account Address: ${smartAccountAddress}`);
    
    // Step 2: Check if smart account is deployed
    console.log('🔍 Checking smart account deployment status...');
    const smartAccountCode = await publicClient.getBytecode({ address: smartAccountAddress as `0x${string}` });
    
    if (!smartAccountCode || smartAccountCode === '0x') {
      console.log('⚠️  Smart account not deployed, attempting deployment...');
      try {
        const deployTx = await sa.deploy();
        await deployTx.wait();
        console.log('✅ Smart account deployed successfully');
      } catch (deployError) {
        throw new Error(`Failed to deploy smart account: ${deployError}`);
      }
    } else {
      console.log('✅ Smart account already deployed');
    }
    
    // Step 3: Check smart account balance
    console.log('🔍 Checking smart account balance...');
    const balance = await publicClient.getBalance({ address: smartAccountAddress as `0x${string}` });
    console.log(`📍 Smart account balance: ${balance} wei (${Number(balance) / 1e18} ETH)`);
    
    if (balance === 0n) {
      throw new Error('Smart account has no ETH for gas fees');
    }
    
    // Step 4: Check current reverse resolution status
    console.log('🔍 Checking current reverse resolution status...');
    const currentStatus = await checkReverseResolution(publicClient, MAINNET_CONFIG.ethAddress);
    
    if (currentStatus.isConfigured) {
      console.log('✅ Reverse resolution already configured!');
      
      // Check if the existing name needs updating to include .eth suffix
      const expectedName = ensureEthSuffix(MAINNET_CONFIG.ensName);
      if (currentStatus.ensName === expectedName) {
        console.log(`✅ Reverse resolution is correctly configured with: ${expectedName}`);
        return {
          ensName: expectedName,
          ethAddress: MAINNET_CONFIG.ethAddress,
          success: true,
          steps: ['Already configured correctly'],
          message: 'Reverse resolution already configured correctly',
          status: 'already_configured'
        };
      } else {
        console.log(`⚠️  Reverse resolution exists but name needs updating:`);
        console.log(`   Current: ${currentStatus.ensName}`);
        console.log(`   Expected: ${expectedName}`);
        console.log(`🔧 Proceeding to update the reverse name...`);
      }
    }
    
    // Step 5: Set up complete reverse resolution
    console.log('🔧 Setting up complete reverse resolution...');
    const setupResult = await setupCompleteReverseResolution(
      publicClient,
      sa,
      MAINNET_CONFIG.ethAddress,
      MAINNET_CONFIG.ensName
    );
    
    if (setupResult.success) {
      console.log('🎉 Reverse resolution setup completed successfully!');
      console.log(`📍 Steps completed: ${setupResult.steps?.join(', ')}`);
      
      return {
        ensName: ensureEthSuffix(MAINNET_CONFIG.ensName),
        ethAddress: MAINNET_CONFIG.ethAddress,
        success: true,
        steps: setupResult.steps,
        message: 'Reverse resolution setup completed successfully',
        status: 'success'
      };
    } else {
      console.error('❌ Reverse resolution setup failed');
      console.log(`📍 Error: ${setupResult.error}`);
      
      return {
        ensName: MAINNET_CONFIG.ensName,
        ethAddress: MAINNET_CONFIG.ethAddress,
        success: false,
        error: setupResult.error,
        message: 'Reverse resolution setup failed',
        status: 'failed'
      };
    }
    
  } catch (error) {
    console.error('❌ Error in Biconomy ENS reverse resolution setup test:', error);
    throw error;
  }
}

// Export functions for use in other modules
export {
  createBiconomySmartAccount,
  checkReverseResolution,
  setupCompleteReverseResolution,
  main,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n🎯 Biconomy ENS reverse resolution setup test completed!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ Biconomy ENS reverse resolution setup test failed:', error);
      process.exit(1);
    });
}
