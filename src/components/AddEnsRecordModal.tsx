import * as React from 'react';
import { useState, useEffect, useRef } from 'react';


import { createPublicClient, http, formatEther } from 'viem';

import AttestationService from '../service/AttestationService';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';

import {Attestation, RegisteredENSAttestation } from '../models/Attestation';


import { keccak256, toUtf8Bytes } from 'ethers';

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
  Stepper,
  Step,
  StepLabel,
  Alert,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  AlertTitle,
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import EnsService from '../service/EnsService';
import { RPC_URL, BUNDLER_URL } from "../config";
import ETHRegistrarControllerABI from '../abis/ETHRegistrarController.json';
import { wrappedDomainDetailsFragment } from '@ensdomains/ensjs/dist/types/functions/subgraph/fragments';

interface AddEnsRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  existingEnsName?: string; // Optional existing ENS name to update
}

const getSteps = (isExisting: boolean) => {
  if (isExisting) {
    return ['Select ENS Name', 'Enter Image URL', 'Confirm Avatar Update'];
  }
  return ['Enter ENS Name', 'Enter Image URL', 'Confirm & Register'];
};

const AddEnsRecordModal: React.FC<AddEnsRecordModalProps> = ({ isVisible, onClose, onRefresh, existingEnsName }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [ensName, setEnsName] = useState(existingEnsName || '');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<string>('0');
  const [isCalculatingCost, setIsCalculatingCost] = useState(false);
  const [isExistingEns, setIsExistingEns] = useState(!!existingEnsName);
  const [shouldSkipFirstStep, setShouldSkipFirstStep] = useState(!!existingEnsName);
  const [isFetchingAvatar, setIsFetchingAvatar] = useState(false);
  const [useBasicAvatar, setUseBasicAvatar] = useState(false);
  const [orgBalance, setOrgBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isCreatingSubdomain, setIsCreatingSubdomain] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const availabilityTimeoutRef = useRef<NodeJS.Timeout>();



  // Update the context usage
  const { chain, signatory, privateIssuerDid, veramoAgent,orgIssuerDelegation, orgIndivDelegation, credentialManager, privateIssuerAccount, orgAccountClient, burnerAccountClient, orgDid } = useWallectConnectContext();


  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleClose = () => {
    setActiveStep(0);
    setEnsName(existingEnsName || '');
    setLogoPreview('');
    setImageUrl('');
    setError(null);
    setSuccess(null);
    setIsAvailable(null);
    setEstimatedCost('0');
    setIsExistingEns(!!existingEnsName);
    setShouldSkipFirstStep(!!existingEnsName);
    setIsFetchingAvatar(false);
    setUseBasicAvatar(false);
    onClose();
  };

  // Clean ENS name input
  const cleanEnsName = (name: string): string => {

    // Remove ENS: prefix if present
    let cleaned = name.replace(/^ENS:\s*/, '');

    // Remove .eth suffix if present
    cleaned = cleaned.replace(/\.eth$/i, '');

    // Remove any other non-alphanumeric characters except hyphens
    cleaned = cleaned.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();


    return cleaned;
  };

  // Simplified input handler - just update the value
  const handleEnsNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEnsName(event.target.value);
  };

  // Update availability check function
  const checkAvailability = async (name: string) => {
    if (!name || !chain) return;

    setIsCheckingAvailability(true);
    setIsAvailable(null);
    setEstimatedCost('0');

    // Clear any existing timeout
    if (availabilityTimeoutRef.current) {
      clearTimeout(availabilityTimeoutRef.current);
    }

    try {
      const cleanName = cleanEnsName(name);
      if (!cleanName) {
        setIsAvailable(false);
        return;
      }

      // Set new timeout
      availabilityTimeoutRef.current = setTimeout(async () => {
        try {
          const ETHRegistrarControllerAddress = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968';
          const publicClient = createPublicClient({
            chain: chain,
            transport: http(RPC_URL),
          });

          // Check if the domain is available
          const available = (await publicClient.readContract({
            address: ETHRegistrarControllerAddress as `0x${string}`,
            abi: ETHRegistrarControllerABI.abi,
            functionName: 'available',
            args: [cleanName]
          })) as boolean;

          setIsAvailable(available);

          if (available) {
            // Get registration cost for 1 year
            const duration = 365 * 24 * 60 * 60; // 1 year in seconds
            const rentPrice = await publicClient.readContract({
              address: ETHRegistrarControllerAddress as `0x${string}`,
              abi: ETHRegistrarControllerABI.abi,
              functionName: 'rentPrice',
              args: [cleanName, duration]
            }) as { base: bigint; premium: bigint };

            const totalPrice = rentPrice.base + rentPrice.premium;
            setEstimatedCost(formatEther(totalPrice));
          }
        } catch (error) {
          console.error('Error checking availability:', error);
          setIsAvailable(false);
        } finally {
          setIsCheckingAvailability(false);
        }
      }, 500);
    } catch (error) {
      console.error('Error in checkAvailability:', error);
      setIsAvailable(false);
      setIsCheckingAvailability(false);
    }
  };

  // Handle availability check in an effect
  useEffect(() => {
    if (!ensName || ensName.length < 3 || !chain) {
      setIsAvailable(null);
      setEstimatedCost('0');
      return;
    }

    // Increase delay to 1000ms (1 second)
    const checkTimeout = setTimeout(async () => {
      try {
        setIsCheckingAvailability(true);
        setError(null);

        const cleanName = cleanEnsName(ensName);
        const fullName = cleanName + '.eth';

        // Create public client for checking availability
        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });

        // For new registrations, check actual availability with the ENS registrar
        const ETHRegistrarControllerAddress = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968'; // Sepolia

        // Check actual availability using the registrar contract
        const isAvailable = await publicClient.readContract({
          address: ETHRegistrarControllerAddress as `0x${string}`,
          abi: ETHRegistrarControllerABI.abi,
          functionName: 'available',
          args: [cleanName]
        });

        if (isAvailable) {
          // Get actual registration cost
          const duration = 365 * 24 * 60 * 60; // 1 year in seconds
          const rentPrice = await publicClient.readContract({
            address: ETHRegistrarControllerAddress as `0x${string}`,
            abi: ETHRegistrarControllerABI.abi,
            functionName: 'rentPrice',
            args: [cleanName, duration]
          }) as { base: bigint; premium: bigint };

          const totalPrice = rentPrice.base + rentPrice.premium;
          setEstimatedCost(formatEther(totalPrice));
        } else {
          setError('This ENS name is already taken');
          setEstimatedCost('0');
        }

        setIsAvailable(isAvailable);
      } catch (error) {
        console.error('Error checking availability:', error);
        setError('Failed to check ENS name availability');
        setIsAvailable(false);
      } finally {
        setIsCheckingAvailability(false);
      }
    }, 1000); // Changed from 500ms to 1000ms

    return () => clearTimeout(checkTimeout);
  }, [ensName, chain]);

  // Add cleanup for timeout
  useEffect(() => {
    return () => {
      if (availabilityTimeoutRef.current) {
        clearTimeout(availabilityTimeoutRef.current);
      }
    };
  }, []);

  // Handle logo file selection
  // Remove logo
  const handleRemoveLogo = () => {
    setLogoPreview('');
    setImageUrl('');
  };

  const handleImageUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setImageUrl(url);

    // Update preview if it's a valid URL
    if (url && isValidImageUrl(url)) {
      setLogoPreview(url);
    } else {
      setLogoPreview('');
    }
  };

  const isValidImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Add helper function to generate basic avatar SVG
  const generateBasicAvatar = (ensName: string) => {
    // Generate colors based on ENS name
    const hash = ensName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const hue1 = hash % 360;
    const hue2 = (hue1 + 40) % 360;
    const color1 = `hsl(${hue1}, 70%, 60%)`;
    const color2 = `hsl(${hue2}, 70%, 60%)`;

    // Create SVG with gradient
    const svg = `
    <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="200" r="200" fill="url(#grad)"/>
    </svg>
  `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  async function wrapEnsName(ensName: string) {
    const cleanName = cleanEnsName(ensName);

    if (!ensName || !chain || !orgAccountClient) {
      console.error('Missing required information:', {
        ensName: !!ensName,
        chain: !!chain,
        orgAccountClient: !!orgAccountClient
      });
      setError('Missing required information');
      return;
    }

    setIsWrapping(true);
    setError('');

    try {
      const wrappedName = await EnsService.wrapEnsDomainName(orgAccountClient, cleanName, chain);
      console.log('ENS name wrapped successfully:', wrappedName);
      setSuccess(`ENS name "${wrappedName}.eth" has been wrapped successfully! You can now create subdomains.`);
    } catch (error) {
      console.error('Error wrapping ENS name:', error);
      setError(`Failed to wrap ENS name: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsWrapping(false);
    }
  }

  // Register or update ENS name
  const handleRegister = async () => {
    console.log('Starting registration with:', {
      ensName,
      chain,
      orgAccountClient: orgAccountClient?.address,
      imageUrl
    });

    if (!ensName || !chain || !orgAccountClient) {
      console.error('Missing required information:', {
        ensName: !!ensName,
        chain: !!chain,
        orgAccountClient: !!orgAccountClient
      });
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanName = cleanEnsName(ensName);

      if (isExistingEns) {
        // Update existing ENS name with new logo
        if (imageUrl) {
          let success = await EnsService.updateEnsAvatar(orgAccountClient, cleanName + '.eth', imageUrl, chain);

          if (success) {
            setSuccess(`ENS avatar for "${cleanName}.eth" updated successfully!`);
          } else {
            setError(`Failed to update ENS avatar. Please try again.`);
            return;
          }
        }
      } else {
        // Register new ENS name
        console.log('Registering new ENS name:', cleanName);
        const result = await EnsService.createEnsDomainName(orgAccountClient, cleanName, chain);
        setSuccess(`ENS name "${result}" registered successfully!`);

        // now create attestation
        const enscreationdate = new Date("2023-03-10")
        const enscreationdateSeconds = Math.floor(enscreationdate.getTime() / 1000); // Convert to seconds
    
        const entityId = "ens(org)"
        if (orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient) {
    
          const vc = await VerifiableCredentialsService.createRegisteredDomainVC(entityId, orgDid, privateIssuerDid, cleanName, enscreationdate.toDateString());
          const result = await VerifiableCredentialsService.createCredential(vc, entityId, cleanName, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
          const fullVc = result.vc
          const proof = result.proof
          if (proof && fullVc && chain && burnerAccountClient && orgAccountClient && orgIssuerDelegation && orgIndivDelegation ) {
    
            // now create attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: RegisteredENSAttestation = {
              name: cleanName,
              enscreationdate: enscreationdateSeconds,
              attester: orgDid,
              entityId: entityId,
              class: "organization",
              category: "identity",
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              proof: proof
            };
    
            // Use the signer directly from signatory
            const walletSigner = signatory.signer;
            
            if (!walletSigner) {
              console.error("Failed to get wallet signer");
              return;
            }
    
            const uid = await AttestationService.addRegisteredENSAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
            console.info("add org ens attestation complete")
    
          }
        }
      }
      // Refresh the parent component
      if (onRefresh) {
        onRefresh();
      }

    } catch (error) {
      console.error('Error registering/updating ENS name:', error);
      setError(error instanceof Error ? error.message : 'Failed to register/update ENS name. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createSubdomain = async () => {
    if (!ensName || !chain || !orgAccountClient) {
      setError('Missing required information');
      return;
    }

    setIsCreatingSubdomain(true);
    setError(null);

    try {
      const cleanParentName = cleanEnsName(ensName);
      const result = await EnsService.createSubdomain(orgAccountClient, cleanParentName, 'bob', chain);
      setSuccess(`Subdomain "${result}" created successfully!`);
    } catch (error) {
      console.error('Error creating subdomain:', error);
      setError(error instanceof Error ? error.message : 'Failed to create subdomain');
    } finally {
      setIsCreatingSubdomain(false);
    }
  };

  // Auto-advance to logo upload if we have an existing ENS name
  useEffect(() => {
    if (shouldSkipFirstStep && activeStep === 0) {
      setActiveStep(1);
      setShouldSkipFirstStep(false);
    }
  }, [shouldSkipFirstStep, activeStep]);

  // Handle ENS name updates after modal opens
  useEffect(() => {
    console.log("Modal received existingEnsName:", existingEnsName);
    console.log("Modal current ensName:", ensName);

    if (existingEnsName && existingEnsName !== ensName) {
      console.log("Updating modal ENS name from", ensName, "to", existingEnsName);
      setEnsName(existingEnsName);
      setIsExistingEns(true);
      if (activeStep === 0) {
        setActiveStep(1);
      }
    }
  }, [existingEnsName, ensName, activeStep]);

  // Fetch current avatar when we have an existing ENS name and chain
  useEffect(() => {
    if (existingEnsName && chain && isExistingEns) {
      console.log("Fetching current avatar for:", existingEnsName);

      const fetchCurrentAvatar = async () => {
        setIsFetchingAvatar(true);
        try {
          const currentAvatar = await EnsService.getEnsAvatar(existingEnsName, chain);
          console.log("Fetched current avatar:", currentAvatar);

          if (currentAvatar) {
            setImageUrl(currentAvatar);
            setLogoPreview(currentAvatar);
          } else {
            // Clear any previous values if no avatar found
            setImageUrl('');
            setLogoPreview('');
          }
        } catch (error) {
          console.error("Error fetching current avatar:", error);
          // Clear values on error
          setImageUrl('');
          setLogoPreview('');
        } finally {
          setIsFetchingAvatar(false);
        }
      };

      fetchCurrentAvatar();
    }
  }, [existingEnsName, chain, isExistingEns]);

  // Add function to fetch organization wallet balance
  const fetchOrgBalance = async () => {
    if (!orgAccountClient || !chain) return;

    setIsLoadingBalance(true);
    try {
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(RPC_URL),
      });

      const balance = await publicClient.getBalance({
        address: orgAccountClient.address as `0x${string}`
      });

      setOrgBalance(formatEther(balance));
    } catch (error) {
      console.error('Error fetching organization balance:', error);
      setOrgBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Fetch balance when modal opens or org account changes
  useEffect(() => {
    if (isVisible && orgAccountClient) {
      fetchOrgBalance();
    }
  }, [isVisible, orgAccountClient]);

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
              case 0:
          return (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {isExistingEns ? 'Select ENS Name' : 'Enter ENS Name'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {isExistingEns
                  ? 'Select the ENS name you want to update the logo for.'
                  : 'Choose a unique ENS name for your organization. This will be used as your organization\'s identity on the blockchain.'
                }
              </Typography>

                          <TextField
                fullWidth
                label="ENS Name"
                placeholder={isExistingEns ? "Enter ENS name to update (e.g., mycompany)" : "Enter your organization name (e.g., mycompany)"}
                value={ensName}
                onChange={handleEnsNameChange}
                disabled={isCheckingAvailability}
                helperText={`Your ENS name will be: ${ensName ? cleanEnsName(ensName) + '.eth' : 'example.eth'}`}
                sx={{ mb: 2 }}
                autoFocus
                InputProps={{
                  endAdornment: isCheckingAvailability ? (
                    <CircularProgress size={20} />
                  ) : isAvailable === true ? (
                    <GlobeAltIcon className="h-4 w-4 text-green-500" />
                  ) : isAvailable === false ? (
                    <XMarkIcon className="h-4 w-4 text-red-500" />
                  ) : null
                }}
              />

            {isCheckingAvailability && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">Checking availability...</Typography>
              </Box>
            )}

            {isAvailable !== null && (
              <Box sx={{ mb: 2 }}>
                {isAvailable ? (
                  <Chip
                    label="Available"
                    color="success"
                    icon={<GlobeAltIcon className="h-4 w-4" />}
                  />
                ) : (
                  <Chip
                    label="Not Available"
                    color="error"
                    icon={<XMarkIcon className="h-4 w-4" />}
                  />
                )}
              </Box>
            )}

            {estimatedCost !== '0' && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Estimated cost: {estimatedCost} ETH
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <AlertTitle>Important</AlertTitle>
                  The registration fee must be paid from your organization's smart wallet. Make sure it has sufficient Sepolia ETH.
                  {orgAccountClient && (
                    <>
                      <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                        Organization Wallet: {' '}
                        <a href={`https://sepolia.etherscan.io/address/${orgAccountClient.address}`} target="_blank">
                          {orgAccountClient.address}
                        </a>
                        {isLoadingBalance ? (
                          <CircularProgress size={16} sx={{ ml: 1 }} />
                        ) : (
                          <Typography component="span" sx={{ ml: 1 }}>
                            (Balance: {Number(orgBalance).toFixed(4)} ETH)
                          </Typography>
                        )}
                      </Typography>
                      {!isLoadingBalance && (
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            color: Number(orgBalance) >= 0.004 ? 'success.main' : 'error.main',
                            fontWeight: 'bold'
                          }}
                        >
                          {Number(orgBalance) >= 0.004
                            ? "✅ There is enough ETH for this transaction!"
                            : "❌ Not enough. Please transfer ETH to the organization's smart wallet using the address above (0.004 ETH minimum)"}
                        </Typography>
                      )}
                    </>
                  )}
                </Alert>
              </>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!ensName || !isAvailable || isCheckingAvailability}
              >
                {isExistingEns ? 'Update' : 'Next'}
              </Button>
            </Box>
          </Box>
        );

              case 1:
          return (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {isExistingEns ? 'Select New Avatar' : 'Select Organization Avatar'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {isExistingEns
                  ? 'Enter an image URL from your company website or upload a logo to update your ENS avatar.'
                  : 'Use a basic gradient avatar or provide your own logo URL.'
                }
              </Typography>

              {!isExistingEns && (
                <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant={useBasicAvatar ? "contained" : "outlined"}
                    onClick={() => {
                      setUseBasicAvatar(true);
                      const basicAvatarUrl = generateBasicAvatar(ensName || 'default');
                      setImageUrl(basicAvatarUrl);
                      setLogoPreview(basicAvatarUrl);
                    }}
                  >
                    Use Basic Avatar
                  </Button>
                </Box>
              )}

              {!useBasicAvatar && (
                <TextField
                  fullWidth
                  label="Image URL (Optional)"
                  placeholder="https://yourcompany.com/logo.png"
                  value={imageUrl}
                  onChange={handleImageUrlChange}
                  helperText={
                    isFetchingAvatar
                      ? "Loading current avatar..."
                      : isExistingEns && imageUrl
                        ? "Current avatar URL from ENS - you can modify this"
                        : isExistingEns
                          ? "No current avatar found - enter a new image URL"
                          : "Enter the URL of your company logo from your website"
                  }
                  sx={{ mb: 3 }}
                />
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                {isFetchingAvatar ? (
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      border: '2px dashed',
                      borderColor: 'grey.300',
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    <CircularProgress size={24} sx={{ mb: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Loading...
                    </Typography>
                  </Box>
                ) : logoPreview ? (
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <Avatar
                      src={logoPreview}
                      sx={{
                        width: 120,
                        height: 120,
                        border: '2px solid',
                        borderColor: 'primary.main',
                      }}
                    />
                    {!useBasicAvatar && (
                      <IconButton
                        size="small"
                        onClick={handleRemoveLogo}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            bgcolor: 'grey.100',
                          },
                        }}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </IconButton>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      border: '2px dashed',
                      borderColor: 'grey.300',
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    <GlobeAltIcon className="h-8 w-8 text-gray-400" />
                    <Typography variant="caption" color="text.secondary" align="center">
                      No avatar selected
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                >
                  {isExistingEns ? 'Update' : 'Register'}
                </Button>
              </Box>
            </Box>
          );

              case 2:
          return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {isExistingEns ? 'Confirm Logo Update' : 'Confirm ENS Registration'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {isExistingEns
          ? 'Review your logo update details before proceeding.'
          : 'Review your ENS registration details before proceeding.'
        }
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {logoPreview && (
            <Avatar src={logoPreview} sx={{ width: 60, height: 60, mr: 2 }} />
          )}
          <Box>
            <Typography variant="h6">
              {ensName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organization ENS Name
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Estimated Cost:</strong> {estimatedCost} ETH
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Registration Period:</strong> 1 year
        </Typography>
        <Typography variant="body2">
          <strong>Network:</strong> {chain?.name || 'Unknown'}
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        // Show success message, ENS link, and close button
        <Box sx={{ mt: 3 }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <a
                href={`https://sepolia.app.ens.domains/${cleanEnsName(ensName)}.eth`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#2196f3',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <GlobeAltIcon className="h-5 w-5" />
                See ENS Profile Here
              </a>
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => wrapEnsName(ensName)}
            disabled={isWrapping}
            fullWidth
            sx={{ mb: 2 }}
          >
            {isWrapping ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Wrapping ENS...
              </>
            ) : (
              'Wrap ENS Name'
            )}
          </Button>
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
              'Create "bob" Subdomain'
            )}
          </Button>
          <Button
            variant="outlined"
            onClick={handleClose}
            fullWidth
          >
            Close
          </Button>
        </Box>
      ) : (
        // Show action buttons for confirmation
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button onClick={handleBack}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleRegister}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading
              ? (isExistingEns ? 'Updating...' : 'Registering...')
              : (isExistingEns ? 'Update Logo' : 'Register ENS Name')
            }
          </Button>
        </Box>
      )}
    </Box>
  );

      default:
        return null;
    }
  };

  return (
    <Transition show={isVisible} as={React.Fragment}>
      <div className="modal-overlay">
        <Transition.Child
          as={React.Fragment}
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
                {isExistingEns ? 'Update ENS Logo' : 'Add ENS Record'}
              </h1>
              <button onClick={handleClose} className="close-button">
                <XMarkIcon className="close-icon" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="modal-content">
              <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                {getSteps(isExistingEns).map((label: string) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {renderStepContent()}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default AddEnsRecordModal;