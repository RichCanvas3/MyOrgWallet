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
import BaseRegistrarABI from '../src/abis/BaseRegistrarImplementation.json';

// ENS Contract Addresses (Sepolia)
const ENS_CONTRACTS = {
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
  NameWrapper: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Will be set dynamically
  PublicResolver: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD' as `0x${string}`,
  BaseRegistrar: '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85' as `0x${string}`, // Sepolia BaseRegistrar
};

// Function to get NameWrapper address based on chain
function getNameWrapperAddress(chainId: number): `0x${string}` {
  switch (chainId) {
    case 11155111: // Sepolia
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`; // Sepolia NameWrapper from main project
    case 1: // Ethereum Mainnet
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`; // Mainnet NameWrapper
    default:
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`; // Default to Sepolia
  }
}

// Helper function to get token ID from domain name
function getTokenId(ensName: string): bigint {
  const label = ensName.replace('.eth', '');
  // Use viem's keccak256 and stringToHex instead of ethers
  return BigInt(keccak256(stringToHex(label)));
}

// Use the actual ABIs from your main project
const NAME_WRAPPER_ABI = NameWrapperABI.abi;
const BASE_REGISTRAR_ABI = BaseRegistrarABI.abi;

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
 * Check if ENS domain is already wrapped
 */
async function checkIfDomainWrapped(
  publicClient: any,
  ensName: string
): Promise<{ wrapped: boolean; tokenId?: bigint; owner?: string; tokenURI?: string }> {
  try {
    const node = namehash(ensName);
    console.log(`🔍 Checking if domain ${ensName} is already wrapped...`);
    console.log(`🔐 Node hash: ${node}`);
    
    // Check if the domain is owned by the NameWrapper contract
    const wrapperOwner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [
        {
          name: 'owner',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'node', type: 'bytes32' }],
          outputs: [{ name: '', type: 'address' }]
        }
      ],
      functionName: 'owner',
      args: [node]
    });
    
    if (wrapperOwner === ENS_CONTRACTS.NameWrapper) {
      console.log('✅ Domain is already wrapped!');
      
      // Get the token ID (node hash as uint256)
      const tokenId = BigInt(node);
      
      // Check who owns the wrapped token
      const tokenOwner = await publicClient.readContract({
        address: ENS_CONTRACTS.NameWrapper,
        abi: NAME_WRAPPER_ABI,
        functionName: 'ownerOf',
        args: [tokenId]
      });
      
      // Note: tokenURI function not available on Sepolia NameWrapper
      // This is optional metadata and not required for core functionality
      
      return {
        wrapped: true,
        tokenId,
        owner: tokenOwner as string,
        tokenURI: '' // Not available on Sepolia
      };
    } else {
      console.log('❌ Domain is not wrapped');
      return { wrapped: false };
    }
  } catch (error) {
    console.error('❌ Error checking if domain is wrapped:', error);
    return { wrapped: false };
  }
}

/**
 * Wrap ENS domain into NFT using NameWrapper
 */
async function wrapEnsDomain(
  publicClient: any,
  bundlerClient: any,
  smartAccountClient: any,
  ensName: string,
  gasConfig: any,
  fuses: number = 0
): Promise<{ success: boolean; tokenId?: bigint; error?: string }> {
  try {
    console.log(`🔧 Wrapping ENS domain ${ensName} into NFT...`);
    
    // For .eth domains, use wrapETH2LD
    if (ensName.endsWith('.eth')) {
      const label = ensName.replace('.eth', '');
      const tokenId = getTokenId(ensName);
      const smartAccountAddress = await smartAccountClient.getAddress();
      
      console.log(`📝 Using wrapETH2LD for label: ${label}`);
      console.log(`🆔 Token ID: ${tokenId}`);
      console.log(`👤 Smart Account: ${smartAccountAddress}`);
      
      // First, check domain ownership in BaseRegistrar
      console.log('🔍 Checking domain ownership in BaseRegistrar...');
      const baseRegistrarOwner = await publicClient.readContract({
        address: ENS_CONTRACTS.BaseRegistrar,
        abi: BASE_REGISTRAR_ABI,
        functionName: 'ownerOf',
        args: [tokenId]
      });
      
      console.log(`🏠 BaseRegistrar owner: ${baseRegistrarOwner}`);
      
      if (baseRegistrarOwner.toLowerCase() !== smartAccountAddress.toLowerCase()) {
        throw new Error(`Domain ${ensName} is not owned by smart account ${smartAccountAddress}. Current owner: ${baseRegistrarOwner}`);
      }
      
      // Check if NameWrapper has approval
      console.log('🔍 Checking NameWrapper approval...');
      const isApproved = await publicClient.readContract({
        address: ENS_CONTRACTS.BaseRegistrar,
        abi: BASE_REGISTRAR_ABI,
        functionName: 'isApprovedForAll',
        args: [smartAccountAddress, ENS_CONTRACTS.NameWrapper]
      });
      
      console.log(`✅ NameWrapper approval status: ${isApproved}`);
      
      // If not approved, set approval first
      if (!isApproved) {
        console.log('🔧 Setting approval for NameWrapper...');
        
        const approvalData = encodeFunctionData({
          abi: BASE_REGISTRAR_ABI,
          functionName: 'setApprovalForAll',
          args: [ENS_CONTRACTS.NameWrapper, true]
        });
        
        const approvalOpHash = await bundlerClient.sendUserOperation({
          account: smartAccountClient,
          calls: [{
            to: ENS_CONTRACTS.BaseRegistrar,
            data: approvalData
          }],
          ...gasConfig
        });
        
        console.log('📋 Approval transaction sent:', approvalOpHash);
        
        // Wait for confirmation
        await bundlerClient.waitForUserOperationReceipt({
          hash: approvalOpHash,
        });
        
        console.log('✅ Approval confirmed');
        
        // Wait a bit for the blockchain to update
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Verify PublicResolver contract exists and is accessible
      console.log('🔍 Verifying PublicResolver contract...');
      try {
        const resolverCode = await publicClient.getBytecode({
          address: ENS_CONTRACTS.PublicResolver
        });
        
        if (!resolverCode || resolverCode === '0x') {
          throw new Error(`PublicResolver contract at ${ENS_CONTRACTS.PublicResolver} does not exist or has no code`);
        }
        
        console.log('✅ PublicResolver contract verified');
      } catch (error) {
        console.error('❌ PublicResolver verification failed:', error);
        throw new Error(`PublicResolver contract verification failed: ${error.message}`);
      }
      
      // Verify NameWrapper contract exists and check its functions
      console.log('🔍 Verifying NameWrapper contract...');
      try {
        const nameWrapperCode = await publicClient.getBytecode({
          address: ENS_CONTRACTS.NameWrapper
        });
        
        if (!nameWrapperCode || nameWrapperCode === '0x') {
          throw new Error(`NameWrapper contract at ${ENS_CONTRACTS.NameWrapper} does not exist or has no code`);
        }
        
        console.log('✅ NameWrapper contract verified');
        console.log(`📏 NameWrapper contract size: ${nameWrapperCode.length} bytes`);
        
        // Try to read the owner of the token to verify basic functionality
        try {
          const tokenOwner = await publicClient.readContract({
            address: ENS_CONTRACTS.NameWrapper,
            abi: NAME_WRAPPER_ABI,
            functionName: 'ownerOf',
            args: [tokenId]
          });
          console.log(`🔍 Token owner in NameWrapper: ${tokenOwner}`);
        } catch (error) {
          console.log('⚠️  Could not read token owner from NameWrapper:', error.message);
        }
        
      } catch (error) {
        console.error('❌ NameWrapper verification failed:', error);
        throw new Error(`NameWrapper contract verification failed: ${error.message}`);
      }
      
      // Now wrap the domain
      const wrapData = encodeFunctionData({
        abi: NAME_WRAPPER_ABI,
        functionName: 'wrapETH2LD',
        args: [
          label,
          smartAccountAddress, // wrappedOwner
          fuses, // fuses (0 = no restrictions)
          ENS_CONTRACTS.PublicResolver // resolver
        ]
      });
      
      console.log('📤 Wrapping domain via NameWrapper...');
      console.log('🔧 Wrap call details:', {
        to: ENS_CONTRACTS.NameWrapper,
        data: wrapData,
        label,
        owner: smartAccountAddress,
        fuses,
        resolver: ENS_CONTRACTS.PublicResolver
      });
      
      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccountClient,
        calls: [{
          to: ENS_CONTRACTS.NameWrapper,
          data: wrapData
        }],
        ...gasConfig
      });
      
      console.log('📋 Wrap transaction sent:', userOpHash);
      
      // Wait for confirmation
      const { receipt } = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      
      console.log('✅ Domain wrapped successfully:', receipt);
      
      return { success: true, tokenId };
      
    } else {
      // For subdomains, use wrap
      console.log(`📝 Using wrap for subdomain: ${ensName}`);
      
      const wrapData = encodeFunctionData({
        abi: NAME_WRAPPER_ABI,
        functionName: 'wrap',
        args: [
          ensName,
          await smartAccountClient.getAddress(), // wrappedOwner
          ENS_CONTRACTS.PublicResolver // resolver
        ]
      });
      
      console.log('📤 Wrapping subdomain via NameWrapper...');
      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccountClient,
        calls: [{
          to: ENS_CONTRACTS.NameWrapper,
          data: wrapData
        }],
        ...gasConfig
      });
      
      console.log('📋 Wrap transaction sent:', userOpHash);
      
      // Wait for confirmation
      const { receipt } = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      
      console.log('✅ Subdomain wrapped successfully:', receipt);
      
      // Get the token ID
      const node = namehash(ensName);
      const tokenId = BigInt(node);
      
      return { success: true, tokenId };
    }
    
  } catch (error) {
    console.error('❌ Error wrapping domain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main ENS NFT wrapper test function
 */
async function main() {
  try {
    console.log('🚀 Starting ENS NFT Wrapper Test with AA Wallet');
    
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

    // Step 4: Set NameWrapper address based on chain
    ENS_CONTRACTS.NameWrapper = getNameWrapperAddress(TEST_CONFIG.chainId);
    console.log(`🔗 Using NameWrapper: ${ENS_CONTRACTS.NameWrapper}`);
    


    // Step 5: Test ENS domain wrapping
    const testDomain = TEST_CONFIG.ensName + '.eth'; // Use ENS_NAME from environment config
    console.log(`🎯 Testing ENS NFT wrapper for domain: ${testDomain}`);
    
    // First, verify the domain exists and check its current status
    console.log('🔍 Verifying domain status before wrapping...');
    const tokenId = getTokenId(testDomain);
    console.log(`🆔 Domain token ID: ${tokenId}`);
    
    try {
      const baseRegistrarOwner = await publicClient.readContract({
        address: ENS_CONTRACTS.BaseRegistrar,
        abi: BASE_REGISTRAR_ABI,
        functionName: 'ownerOf',
        args: [tokenId]
      }) as `0x${string}`;
      
      console.log(`🏠 Domain owner in BaseRegistrar: ${baseRegistrarOwner}`);
      console.log(`👤 Smart account address: ${orgAddress}`);
      
      // Check if domain is already wrapped
      try {
        const nameWrapperOwner = await publicClient.readContract({
          address: ENS_CONTRACTS.NameWrapper,
          abi: NAME_WRAPPER_ABI,
          functionName: 'ownerOf',
          args: [tokenId]
        }) as `0x${string}`;
        
        if (nameWrapperOwner !== '0x0000000000000000000000000000000000000000') {
          console.log(`🎉 Domain is already wrapped! Owner in NameWrapper: ${nameWrapperOwner}`);
          
          if (nameWrapperOwner.toLowerCase() === orgAddress.toLowerCase()) {
            console.log('✅ Domain is wrapped and owned by your smart account!');
            return {
              success: true,
              domain: testDomain,
              message: 'Domain already wrapped and owned by smart account',
              tokenId: tokenId,
              owner: nameWrapperOwner
            };
          } else {
            throw new Error(`Domain is wrapped but owned by ${nameWrapperOwner}, not your smart account ${orgAddress}`);
          }
        }
      } catch (error) {
        console.log('Domain is not wrapped yet, proceeding with wrapping...');
      }
      
      // If not wrapped, verify ownership in BaseRegistrar
      if (baseRegistrarOwner.toLowerCase() !== orgAddress.toLowerCase()) {
        // Check if the domain might be wrapped (owned by NameWrapper)
        if (baseRegistrarOwner.toLowerCase() === ENS_CONTRACTS.NameWrapper.toLowerCase()) {
          console.log('🔍 Domain appears to be wrapped (owned by NameWrapper)');
          // We'll check this in the next step
        } else {
          throw new Error(`Domain ${testDomain} is not owned by smart account ${orgAddress}. Current owner: ${baseRegistrarOwner}`);
        }
      } else {
        console.log('✅ Domain ownership verified - smart account owns this domain');
      }
    } catch (error) {
      if (error.message.includes('ERC721: owner query for nonexistent token')) {
        throw new Error(`Domain ${testDomain} does not exist or is not registered. Please register it first using the ENS registration test.`);
      }
      throw error;
    }
    
    // First, check if the domain is already wrapped
    const wrapStatus = await checkIfDomainWrapped(publicClient, testDomain);
    
    if (wrapStatus.wrapped) {
      console.log(`🎉 Domain ${testDomain} is already wrapped!`);
      console.log(`🆔 Token ID: ${wrapStatus.tokenId}`);
      console.log(`👤 Token Owner: ${wrapStatus.owner}`);
      if (wrapStatus.tokenURI) {
        console.log(`🔗 Token URI: ${wrapStatus.tokenURI}`);
      }
      
      return {
        success: true,
        domain: testDomain,
        message: 'Domain already wrapped',
        tokenId: wrapStatus.tokenId,
        owner: wrapStatus.owner
      };
    }
    
    // Step 6: Wrap the domain if it's not already wrapped
    console.log('🔧 Domain is not wrapped, creating NFT wrapper...');
    
    // Create bundler client for transactions
    const bundlerClient = createBundlerClient({
      transport: http(TEST_CONFIG.bundlerUrl),
      paymaster: true,
      chain: TEST_CONFIG.chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });
    
    // Get gas prices and configuration (same as your main service)
    const feeData = await publicClient.estimateFeesPerGas();
    console.log('Current fee data:', feeData);

    // Use dynamic gas prices with a buffer and proper gas limits (same as your main service)
    const gasConfig = {
      maxFeePerGas: feeData.maxFeePerGas * 2n, // Double the estimated gas price to ensure acceptance
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
      callGasLimit: 500000n, // Gas limit for the actual call
      preVerificationGas: 100000n, // Gas for pre-verification
      verificationGasLimit: 500000n // Gas for verification
    };
    console.log('Using gas config:', gasConfig);
    
    // Wrap the domain
    const wrapResult = await wrapEnsDomain(
      publicClient,
      bundlerClient,
      orgAccountClient,
      testDomain,
      gasConfig,
      0 // No fuses (unrestricted)
    );
    
    if (!wrapResult.success) {
      throw new Error(`Failed to wrap domain: ${wrapResult.error}`);
    }
    
    // Step 7: Verify the wrapping was successful
    console.log('🔍 Verifying domain was wrapped successfully...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for blockchain to update
    
    const verificationStatus = await checkIfDomainWrapped(publicClient, testDomain);
    
    if (verificationStatus.wrapped && verificationStatus.owner === orgAddress) {
      console.log('✅ Domain wrapping verified successfully!');
      console.log(`🎉 ${testDomain} is now an NFT owned by your Org AA account!`);
      
      return {
        success: true,
        domain: testDomain,
        message: 'Domain wrapped successfully',
        tokenId: verificationStatus.tokenId,
        owner: verificationStatus.owner,
        tokenURI: verificationStatus.tokenURI
      };
    } else {
      throw new Error('Domain wrapping verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error in ENS NFT wrapper test:', error);
    throw error;
  }
}

// Export functions for use in other tests
export {
  createSignatoryFromPrivateKey,
  findValidOrgAccount,
  checkIfDomainWrapped,
  wrapEnsDomain,
  main,
  type Signatory,
};

// Run the test if this file is executed directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log('🎉 ENS NFT Wrapper Test completed successfully!');
      console.log('📊 Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ ENS NFT Wrapper Test failed:', error);
      process.exit(1);
    });
}
