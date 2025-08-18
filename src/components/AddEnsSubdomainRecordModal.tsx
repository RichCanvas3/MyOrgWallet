import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, formatEther, namehash } from 'viem';

import {
  XMarkIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  AlertTitle,
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import EnsService from '../service/EnsService';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/delegation-toolkit';
import { privateKeyToAccount } from 'viem/accounts';
import { ENS_PRIVATE_KEY, ENS_NAME, RPC_URL } from '../config';

interface AddEnsSubdomainRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const AddEnsSubdomainRecordModal: React.FC<AddEnsSubdomainRecordModalProps> = ({ 
  isVisible, 
  onClose, 
  onRefresh
}) => {
  // Get parent ENS name from config
  const parentEnsName = ENS_NAME || 'trust102';
  const [subdomainName, setSubdomainName] = useState('');
  const [isCreatingSubdomain, setIsCreatingSubdomain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  
  // New state for wrapping functionality
  const [isCheckingWrapStatus, setIsCheckingWrapStatus] = useState(false);

  const [isParentWrapped, setIsParentWrapped] = useState<boolean | null>(null);

  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'available' | 'exists' | 'invalid' | null>(null);

  // Update the context usage
  const { chain, signatory, orgAccountClient, orgName } = useWallectConnectContext();

  const cleanEnsName = (name: string) => {
    return name.replace('.eth', '').trim();
  };

  // Check if subdomain already exists
  const checkSubdomainExists = async (subdomain: string) => {
    if (!parentEnsName || !chain) return false;
    
    try {
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(RPC_URL),
      });
      
      const subdomainNode = namehash(`${subdomain}.${parentEnsName}.eth`);
      const NAME_WRAPPER_ADDRESS = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
      
      // Check if subdomain exists in NameWrapper (since parent is wrapped)
      const subdomainOwner = await publicClient.readContract({
        address: NAME_WRAPPER_ADDRESS as `0x${string}`,
        abi: [{ name: 'ownerOf', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
        functionName: 'ownerOf',
        args: [BigInt(subdomainNode)]
      });
      
      return subdomainOwner !== '0x0000000000000000000000000000000000000000';
    } catch (error) {
      console.log('Error checking subdomain existence:', error);
      return false;
    }
  };

  // Check subdomain availability when name changes
  const checkSubdomainAvailability = async (name: string) => {
    if (!name.trim() || !parentEnsName || !chain) {
      setSubdomainStatus(null);
      return;
    }

    // Validate format first
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(name.toLowerCase())) {
      setSubdomainStatus('invalid');
      return;
    }

    setIsCheckingSubdomain(true);
    try {
      const exists = await checkSubdomainExists(name);
      setSubdomainStatus(exists ? 'exists' : 'available');
    } catch (error) {
      setSubdomainStatus(null);
    } finally {
      setIsCheckingSubdomain(false);
    }
  };

  // Set default subdomain name when modal opens
  useEffect(() => {
    if (isVisible && orgName) {
      const defaultName = orgName.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setSubdomainName(defaultName);
    }
  }, [isVisible, orgName]);

  // Check subdomain availability when name changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSubdomainAvailability(subdomainName);
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [subdomainName]);

  // Print comprehensive configuration diagnostics
  const printConfiguration = () => {
    console.log('🔧 Modal Configuration:');
    console.log(`   Chain: ${chain?.name} (ID: ${chain?.id})`);
    console.log(`   RPC URL: ${RPC_URL}`);
    console.log(`   Bundler URL: ${import.meta.env.VITE_BUNDLER_URL || 'NOT_SET'}`);
    console.log(`   Parent ENS: ${ENS_NAME}.eth`);
    console.log(`   ENS Private Key: ${ENS_PRIVATE_KEY ? `${ENS_PRIVATE_KEY.substring(0, 10)}...${ENS_PRIVATE_KEY.substring(58)}` : 'NOT_SET'}`);
    console.log(`   Subdomain Name: ${subdomainName}`);
    console.log(`   Modal Visible: ${isVisible}`);
    console.log(`   Parent Wrapped: ${isParentWrapped}`);
  };

  // Calculate the expected AA address for the ENS owner
  const getExpectedEnsOwnerAA = () => {
    const ensPrivateKey = ENS_PRIVATE_KEY as `0x${string}`;
    if (!ensPrivateKey) {
      console.log('❌ ENS_PRIVATE_KEY not configured');
      return null;
    }
    
    try {
      const ensOwnerEOA = privateKeyToAccount(ensPrivateKey);
      console.log('🔍 ENS Owner EOA:', ensOwnerEOA.address);
      console.log('🔧 Expected AA Parameters:', {
        owner: ensOwnerEOA.address,
        salt: 200,
        saltHex: `0x${(200).toString(16)}`,
        implementation: 'Hybrid'
      });
      
      // Note: The actual AA address would be calculated by the smart account factory
      // This is just for reference - the actual address will be shown when the AA is created
      return {
        eoaAddress: ensOwnerEOA.address,
        expectedSalt: 200,
        expectedSaltHex: `0x${(200).toString(16)}`
      };
    } catch (error) {
      console.error('❌ Error calculating expected AA:', error);
      return null;
    }
  };

  // Check if parent ENS domain is already wrapped (following test approach)
  const checkParentWrapStatus = async () => {
    if (!parentEnsName || !chain) {
      console.log('❌ Missing parentEnsName or chain:', { parentEnsName, chain: chain?.name });
      return;
    }

    console.log('🔍 Starting wrap status check (test approach)...');
    console.log('📋 Configuration:', {
      parentEnsName,
      chainName: chain.name,
      chainId: chain.id,
      ENS_NAME: ENS_NAME,
      ENS_PRIVATE_KEY: ENS_PRIVATE_KEY ? `${ENS_PRIVATE_KEY.slice(0, 10)}...` : 'NOT_SET'
    });

    setIsCheckingWrapStatus(true);
    setError(null);

    try {
      const cleanName = cleanEnsName(parentEnsName);
      console.log('🧹 Cleaned ENS name:', cleanName);
      
      // Create public client for reading contract data (like the test)
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(RPC_URL),
      });
      
      // Check if the parent domain is wrapped by checking if ENS Registry owner is NameWrapper (like the test)
      const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
      const NAME_WRAPPER_ADDRESS = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
      const parentNode = namehash(cleanName + '.eth');
      
      console.log('🔍 Checking ENS Registry for parent domain owner...');
      const parentOwner = await publicClient.readContract({
        address: ENS_REGISTRY_ADDRESS as `0x${string}`,
        abi: [{ name: 'owner', type: 'function', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
        functionName: 'owner',
        args: [parentNode]
      }) as `0x${string}`;
      
      console.log(`🔗 Parent domain: ${cleanName}.eth`);
      console.log(`🔗 Parent node: ${parentNode}`);
      console.log(`👤 Parent owner: ${parentOwner}`);
      
      if (parentOwner === '0x0000000000000000000000000000000000000000') {
        console.log('❌ Parent domain does not exist or has no owner');
        setError(`Parent domain "${cleanName}.eth" does not exist or has no owner`);
        setIsParentWrapped(false);
        return;
      }
      
      // For wrapped ENS records, we need to get the actual owner from NameWrapper (like the test)
      let actualOwner: string;
      let isWrapped = false;
      
      if (parentOwner.toLowerCase() === NAME_WRAPPER_ADDRESS.toLowerCase()) {
        console.log('✅ Parent domain is wrapped, getting NameWrapper owner...');
        isWrapped = true;
        
        try {
          const tokenId = BigInt(parentNode);
          actualOwner = await publicClient.readContract({
            address: NAME_WRAPPER_ADDRESS as `0x${string}`,
            abi: [{ name: 'ownerOf', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }],
            functionName: 'ownerOf',
            args: [tokenId]
          }) as `0x${string}`;
          
          console.log(`🎯 NameWrapper owner: ${actualOwner}`);
        } catch (error) {
          console.error('❌ Error getting NameWrapper owner:', error);
          setError(`Failed to get NameWrapper owner: ${error instanceof Error ? error.message : String(error)}`);
          setIsParentWrapped(false);
          return;
        }
      } else {
        actualOwner = parentOwner;
        console.log(`🎯 Direct owner (not wrapped): ${actualOwner}`);
      }
      
      setIsParentWrapped(isWrapped);
      
      if (isWrapped) {
        console.log('✅ Parent domain is wrapped successfully');
        console.log('👑 Current wrapped domain owner:', actualOwner);
        
        // Calculate what the expected AA address should be
        const ensPrivateKey = ENS_PRIVATE_KEY as `0x${string}`;
        if (ensPrivateKey) {
          const ensOwnerEOA = privateKeyToAccount(ensPrivateKey);
          console.log('🔍 Expected AA owner details:', {
            eoaAddress: ensOwnerEOA.address,
            expectedAASalt: 200,
            expectedAASaltHex: `0x${(200).toString(16)}`,
            note: 'This AA should own the wrapped parent domain'
          });
        }
      } else {
        console.log('⚠️  Parent domain is NOT wrapped');
        setError(`Parent domain "${cleanName}.eth" is not wrapped.`);
      }
    } catch (error) {
      console.error('❌ Error checking wrap status:', error);
      setError(`Failed to check wrap status: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCheckingWrapStatus(false);
    }
  };



  // Check wrap status when component mounts or parentEnsName changes
  useEffect(() => {
    if (isVisible && parentEnsName) {
      console.log('🚀 Modal Initialization');
      console.log('='.repeat(60));
      
      // Print comprehensive configuration
      printConfiguration();
      console.log('');
      
      // Show expected AA details
      console.log('🎯 Expected ENS Owner AA Details:');
      getExpectedEnsOwnerAA();
      console.log('');
      
      // Check parent wrap status
      checkParentWrapStatus();
    }
  }, [isVisible, parentEnsName]);

  const createSubdomain = async () => {
    console.log('🚀 Starting Subdomain Creation Process');
    console.log('='.repeat(60));
    
    // Print comprehensive configuration
    printConfiguration();
    console.log('');
    
    console.log('📋 Input Validation:');
    console.log(`   Parent ENS Name: ${parentEnsName}`);
    console.log(`   Subdomain Name: ${subdomainName}`);
    console.log(`   Chain Available: ${!!chain}`);
    console.log(`   Chain Name: ${chain?.name}`);
    console.log(`   ORG Account Client Available: ${!!orgAccountClient}`);
    console.log('');

    if (!parentEnsName || !chain || !orgAccountClient) {
      const error = 'Missing required information';
      console.error('❌', error, { parentEnsName, chain: chain?.name, hasOrgAccountClient: !!orgAccountClient });
      setError(error);
      return;
    }

    if (!subdomainName.trim()) {
      const error = 'Please enter a subdomain name';
      console.error('❌', error);
      setError(error);
      return;
    }

    // Validate subdomain name format
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomainName.toLowerCase())) {
      const error = 'Subdomain name can only contain lowercase letters, numbers, and hyphens';
      console.error('❌', error);
      setError(error);
      return;
    }

    // Check if subdomain already exists
    console.log('🔍 Checking if subdomain already exists...');
    const subdomainExists = await checkSubdomainExists(subdomainName);
    if (subdomainExists) {
      const error = `Subdomain "${subdomainName}.${parentEnsName}.eth" already exists`;
      console.error('❌', error);
      setError(error);
      return;
    }
    console.log('✅ Subdomain name is available');

    setIsCreatingSubdomain(true);
    setError(null);

    try {
      const signer = signatory.signer;
      const cleanParentName = cleanEnsName(parentEnsName);
      console.log('🧹 Cleaned parent name:', cleanParentName);
      
      // Get the ORG AA address
      const orgAccountAddress = await orgAccountClient.getAddress();
      console.log('🏢 ORG AA address:', orgAccountAddress);
      
      // Step 1: Create ENS Owner Client
      console.log('🔍 Step 1: Creating ENS Owner Client');
      console.log('-'.repeat(40));
      
      const ensPrivateKey = ENS_PRIVATE_KEY as `0x${string}`;
      console.log(`🔑 ENS Private Key: ${ensPrivateKey ? `${ensPrivateKey.substring(0, 10)}...${ensPrivateKey.substring(58)}` : 'NOT_SET'}`);
      
      if (!ensPrivateKey) {
        throw new Error('ENS_PRIVATE_KEY configuration is required');
      }
      
      // Create EOA from private key (this is the owner of the AA)
      const ensOwnerEOA = privateKeyToAccount(ensPrivateKey);
      console.log(`✅ ENS Owner EOA created: ${ensOwnerEOA.address}`);
      
      // Create public client
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(RPC_URL),
      });
      console.log(`✅ Public client created for chain: ${chain.name}`);
      
      // Create signatory for ENS owner
      const ensSignatory = {
        account: ensOwnerEOA,
        signer: signer
      };
      console.log(`✅ ENS Owner signatory created for address: ${ensOwnerEOA.address}`);
      
      // Create ENS owner smart account (AA) using the same logic as the test
      console.log('🔍 Creating organization smart account for ENS owner...');
      console.log('🔧 Smart Account Parameters:');
      console.log(`   Owner Address: ${ensOwnerEOA.address}`);
      console.log(`   Deploy Salt: 0x${(200).toString(16)} (200)`);
      console.log(`   Implementation: Hybrid`);
      console.log(`   Deploy Params: [owner, [], [], []]`);
      
      const ensOwnerClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [ensOwnerEOA.address, [], [], []],
        signatory: ensSignatory,
        deploySalt: `0x${(10000).toString(16)}` as `0x${string}`, // Organization salt like in test
      });
      
      const ensOwnerAddress = await ensOwnerClient.getAddress();
      console.log(`✅ ENS Owner smart account found at: ${ensOwnerAddress}`);
      console.log(`🎯 This AA will be used to call the registrar for parent domain operations`);
      console.log('');
      
      // Step 2: Call EnsService.createSubdomainForOrg
      console.log('🔍 Step 2: Creating Subdomain via EnsService');
      console.log('-'.repeat(40));
      
      console.log('🎯 Subdomain Creation Parameters:');
      console.log(`   Parent ENS: ${cleanParentName}.eth`);
      console.log(`   Subdomain: ${subdomainName.trim()}.${cleanParentName}.eth`);
      console.log(`   ENS Owner EOA: ${ensOwnerEOA.address}`);
      console.log(`   ENS Owner AA: ${ensOwnerAddress}`);
      console.log(`   ORG AA: ${orgAccountAddress}`);
      console.log(`   Chain: ${chain.name} (ID: ${chain.id})`);
      console.log('');
      
      console.log('🚀 Calling EnsService.createSubdomainForOrg...');
      
      const result = await EnsService.createSubdomainForOrg(
        signer, 
        ensOwnerClient, 
        orgAccountAddress as `0x${string}`, 
        cleanParentName, 
        subdomainName.trim(), 
        chain
      );
      
      console.log(`✅ Subdomain created successfully: ${result}`);
      console.log('='.repeat(60));
      
      setSuccess(`Subdomain "${result}" created successfully!`);
      
      // Reset form
      setSubdomainName('');
      
      // Call refresh if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error creating subdomain:', error);
      setError(error instanceof Error ? error.message : 'Failed to create subdomain');
    } finally {
      setIsCreatingSubdomain(false);
    }
  };



  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setSubdomainName('');
    setSubdomainStatus(null);
    onClose();
  };

  const handleCreateAnother = () => {
    setSuccess(null);
    setSubdomainName('');
    setSubdomainStatus(null);
  };

  if (!isVisible) return null;

  return (
    <Transition
      show={isVisible}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="modal-overlay">
        <Transition
          show={isVisible}
          enter="modal-enter"
          enterFrom="modal-enter-from"
          enterTo="modal-enter-to"
          leave="modal-leave"
          leaveFrom="modal-leave-from"
          leaveTo="modal-leave-to"
        >
          <div className="modal-dialog">
            {/* Header */}
            <div className="modal-header">
              <h1 className="modal-title">
                Create ENS Subdomain
              </h1>
              <button onClick={handleClose} className="close-button">
                <XMarkIcon className="close-icon" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="modal-content">

              {/* Parent ENS Name Display */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#333333' }} gutterBottom>
                  Parent Domain:
                </Typography>
                <Typography variant="h6" fontWeight="medium" sx={{ color: '#000000' }}>
                  {parentEnsName}.eth
                </Typography>
                
                {/* Initial Loading State */}
                {isParentWrapped === null && !isCheckingWrapStatus && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ color: '#666666' }}>
                      Loading wrap status...
                    </Typography>
                  </Box>
                )}
                
                {/* Wrap Status and Action */}
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  {isCheckingWrapStatus ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" sx={{ color: '#666666' }}>
                        Checking wrap status...
                      </Typography>
                    </Box>
                  ) : isParentWrapped === null ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: '#666666' }}>
                        Wrap status unknown
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={checkParentWrapStatus}
                        disabled={isCheckingWrapStatus}
                      >
                        {isCheckingWrapStatus ? (
                          <>
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                            Checking...
                          </>
                        ) : (
                          'Check Status'
                        )}
                      </Button>
                    </Box>
                  ) : null}
                </Box>
                

              </Box>

              {/* Error Alert */}
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  <AlertTitle>Error</AlertTitle>
                  {error}
                </Alert>
              )}

              {/* Success Alert */}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                  <AlertTitle>Success</AlertTitle>
                  {success}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleCreateAnother}
                      sx={{ mr: 1 }}
                    >
                      Create Another
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleClose}
                    >
                      Close
                    </Button>
                  </Box>
                </Alert>
              )}

              {/* Subdomain Creation Section */}
              {!success && isParentWrapped && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium" mb={2} sx={{ color: '#000000' }}>
                    Proposed Subdomain
                  </Typography>
                  

                  
                  {/* Subdomain Display */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ color: '#333333' }} gutterBottom>
                      Subdomain Name:
                    </Typography>
                    <Typography variant="h6" fontWeight="medium" sx={{ mb: 1, color: '#000000' }}>
                      {subdomainName || 'Enter subdomain name'}
                    </Typography>
                    
                    {/* Full Domain Display */}
                    <Typography variant="body2" sx={{ color: '#333333' }} gutterBottom>
                      Full Domain:
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace" sx={{ mb: 2, color: '#000000' }}>
                      {subdomainName}.{cleanEnsName(parentEnsName)}.eth
                    </Typography>
                    
                    {/* Availability Status */}
                    {isCheckingSubdomain ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" sx={{ color: '#666666' }}>
                          Checking availability...
                        </Typography>
                      </Box>
                    ) : subdomainStatus === 'available' ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        ✅ Subdomain is available
                      </Alert>
                    ) : subdomainStatus === 'exists' ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        ✅ Subdomain already exists
                      </Alert>
                    ) : null}
                  </Box>
                  
                  {/* Action Buttons */}
                  {subdomainStatus === 'available' ? (
                    <Button
                      variant="contained"
                      onClick={createSubdomain}
                      disabled={isCreatingSubdomain}
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      {isCreatingSubdomain ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Creating Subdomain...
                        </>
                      ) : (
                        'Create Subdomain'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      onClick={handleClose}
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      Close
                    </Button>
                  )}
                </Box>
              )}

            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  );
};

export default AddEnsSubdomainRecordModal;
