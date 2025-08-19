import { createPublicClient, http, encodeFunctionData, toHex, namehash, keccak256, stringToHex } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { Implementation, toMetaMaskSmartAccount, type MetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { TEST_CONFIG, validateConfig } from './config';
import { parseAbi } from 'viem';

// ENS NameWrapper ABI for wrapped ENS NFTs
const NAME_WRAPPER_ABI = parseAbi([
  'function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)',
  'function balanceOf(address account,uint256 id) view returns (uint256)',
  'function ownerOf(uint256 id) view returns (address)'
])

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
    console.log(`🎯 NFT Contract: ${nftContractAddress}`);
    console.log(`🆔 Token ID: ${tokenId}`);
    
    // Create public client
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    
    // Create bundler client with paymaster
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
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
        tokenId,
        1n,
        '0x'
      ]
    });
    
    console.log('\n🔍 Transfer Data Debug:');
    console.log(`   Function: safeTransferFrom`);
    console.log(`   From: ${await fromAA.getAddress()}`);
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
      transport: http(TEST_CONFIG.rpcUrl),
    });
    
    const currentOwner = await publicClient.readContract({
      address: nftContractAddress,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [tokenId]
    });
    
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
    case 11155111: // Sepolia
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`; // Sepolia NameWrapper
    case 1: // Ethereum Mainnet
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`; // Mainnet NameWrapper
    default:
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`; // Default to Sepolia
  }
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🚀 Starting NFT Transfer Test...');
    console.log('📋 Configuration:');
    console.log(`   Chain: ${TEST_CONFIG.chain.name} (ID: ${TEST_CONFIG.chain.id})`);
    console.log(`   RPC URL: ${TEST_CONFIG.rpcUrl}`);
    console.log(`   ENS Name: ${TEST_CONFIG.ensName}`);
    
    // Validate configuration
    validateConfig();
    
    // Create public client
    const publicClient = createPublicClient({
      chain: TEST_CONFIG.chain,
      transport: http(TEST_CONFIG.rpcUrl),
    });
    
    // Create FROM smart account using private key and AA address directly
    console.log('\n🔧 Creating FROM smart account...');
    const fromAA = await createSmartAccountFromAddress(
      TEST_CONFIG.fromPrivateKey,
      TEST_CONFIG.fromAAAddress,
      publicClient
    );
    
    // Create TO smart account (using seed 10000)
    console.log('\n🔧 Creating TO smart account...');
    const toAAAddress = TEST_CONFIG.toAAAddress
    
    // Use the created FROM smart account
    console.log('\n🔧 Using FROM_AA smart account...');
    console.log(`   FROM_AA: ${await fromAA.getAddress()}`);
    
    // Get tokenId from ENS name and determine correct contract address
    const ensName = `${TEST_CONFIG.ensName}.eth`;
    const tokenId = getTokenId(ensName);
    const nftContractAddress = getNameWrapperAddress(TEST_CONFIG.chainId);
    
    console.log('\n🎯 Transfer Configuration:');
    console.log(`   ENS Name: ${ensName}`);
    console.log(`   NFT Contract: ${nftContractAddress}`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Chain ID: ${TEST_CONFIG.chainId}`);
    
    // Verify initial ownership
    console.log('\n🔍 Verifying initial ownership...');
    const initialOwner = await publicClient.readContract({
      address: nftContractAddress,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [tokenId]
    });
    
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
        const parentNode = namehash(`${TEST_CONFIG.ensName}.eth`);
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
      TEST_CONFIG.chain
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
        TEST_CONFIG.chain
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
