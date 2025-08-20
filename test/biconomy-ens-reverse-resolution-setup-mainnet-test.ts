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

// --- ABIs ---
const registryAbi = parseAbi([
  'function resolver(bytes32 node) view returns (address)',
  'function owner(bytes32 node) view returns (address)',
  'function setResolver(bytes32 node, address resolver)',
]);

const publicResolverAbi = parseAbi([
  'function setName(bytes32 node, string name)',
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
    // Calculate the reverse namehash for the ETH address
    const reverseName = `${ethAddress.slice(2).toLowerCase()}.addr.reverse`;
    const reverseNode = namehash(reverseName);
    
    console.log(`🔍 Checking reverse resolution for ${ethAddress}`);
    console.log(`📍 Reverse name: ${reverseName}`);
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Check if there's a resolver set for the reverse node
    const reverseResolverAddr = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
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
    
    // Calculate the reverse namehash
    const reverseName = `${ethAddress.slice(2).toLowerCase()}.addr.reverse`;
    const reverseNode = namehash(reverseName);
    
    console.log(`📍 Reverse name: ${reverseName}`);
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Step 1: Check current status
    const currentStatus = await checkReverseResolution(publicClient, ethAddress);
    
    if (currentStatus.isConfigured) {
      console.log('✅ Reverse resolution already configured!');
      return { success: true, steps: ['Already configured'] };
    }
    
    // Step 2: Check if we own the reverse node
    const reverseNodeOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'owner',
      args: [reverseNode],
    }) as `0x${string}`;
    
    console.log(`📍 Reverse node owner: ${reverseNodeOwner}`);
    console.log(`📍 ETH address: ${ethAddress}`);
    
    if (reverseNodeOwner.toLowerCase() !== ethAddress.toLowerCase()) {
      console.log('⚠️  Reverse node is not owned by the ETH address');
      console.log('💡 You need to own the reverse node to set up reverse resolution');
      console.log('   This typically requires claiming the reverse node first');
      return { 
        success: false, 
        error: 'Reverse node not owned by ETH address. Claim the reverse node first.' 
      };
    }
    
    console.log('✅ Reverse node ownership verified');
    
    // Step 3: Set resolver for the reverse node
    console.log('🔧 Step 1: Setting resolver for reverse node...');
    
    const setResolverData = encodeFunctionData({
      abi: registryAbi,
      functionName: 'setResolver',
      args: [reverseNode, MAINNET_CONFIG.publicResolver],
    });
    
    console.log(`📍 Setting resolver: ${MAINNET_CONFIG.publicResolver}`);
    console.log(`📍 Encoded data: ${setResolverData}`);
    
    let setResolverTx;
    try {
      setResolverTx = await smartAccount.sendTransaction({
        to: ENS_REGISTRY,
        data: setResolverData,
        value: 0n
      });
      console.log('✅ Set resolver transaction sent');
    } catch (error) {
      console.error('❌ Error setting resolver:', error);
      return { success: false, error: `Failed to set resolver: ${error}` };
    }
    
    // Wait for resolver transaction
    console.log('⏳ Waiting for resolver transaction confirmation...');
    let resolverReceipt;
    try {
      resolverReceipt = await setResolverTx.wait();
      
      if (resolverReceipt && typeof resolverReceipt === 'object' && 'userOpHash' in resolverReceipt) {
        console.log('✅ Resolver UserOp completed!');
        console.log(`📍 UserOp Hash: ${resolverReceipt.userOpHash}`);
        console.log(`📍 Success: ${resolverReceipt.success}`);
        
        if (resolverReceipt.success === 'false') {
          throw new Error(`Resolver UserOp failed: ${resolverReceipt.reason || 'Unknown error'}`);
        }
      } else {
        console.log('✅ Resolver transaction confirmed!');
        console.log(`📍 Transaction hash: ${resolverReceipt.transactionHash}`);
      }
    } catch (error) {
      console.error('❌ Error confirming resolver transaction:', error);
      return { success: false, error: `Failed to confirm resolver transaction: ${error}` };
    }
    
    // Step 4: Wait for blockchain state to update
    console.log('⏳ Waiting for blockchain state to update...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 5: Set the name on the resolver
    console.log('🔧 Step 2: Setting name on resolver...');
    
    const setNameData = encodeFunctionData({
      abi: publicResolverAbi,
      functionName: 'setName',
      args: [reverseNode, ensName],
    });
    
    console.log(`📍 Setting name: ${ensName}`);
    console.log(`📍 Encoded data: ${setNameData}`);
    
    let setNameTx;
    try {
      setNameTx = await smartAccount.sendTransaction({
        to: MAINNET_CONFIG.publicResolver,
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
    
    // Step 6: Verify the setup
    console.log('🔍 Verifying reverse resolution setup...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalCheck = await checkReverseResolution(publicClient, ethAddress);
    
    if (finalCheck.isConfigured && finalCheck.ensName === ensName) {
      console.log('✅ Reverse resolution setup completed successfully!');
      return { 
        success: true, 
        steps: [
          'Set resolver for reverse node',
          'Set name on resolver',
          'Verification passed'
        ]
      };
    } else {
      console.log('⚠️  Reverse resolution setup may have failed');
      console.log(`📍 Expected: ${ensName}`);
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
  console.log(`   ENS Name: ${MAINNET_CONFIG.ensName}`);
  console.log(`   ETH Address: ${MAINNET_CONFIG.ethAddress}`);
  console.log(`   Public Resolver: ${MAINNET_CONFIG.publicResolver}`);
  console.log(`   Owner Private Key: ${MAINNET_CONFIG.ownerPrivateKey ? 'Set' : 'Not set'}`);
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
      return {
        ensName: MAINNET_CONFIG.ensName,
        ethAddress: MAINNET_CONFIG.ethAddress,
        success: true,
        steps: ['Already configured'],
        message: 'Reverse resolution already configured',
        status: 'already_configured'
      };
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
        ensName: MAINNET_CONFIG.ensName,
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
