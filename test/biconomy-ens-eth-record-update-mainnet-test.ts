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
  newEthAddress: process.env.NEW_ETH_ADDRESS as `0x${string}` || 
    '0x2A2A19D1a0ebe0D13e476511fE22b8995b0C0e16' as `0x${string}`,
  setupReverseResolution: process.env.SETUP_REVERSE_RESOLUTION === 'true',
};

// --- Contract Addresses ---
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;

// --- ABIs ---
const registryAbi = parseAbi([
  'function resolver(bytes32 node) view returns (address)',
  'function owner(bytes32 node) view returns (address)',
]);

const resolverAbi = parseAbi([
  'function setAddr(bytes32 node, address a)',
  'function addr(bytes32 node) view returns (address)',
  'function name(bytes32 node) view returns (string)',
]);

// Reverse resolver ABI for checking and setting ETH -> ENS mapping
const reverseResolverAbi = parseAbi([
  'function name(bytes32 node) view returns (string)',
  'function setName(bytes32 node, string name)',
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
 * Check if reverse resolution is configured for an ETH address
 */
async function checkReverseResolution(
  publicClient: any,
  ethAddress: `0x${string}`
): Promise<{ isConfigured: boolean; ensName?: string; error?: string }> {
  try {
    // Calculate the reverse namehash for the ETH address
    // Format: addr.reverse (e.g., 0x1234... -> 0x1234...addr.reverse)
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
      return { isConfigured: false, error: 'No reverse resolver set' };
    }
    
    console.log(`📍 Reverse resolver: ${reverseResolverAddr}`);
    
    // Try to read the name from the reverse resolver
    try {
      const ensName = await publicClient.readContract({
        address: reverseResolverAddr,
        abi: reverseResolverAbi,
        functionName: 'name',
        args: [reverseNode],
      }) as string;
      
      if (ensName && ensName !== '') {
        console.log(`✅ Reverse resolution configured: ${ensName}`);
        return { isConfigured: true, ensName };
      } else {
        console.log('⚠️  Reverse resolver exists but no name set');
        return { isConfigured: false, error: 'Resolver exists but no name configured' };
      }
    } catch (readError) {
      console.log('⚠️  Error reading reverse name:', readError);
      return { isConfigured: false, error: `Failed to read name: ${readError}` };
    }
    
  } catch (error) {
    console.error('❌ Error checking reverse resolution:', error);
    return { isConfigured: false, error: `Check failed: ${error}` };
  }
}

/**
 * Set up reverse resolution for an ETH address to point to an ENS name
 */
async function setupReverseResolution(
  publicClient: any,
  ethAddress: `0x${string}`,
  ensName: string
): Promise<{ success: boolean; error?: string; reverseNode?: string }> {
  try {
    console.log(`🔧 Setting up reverse resolution for ${ethAddress} -> ${ensName}`);
    
    // Calculate the reverse namehash for the ETH address
    const reverseName = `${ethAddress.slice(2).toLowerCase()}.addr.reverse`;
    const reverseNode = namehash(reverseName);
    
    console.log(`📍 Reverse name: ${reverseName}`);
    console.log(`📍 Reverse node: ${reverseNode}`);
    
    // Check if there's already a resolver set for the reverse node
    const existingResolverAddr = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'resolver',
      args: [reverseNode],
    }) as `0x${string}`;
    
    if (existingResolverAddr === '0x0000000000000000000000000000000000000000') {
      console.log('⚠️  No reverse resolver set. You need to set a resolver first.');
      console.log('💡 To set up reverse resolution, you need to:');
      console.log('   1. Set a resolver for the reverse node via the ENS Registry');
      console.log('   2. Call setName() on that resolver');
      console.log('   This requires additional transactions and permissions.');
      return { 
        success: false, 
        error: 'No reverse resolver set. Manual setup required via ENS Registry.' 
      };
    }
    
    console.log(`📍 Using existing reverse resolver: ${existingResolverAddr}`);
    
    // Check if the reverse node is owned by the ETH address owner
    const reverseNodeOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'owner',
      args: [reverseNode],
    }) as `0x${string}`;
    
    console.log(`📍 Reverse node owner: ${reverseNodeOwner}`);
    
    if (reverseNodeOwner.toLowerCase() !== ethAddress.toLowerCase()) {
      console.log('⚠️  Reverse node is not owned by the ETH address');
      console.log('💡 The reverse node must be owned by the ETH address to set reverse resolution');
      return { 
        success: false, 
        error: 'Reverse node not owned by ETH address. Cannot set reverse resolution.' 
      };
    }
    
    console.log('✅ Reverse node ownership verified');
    console.log('💡 Reverse resolution can be set up via setName() call');
    console.log('   This would require a separate transaction to the reverse resolver');
    
    return { 
      success: true, 
      reverseNode,
      error: 'Manual setup required - call setName() on reverse resolver'
    };
    
  } catch (error) {
    console.error('❌ Error setting up reverse resolution:', error);
    return { 
      success: false, 
      error: `Setup failed: ${error}` 
    };
  }
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
  if (!process.env.NEW_ETH_ADDRESS) {
    errors.push('NEW_ETH_ADDRESS environment variable is required');
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
    console.log(`   New ETH Address: ${MAINNET_CONFIG.newEthAddress}`);
    console.log(`   Setup Reverse Resolution: ${MAINNET_CONFIG.setupReverseResolution ? 'Yes' : 'No'}`);
    console.log(`   Owner Private Key: ${MAINNET_CONFIG.ownerPrivateKey ? 'Set' : 'Not set'}`);
    console.log('');
}

