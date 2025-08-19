import { createPublicClient, http, encodeFunctionData, toHex, namehash, keccak256, stringToHex } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { Implementation, toMetaMaskSmartAccount, type MetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { mainnet } from 'viem/chains';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Mainnet Configuration
const MAINNET_CONFIG = {
  chain: mainnet,
  chainId: 1,
  chainName: 'mainnet',
  rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  bundlerUrl: process.env.MAINNET_BUNDLER_URL || 'https://bundler.ethpandaops.io',
  fromPrivateKey: process.env.MAINNET_FROM_PRIVATE_KEY as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
  toAAAddress: process.env.MAINNET_TO_AA_ADDRESS as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
  fromAAAddress: process.env.MAINNET_FROM_AA_ADDRESS as `0x${string}` || 
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
  ensName: process.env.MAINNET_ENS_NAME || 'example',
};

// ENS NameWrapper ABI for wrapped ENS NFTs
const NAME_WRAPPER_ABI = [
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }]
  }
];

/**
 * Create a smart account from a private key with a specific seed
 */
async function createSmartAccount(
  privateKey: `0x${string}`,
  seed: number,
  publicClient: any
): Promise<MetaMaskSmartAccount> {
  const account = privateKeyToAccount(privateKey);
  
  console.log(`🔑 Creating smart account for EOA: ${account.address}`);
  console.log(`🌱 Using seed: ${seed} (0x${seed.toString(16)})`);
  
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [account.address, [], [], []],
    signatory: { account },
    deploySalt: `0x${seed.toString(16)}` as `0x${string}`,
  });
  
  const smartAccountAddress = await smartAccount.getAddress();
  console.log(`✅ Smart account created at: ${smartAccountAddress}`);
  
  return smartAccount;
}

/**
 * Create a smart account from a private key and an address
 */
async function createSmartAccountFromAddress(
  privateKey: `0x${string}`,
  address: `0x${string}`,
  publicClient: any
): Promise<MetaMaskSmartAccount> {
  const account = privateKeyToAccount(privateKey);
  console.log(`🔑 Creating smart account for EOA: ${address}`);
  console.log(`🌱 Using private key for: ${address}`);

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    address: address,
    signatory: { account }
  });

  const smartAccountAddress = await smartAccount.getAddress();
  console.log(`✅ Smart account created at: ${smartAccountAddress}`);
  return smartAccount;
}

/**
 * Transfer NFT ownership from one AA to another
 */
async function transferNFT(
  fromAA: MetaMaskSmartAccount,
  toAAAddress: string,
  nftContractAddress: `0x${string}`,
  tokenId: bigint,
  chain: any
): Promise<boolean> {
  try {
    console.log('🚀 Starting NFT transfer...');
    console.log(`📤 From AA: ${await fromAA.getAddress()}`);
    console.log(`📥 To AA Address: ${toAAAddress}`);
    console.log(`🎯 NFT Contract: ${nftContractAddress}`);
    console.log(`🆔 Token ID: ${tokenId}`);
    
    // Create public client
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });
    
    // Create bundler client with paymaster
    const bundlerClient = createBundlerClient({
      transport: http(MAINNET_CONFIG.bundlerUrl),
      paymaster: true,
      chain: chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });
    
    // Encode transfer function
    const transferData = encodeFunctionData({
      abi: NAME_WRAPPER_ABI,
      functionName: 'safeTransferFrom',
      args: [
        await fromAA.getAddress(),
        toAAAddress as `0x${string}`,
        tokenId
      ]
    });
    
    console.log('\n🔍 Transfer Data Debug:');
    console.log(`   Function: safeTransferFrom`);
    console.log(`   From: ${await fromAA.getAddress()}`);
    console.log(`   To: ${toAAAddress}`);
    console.log(`   TokenId: ${tokenId}`);
    console.log(`   Encoded data: ${transferData}`);
    console.log(`   Data length: ${transferData.length} characters`);
    
    // Execute the transfer using bundler client
    console.log('\n🔄 Executing transfer through bundler...');
    
    const transferHash = await bundlerClient.sendUserOperation({
      account: fromAA,
      calls: [{
        to: nftContractAddress,
        data: transferData,
        value: 0n
      }],
      callGasLimit: 500000n,
      verificationGasLimit: 500000n,
      preVerificationGas: 500000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1500000000n,
    });
    
    console.log('⏳ Waiting for transfer transaction...');
    
    // Wait for transaction receipt
    const { receipt } = await bundlerClient.waitForUserOperationReceipt({
      hash: transferHash,
    });
    
    console.log('✅ NFT transfer completed successfully!');
    console.log(`🔗 Transaction hash: ${receipt.transactionHash}`);
    return true;
    
  } catch (error) {
    console.error('❌ NFT transfer failed:', error);
    return false;
  }
}

