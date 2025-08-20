import { 
  createPublicClient, 
  http, 
  zeroAddress
} from 'viem';
import { 
  privateKeyToAccount, 
  type PrivateKeyAccount 
} from 'viem/accounts';
import { 
  createSmartAccountClient 
} from '@biconomy/account';
import { mainnet } from 'viem/chains';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Mainnet Configuration
const MAINNET_CONFIG = {
  chain: mainnet,
  chainId: 1,
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  privateKey: process.env.MAINNET_FROM_PRIVATE_KEY as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
  bundlerUrl: process.env.BICONOMY_BUNDLER_URL || 'https://bundler.biconomy.io/api/v3/1/native',
};

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
 * Main function to create and deploy Biconomy smart account
 */
async function main(): Promise<{
  deployedAddress: string;
  message: string;
  status: string;
}> {
  try {
    console.log('🚀 Starting Biconomy Smart Account Deployment...');
    console.log('⚠️  WARNING: This will run on Ethereum Mainnet');
    console.log('   Any transactions will cost real ETH');
    console.log('');
    
    // Validate configuration
    if (!MAINNET_CONFIG.privateKey || MAINNET_CONFIG.privateKey === '0x1234567890123456789012345678901234567890123456789012345678901234') {
      throw new Error('MAINNET_FROM_PRIVATE_KEY is required');
    }
    
    if (!MAINNET_CONFIG.bundlerUrl) {
      throw new Error('BICONOMY_BUNDLER_URL is required');
    }
    
    console.log('🔧 Configuration:');
    console.log(`   Chain: mainnet (ID: ${MAINNET_CONFIG.chainId})`);
    console.log(`   RPC URL: ${MAINNET_CONFIG.rpcUrl}`);
    console.log(`   Bundler URL: ${MAINNET_CONFIG.bundlerUrl}`);
    console.log(`   Private Key: ${MAINNET_CONFIG.privateKey ? 'Set' : 'Not set'}`);
    console.log('');
    
    // Step 1: Create the smart account client
    console.log('🔍 Creating Biconomy smart account client...');
    const sa = await createBiconomySmartAccount(MAINNET_CONFIG.privateKey);
    
    // Step 2: Get the counterfactual address (for funding, if self-pay)
    const saAddress = await sa.getAccountAddress();
    console.log("📍 Smart Account Address:", saAddress);
    
    // Step 3: Check if the account is already deployed
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });

    const code = await publicClient.getBytecode({ address: saAddress });
    if (code && code !== '0x') {
      console.log('✅ Smart account is already deployed!');
      return {
        deployedAddress: saAddress,
        message: 'Smart account already deployed',
        status: 'already_deployed'
      };
    }
    
    // Step 4: Check balance
    const balance = await publicClient.getBalance({ address: saAddress });
    console.log(`📍 Smart account balance: ${balance} wei (${Number(balance) / 1e18} ETH)`);
    
    if (balance === 0n) {
      console.log('⚠️  Smart account has no ETH balance');
      console.log('💡 To deploy, send some ETH to:', saAddress);
      console.log('📍 Recommended amount: 0.005-0.01 ETH');
      
      return {
        deployedAddress: saAddress,
        message: 'Smart account needs ETH funding to deploy',
        status: 'needs_funding'
      };
    }

    // Step 5: Deploy the smart account
    console.log('📤 Deploying smart account...');
    
    try {
      // Use the built-in deploy method which works reliably
      console.log('🔧 Using deploy() method for deployment...');
      const deployTx = await sa.deploy();
      console.log('✅ Smart account deployment transaction sent');
      
      // Wait for deployment confirmation
      const receipt = await deployTx.wait();
      console.log('✅ Smart account contract deployed to mainnet!');
      console.log('📍 Deployment completed successfully');
      console.log(`📍 Transaction hash: ${receipt.transactionHash}`);
      
    } catch (deployError) {
      console.log('⚠️  deploy() method failed:', deployError);
      console.log('💡 Trying alternative deployment approach...');
      
      // Alternative: Try using sendTransaction with init code
      try {
        console.log('🔧 Attempting deployment with sendTransaction...');
        const { wait } = await sa.sendTransaction({
          to: zeroAddress as `0x${string}`,
          value: 0n,
          data: '0x'
        });
        
        const receipt = await wait();
        console.log('✅ Smart account contract deployed to mainnet!');
        console.log('📍 Deployment completed successfully');
        console.log(`📍 Transaction hash: ${receipt.transactionHash}`);
        
      } catch (sendError) {
        throw new Error(`All deployment methods failed. Deploy error: ${deployError}, Send error: ${sendError}`);
      }
    }
    
    console.log('\n🎉 Biconomy Smart Account Deployment Complete!');
    console.log('✅ Smart account created and deployed successfully');
    console.log(`📍 Smart account address: ${saAddress}`);
    console.log('\n⚠️  REMINDER: This ran on Ethereum Mainnet');
    console.log('   Smart account deployment cost real ETH');
    
    return {
      deployedAddress: saAddress,
      message: 'Smart account created and deployed successfully',
      status: 'deployed'
    };
    
  } catch (error) {
    console.error('❌ Error in Biconomy smart account deployment:', error);
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
      console.log('\n🎯 Biconomy deployment completed successfully!');
      console.log('Result:', result);
    })
    .catch((error) => {
      console.error('❌ Biconomy deployment failed:', error);
      process.exit(1);
    });
}