/**
 * Main function to update ENS ETH record via Biconomy smart account
 */
async function main(): Promise<{
  ensName: string;
  oldEthAddress: string;
  newEthAddress: string;
  transactionHash: string;
  message: string;
  status: string;
}> {
  try {
    console.log('🚀 Starting Biconomy ENS ETH Record Update Test...');
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
    
    // Step 4: Calculate ENS namehash
    console.log('🔍 Calculating ENS namehash...');
    const ensName = `${MAINNET_CONFIG.ensName}.eth`;
    const node = namehash(ensName);
    console.log(`📍 ENS Name: ${ensName}`);
    console.log(`📍 Namehash: ${node}`);
    
    // Step 5: Read current resolver and owner
    console.log('🔍 Reading current ENS configuration...');
    
    // Read resolver address from registry
    const resolverAddr = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'resolver',
      args: [node],
    }) as `0x${string}`;
    
    console.log(`📍 Resolver Address: ${resolverAddr}`);
    
    if (resolverAddr === '0x0000000000000000000000000000000000000000') {
      throw new Error('Name has no resolver set. Set resolver first (via registry) before AA call.');
    }
    
    // Read current owner
    const currentOwner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'owner',
      args: [node],
    }) as `0x${string}`;
    
    console.log(`📍 Current ENS Owner: ${currentOwner}`);
    
    // Read current ETH address
    const currentEthAddr = await publicClient.readContract({
      address: resolverAddr,
      abi: resolverAbi,
      functionName: 'addr',
      args: [node],
    }) as `0x${string}`;
    
    console.log(`📍 Current ETH Address: ${currentEthAddr}`);
    console.log(`📍 New ETH Address: ${MAINNET_CONFIG.newEthAddress}`);
    
    // Step 6: Check reverse resolution for current and new ETH addresses
    console.log('🔍 Checking reverse resolution configuration...');
    
    // Declare variables in wider scope
    let currentReverseCheck: { isConfigured: boolean; ensName?: string; error?: string } | null = null;
    let newReverseCheck: { isConfigured: boolean; ensName?: string; error?: string };
    
    // Check current ETH address reverse resolution
    if (currentEthAddr !== '0x0000000000000000000000000000000000000000') {
      currentReverseCheck = await checkReverseResolution(publicClient, currentEthAddr);
      if (currentReverseCheck.isConfigured) {
        console.log(`📍 Current ETH address reverse resolution: ${currentReverseCheck.ensName}`);
      } else {
        console.log(`📍 Current ETH address reverse resolution: Not configured (${currentReverseCheck.error})`);
      }
    } else {
      console.log('📍 Current ETH address: No address set');
    }
    
    // Check new ETH address reverse resolution
    newReverseCheck = await checkReverseResolution(publicClient, MAINNET_CONFIG.newEthAddress);
    if (newReverseCheck.isConfigured) {
      console.log(`📍 New ETH address reverse resolution: ${newReverseCheck.ensName}`);
    } else {
      console.log(`📍 New ETH address reverse resolution: Not configured (${newReverseCheck.error})`);
    }
    
    // Step 7: Check if update is needed
    if (currentEthAddr.toLowerCase() === MAINNET_CONFIG.newEthAddress.toLowerCase()) {
      console.log('✅ ETH address is already set to the target address');
      console.log('📋 Reverse resolution summary:');
      console.log(`   Current ETH address (${currentEthAddr}): ${currentReverseCheck ? (currentReverseCheck.isConfigured ? currentReverseCheck.ensName : 'Not configured') : 'No address set'}`);
      console.log(`   New ETH address (${MAINNET_CONFIG.newEthAddress}): ${newReverseCheck.isConfigured ? newReverseCheck.ensName : 'Not configured'}`);
      
      // Even if no update is needed, we can still set up reverse resolution
      if (MAINNET_CONFIG.setupReverseResolution) {
        console.log('🔧 Setting up reverse resolution as requested (no ETH address change needed)...');
        const reverseSetupResult = await setupReverseResolution(publicClient, currentEthAddr, ensName);
        
        if (reverseSetupResult.success) {
          console.log('✅ Reverse resolution setup analysis completed');
          console.log(`📍 Reverse node: ${reverseSetupResult.reverseNode}`);
          console.log(`📍 Status: ${reverseSetupResult.error || 'Ready for manual setup'}`);
        } else {
          console.log('⚠️  Reverse resolution setup analysis failed');
          console.log(`📍 Error: ${reverseSetupResult.error}`);
        }
      } else {
        console.log('ℹ️  Reverse resolution setup skipped (not requested)');
      }
      
      return {
        ensName,
        oldEthAddress: currentEthAddr,
        newEthAddress: MAINNET_CONFIG.newEthAddress,
        transactionHash: 'N/A',
        message: 'ETH address already set to target address',
        status: 'no_change_needed'
      };
    }
    
    // Step 8: Encode setAddr call
    console.log('🔧 Encoding setAddr function call...');
    const data = encodeFunctionData({
      abi: resolverAbi,
      functionName: 'setAddr',
      args: [node, MAINNET_CONFIG.newEthAddress],
    });
    
    console.log('🔧 Transaction details:');
    console.log(`   Function: setAddr`);
    console.log(`   To: ${resolverAddr}`);
    console.log(`   Node: ${node}`);
    console.log(`   New ETH Address: ${MAINNET_CONFIG.newEthAddress}`);
    console.log(`   Encoded data: ${data}`);
    
    // Step 9: Send transaction via smart account
    console.log('📤 Sending ENS ETH record update transaction...');
    
    let transactionResponse;
    try {
      transactionResponse = await sa.sendTransaction({ 
        to: resolverAddr, 
        data, 
        value: 0n 
      });
      console.log('✅ Transaction sent successfully');
    } catch (error) {
      console.error('❌ Error sending transaction:', error);
      throw new Error(`Failed to send ENS update transaction: ${error}`);
    }
    
    console.log('✅ Transaction sent via smart account');
    console.log(`📍 Transaction response:`, transactionResponse);
    
    // Step 10: Wait for transaction confirmation
    console.log('⏳ Waiting for transaction confirmation...');
    let receipt;
    try {
      receipt = await transactionResponse.wait();
      
      // Check if this is a UserOp receipt (Biconomy style)
      if (receipt && typeof receipt === 'object' && 'userOpHash' in receipt) {
        console.log('✅ User Operation completed!');
        console.log(`📍 UserOp Hash: ${receipt.userOpHash}`);
        console.log(`📍 Success: ${receipt.success}`);
        console.log(`📍 Gas Cost: ${receipt.actualGasCost} wei (${Number(receipt.actualGasCost) / 1e18} ETH)`);
        console.log(`📍 Gas Used: ${receipt.actualGasUsed}`);
        
        // Extract transaction hash from logs if available
        if (receipt.logs && receipt.logs.length > 0 && receipt.logs[0].transactionHash) {
          console.log(`📍 Transaction Hash: ${receipt.logs[0].transactionHash}`);
          console.log(`📍 Block Number: ${receipt.logs[0].blockNumber}`);
        }
        
        // Check if the operation failed
        if (receipt.success === 'false') {
          console.error('❌ User Operation failed!');
          console.log(`📍 Reason: ${receipt.reason || 'No reason provided'}`);
          console.log('📍 Full receipt:', receipt);
          throw new Error(`User Operation failed: ${receipt.reason || 'Unknown error'}`);
        }
        
      } else {
        // Regular transaction receipt
        console.log('✅ ENS update transaction confirmed!');
        console.log(`📍 Transaction hash: ${receipt.transactionHash}`);
        console.log(`📍 Block number: ${receipt.blockNumber}`);
        console.log(`📍 Gas used: ${receipt.gasUsed}`);
      }
      
    } catch (error) {
      console.error('❌ Error waiting for transaction confirmation:', error);
      console.log('📍 Transaction response:', transactionResponse);
      throw new Error(`Failed to confirm ENS update transaction: ${error}`);
    }
    
    // Step 11: Verify the update
    console.log('🔍 Verifying ENS ETH record update...');
    
    // Wait a bit for the blockchain to update
    console.log('⏳ Waiting for blockchain state to update...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const newEthAddr = await publicClient.readContract({
      address: resolverAddr,
      abi: resolverAbi,
      functionName: 'addr',
      args: [node],
    }) as `0x${string}`;
    
    console.log(`📍 New ETH Address: ${newEthAddr}`);
    console.log(`📍 Expected: ${MAINNET_CONFIG.newEthAddress}`);
    
    if (newEthAddr.toLowerCase() !== MAINNET_CONFIG.newEthAddress.toLowerCase()) {
      throw new Error(`ENS ETH record update failed. New address: ${newEthAddr}, Expected: ${MAINNET_CONFIG.newEthAddress}`);
    }
    
    console.log('✅ ENS ETH record update verified successfully!');
    
    // Step 12: Check reverse resolution after update
    console.log('🔍 Checking reverse resolution after update...');
    const finalReverseCheck = await checkReverseResolution(publicClient, newEthAddr);
    if (finalReverseCheck.isConfigured) {
      console.log(`📍 Final reverse resolution: ${finalReverseCheck.ensName}`);
    } else {
      console.log(`📍 Final reverse resolution: Not configured (${finalReverseCheck.error})`);
    }
    
    // Step 13: Set up reverse resolution if requested
    if (MAINNET_CONFIG.setupReverseResolution) {
      console.log('🔧 Setting up reverse resolution as requested...');
      const reverseSetupResult = await setupReverseResolution(publicClient, newEthAddr, ensName);
      
      if (reverseSetupResult.success) {
        console.log('✅ Reverse resolution setup analysis completed');
        console.log(`📍 Reverse node: ${reverseSetupResult.reverseNode}`);
        console.log(`📍 Status: ${reverseSetupResult.error || 'Ready for manual setup'}`);
      } else {
        console.log('⚠️  Reverse resolution setup analysis failed');
        console.log(`📍 Error: ${reverseSetupResult.error}`);
      }
    } else {
      console.log('ℹ️  Reverse resolution setup skipped (not requested)');
    }
    
    // Step 14: Final summary
    console.log('\n🎉 Biconomy ENS ETH Record Update Test Complete!');
    console.log('✅ ENS ETH record updated successfully via smart account');
    console.log(`📍 ENS Name: ${ensName}`);
    console.log(`📍 Old ETH Address: ${currentEthAddr}`);
    console.log(`📍 New ETH Address: ${newEthAddr}`);
    console.log(`📍 Smart Account: ${smartAccountAddress}`);
    console.log(`📍 Transaction Hash: ${receipt.logs?.[0]?.transactionHash || receipt.transactionHash || 'N/A'}`);
    console.log(`📍 Reverse Resolution: ${finalReverseCheck.isConfigured ? finalReverseCheck.ensName : 'Not configured'}`);
    console.log(`📍 Reverse Setup Requested: ${MAINNET_CONFIG.setupReverseResolution ? 'Yes' : 'No'}`);
    console.log('\n⚠️  REMINDER: This ran on Ethereum Mainnet');
    console.log('   ENS updates cost real ETH');
    
    return {
      ensName,
      oldEthAddress: currentEthAddr,
      newEthAddress: newEthAddr,
      transactionHash: receipt.logs?.[0]?.transactionHash || receipt.transactionHash || 'N/A',
      message: 'ENS ETH record updated successfully via Biconomy smart account',
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ Error in Biconomy ENS ETH record update test:', error);
    throw error;
  }
}

// Export functions for use in other modules
export {
  createBiconomySmartAccount,
  main,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('\n🎯 Biconomy ENS ETH record update test completed successfully!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ Biconomy ENS ETH record update test failed:', error);
      process.exit(1);
    });
}