/**
 * Verify NFT ownership after transfer
 */
async function verifyOwnership(
  nftContractAddress: `0x${string}`,
  tokenId: bigint,
  expectedOwner: `0x${string}`,
  chain: any
): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });
    
    const currentOwner = await publicClient.readContract({
      address: nftContractAddress,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [tokenId]
    }) as `0x${string}`;
    
    const isCorrectOwner = currentOwner.toLowerCase() === expectedOwner.toLowerCase();
    
    console.log(`🔍 Ownership verification:`);
    console.log(`   Expected: ${expectedOwner}`);
    console.log(`   Current:  ${currentOwner}`);
    console.log(`   ✅ Match: ${isCorrectOwner ? 'Yes' : 'No'}`);
    
    return isCorrectOwner;
  } catch (error) {
    console.error('❌ Ownership verification failed:', error);
    return false;
  }
}

// Helper function to get token ID from ENS name
function getTokenId(ensName: string): bigint {
  // For wrapped ENS records in NameWrapper, use the full namehash as the tokenId
  // This matches how the wrapper test handles NameWrapper operations
  const node = namehash(ensName);
  return BigInt(node);
}

// Function to get NameWrapper address based on chain
function getNameWrapperAddress(chainId: number): `0x${string}` {
  switch (chainId) {
    case 1: // Ethereum Mainnet
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`; // Mainnet NameWrapper
    case 11155111: // Sepolia
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`; // Sepolia NameWrapper
    default:
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`; // Default to Mainnet
  }
}

/**
 * Validate mainnet configuration
 */
function validateMainnetConfig(): void {
  const errors: string[] = [];

  // Check required environment variables
  if (!process.env.MAINNET_FROM_PRIVATE_KEY) {
    errors.push('MAINNET_FROM_PRIVATE_KEY environment variable is required');
  }
  if (!process.env.MAINNET_FROM_AA_ADDRESS) {
    errors.push('MAINNET_FROM_AA_ADDRESS environment variable is required');
  }
  if (!process.env.MAINNET_TO_AA_ADDRESS) {
    errors.push('MAINNET_TO_AA_ADDRESS environment variable is required');
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
  console.log(`   Chain: ${MAINNET_CONFIG.chain.name} (ID: ${MAINNET_CONFIG.chain.id})`);
  console.log(`   RPC URL: ${MAINNET_CONFIG.rpcUrl}`);
  console.log(`   Bundler URL: ${MAINNET_CONFIG.bundlerUrl}`);
  console.log(`   ENS Name: ${MAINNET_CONFIG.ensName}`);
  console.log(`   Gas Limit: 500000`);
  console.log(`   Max Priority Fee: 1500000000 wei`);
  console.log(`   Max Fee Per Gas: 20000000000 wei`);
  console.log(`   FROM Private Key: ${MAINNET_CONFIG.fromPrivateKey ? 'Set' : 'Not set'}`);
  console.log(`   FROM AA Address: ${MAINNET_CONFIG.fromAAAddress ? 'Set' : 'Not set'}`);
  console.log(`   TO AA Address: ${MAINNET_CONFIG.toAAAddress ? 'Set' : 'Not set'}`);
  console.log('');
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🚀 Starting Mainnet NFT Transfer Test...');
    console.log('⚠️  WARNING: This test runs on Ethereum Mainnet (real ETH costs)');
    console.log('💰 NFT transfers on mainnet cost real ETH');
    
    // Validate configuration
    validateMainnetConfig();
    printMainnetConfig();
    
    // Create public client
    const publicClient = createPublicClient({
      chain: MAINNET_CONFIG.chain,
      transport: http(MAINNET_CONFIG.rpcUrl),
    });
    
    // Create FROM smart account using private key and AA address directly
    console.log('\n🔧 Creating FROM smart account...');
    const fromAA = await createSmartAccountFromAddress(
      MAINNET_CONFIG.fromPrivateKey,
      MAINNET_CONFIG.fromAAAddress,
      publicClient
    );
    
    // Get TO AA address directly from config
    console.log('\n🔧 Using TO AA address from config...');
    const toAAAddress = MAINNET_CONFIG.toAAAddress;
    
    // Use the created FROM smart account
    console.log('\n🔧 Using FROM_AA smart account...');
    console.log(`   FROM_AA: ${await fromAA.getAddress()}`);
    
    // Get tokenId from ENS name and determine correct contract address
    const ensName = `${MAINNET_CONFIG.ensName}.eth`;
    const tokenId = getTokenId(ensName);
    const nftContractAddress = getNameWrapperAddress(MAINNET_CONFIG.chainId);
    
    console.log('\n🎯 Transfer Configuration:');
    console.log(`   ENS Name: ${ensName}`);
    console.log(`   NFT Contract: ${nftContractAddress}`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Chain ID: ${MAINNET_CONFIG.chainId}`);
    
    // Verify initial ownership
    console.log('\n🔍 Verifying initial ownership...');
    const initialOwner = await publicClient.readContract({
      address: nftContractAddress,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [tokenId]
    }) as `0x${string}`;
    
    console.log(`📤 Current owner: ${initialOwner}`);
    console.log(`📤 FROM AA address: ${await fromAA.getAddress()}`);
    
    // Check if FROM AA actually owns the NFT
    if (initialOwner.toLowerCase() !== (await fromAA.getAddress()).toLowerCase()) {
      console.log('⚠️  FROM AA does not own the specified NFT');
      console.log('   This test will attempt the transfer anyway to demonstrate the process');
      
      // Let's check what the actual ownership situation is
      console.log('\n🔍 Debugging ownership issue...');
      console.log(`   TokenId: ${tokenId}`);
      console.log(`   NameWrapper contract: ${nftContractAddress}`);
      console.log(`   FROM AA: ${await fromAA.getAddress()}`);
      console.log(`   Actual owner: ${initialOwner}`);
      
      // Check if this is a valid token in NameWrapper
      try {
        const tokenName = await publicClient.readContract({
          address: nftContractAddress,
          abi: NAME_WRAPPER_ABI,
          functionName: 'name',
          args: []
        });
        console.log(`   Token name: ${tokenName}`);
      } catch (error) {
        console.log(`   Could not get token name: ${error}`);
      }
      
      // Check if FROM AA has any approval
      try {
        const isApproved = await publicClient.readContract({
          address: nftContractAddress,
          abi: NAME_WRAPPER_ABI,
          functionName: 'isApprovedForAll',
          args: [initialOwner, await fromAA.getAddress()]
        });
        console.log(`   FROM AA approved: ${isApproved}`);
      } catch (error) {
        console.log(`   Could not check approval: ${error}`);
      }
      
      // Additional debugging: Check ENS Registry ownership
      console.log('\n🔍 Checking ENS Registry ownership...');
      try {
        const ensRegistryAddress = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
        const parentNode = namehash(`${MAINNET_CONFIG.ensName}.eth`);
        const ensOwner = await publicClient.readContract({
          address: ensRegistryAddress as `0x${string}`,
          abi: [{ name: 'owner', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
          functionName: 'owner',
          args: [parentNode]
        });
        console.log(`   ENS Registry owner: ${ensOwner}`);
        console.log(`   Expected NameWrapper: ${nftContractAddress}`);
        console.log(`   Is wrapped: ${ensOwner.toLowerCase() === nftContractAddress.toLowerCase()}`);
      } catch (error) {
        console.log(`   Could not check ENS Registry: ${error}`);
      }
      
      // Check if the tokenId exists in NameWrapper
      console.log('\n🔍 Checking if tokenId exists in NameWrapper...');
      try {
        const tokenExists = await publicClient.readContract({
          address: nftContractAddress,
          abi: NAME_WRAPPER_ABI,
          functionName: 'ownerOf',
          args: [tokenId]
        });
        console.log(`   TokenId ${tokenId} owner: ${tokenExists}`);
      } catch (error) {
        console.log(`   TokenId ${tokenId} not found in NameWrapper: ${error}`);
      }
    }
    
    // Perform the transfer
    console.log('\n🔄 Transferring NFT...');
    const transferSuccess = await transferNFT(
      fromAA,
      toAAAddress,
      nftContractAddress,
      tokenId,
      MAINNET_CONFIG.chain
    );
    
    if (transferSuccess) {
      // Verify final ownership
      console.log('\n🔍 Verifying final ownership...');
      const finalOwner = await publicClient.readContract({
        address: nftContractAddress,
        abi: NAME_WRAPPER_ABI,
        functionName: 'ownerOf',
        args: [tokenId]
      });
      
      const ownershipVerified = await verifyOwnership(
        nftContractAddress,
        tokenId,
        toAAAddress,
        MAINNET_CONFIG.chain
      );
      
      if (ownershipVerified) {
        console.log('\n🎉 NFT transfer test completed successfully!');
        console.log(`   ENS NFT ${ensName} (Token ID: ${tokenId}) is now owned by: ${toAAAddress}`);
      } else {
        console.log('\n❌ NFT transfer test failed - ownership verification failed');
      }
    } else {
      console.log('\n❌ NFT transfer test failed - transfer operation failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { main, transferNFT, verifyOwnership, createSmartAccount };
