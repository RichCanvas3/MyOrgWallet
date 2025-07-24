import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { namehash } from 'viem';

import {
  XMarkIcon,
  PhotoIcon,
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
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import EnsService from '../service/EnsService';
import { RPC_URL, BUNDLER_URL } from "../config";

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



  const { chain, orgAccountClient, burnerAccountClient } = useWallectConnectContext();

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

  // Check ENS name availability or ownership
  const checkAvailability = async (name: string) => {
    if (!name || !chain) return;
    
    setIsCheckingAvailability(true);
    setError(null);
    
    try {

      const cleanName = cleanEnsName(name);
      const fullName = cleanName + '.eth';
      
      // Check if the name is available using EnsService
      const ensClient = createPublicClient({
        chain: chain as any,
        transport: http(RPC_URL),
      });

      // Check if this is an existing ENS name we're updating
      if (isExistingEns && existingEnsName) {
        // For existing ENS names, we assume the user owns it
        setIsAvailable(true);
        setEstimatedCost('0'); // No cost for updating
        return;
      }

      // For new registrations, check availability
      const node = namehash(fullName);
      
      // This is a placeholder - you'd need to implement proper availability checking
      // For now, we'll assume it's available if it's not too short
      const isNameValid = cleanName.length >= 3 && cleanName.length <= 63;
      setIsAvailable(isNameValid);
      
      if (isNameValid) {
        // Calculate estimated cost (placeholder)
        setEstimatedCost('0.01'); // This would be calculated from the ENS registrar
      }
      
    } catch (error) {
      console.error('Error checking availability:', error);
      setError('Failed to check ENS name availability');
      setIsAvailable(false);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Handle ENS name input change
  const handleEnsNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEnsName(value);
    
    // Check availability after a delay
    const timeoutId = setTimeout(() => {
      if (value.length >= 3) {
        checkAvailability(value);
      } else {
        setIsAvailable(null);
        setEstimatedCost('0');
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  };

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



  // Register or update ENS name
  const handleRegister = async () => {
    if (!ensName || !chain || !orgAccountClient) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("before cleanEnsName 2:", ensName);
      const cleanName = cleanEnsName(ensName);
      console.log("after cleanEnsName 2:", cleanName);
      
      if (isExistingEns) {
        // Update existing ENS name with new logo
        if (imageUrl) {
          let success = await EnsService.updateEnsAvatar(orgAccountClient, cleanName + '.eth', imageUrl, chain);
          
          // If the provided ENS name doesn't exist, try to find the correct one
          if (!success) {
            console.log("Provided ENS name doesn't exist, trying to find correct ENS name...");
            const correctEnsName = await EnsService.findCorrectEnsName(orgAccountClient, chain);
            
            if (correctEnsName) {
              console.log("Found correct ENS name:", correctEnsName);
              setEnsName(correctEnsName);
              success = await EnsService.updateEnsAvatar(orgAccountClient, correctEnsName, imageUrl, chain);
              
              if (success) {
                setSuccess(`ENS avatar for "${correctEnsName}" updated successfully!`);
              } else {
                setError(`Failed to update ENS avatar for "${correctEnsName}". Please try again.`);
                return;
              }
            } else {
              setError(`ENS name "${cleanName}.eth" doesn't exist on ${chain.name}. Please check the ENS name or register it first.`);
              return;
            }
          } else {
            setSuccess(`ENS avatar for "${cleanName}.eth" updated successfully!`);
          }
        } else {
          setError('Please provide an image URL to update.');
          return;
        }
      } else {
        // Register new ENS name
        const result = await EnsService.createEnsDomainName(orgAccountClient, cleanName, chain);
        setSuccess(`ENS name "${result}" registered successfully!`);
      }
      
      // Refresh the parent component
      if (onRefresh) {
        onRefresh();
      }
      
      // Close modal after a delay
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error) {
      console.error('Error registering/updating ENS name:', error);
      setError('Failed to register/update ENS name. Please try again.');
    } finally {
      setIsLoading(false);
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Estimated cost: {estimatedCost} ETH
              </Typography>
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
                  : 'Enter an image URL from your company website or upload a logo for your organization. This will be displayed as your ENS avatar.'
                }
              </Typography>
            
            {isFetchingAvatar && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">Loading current avatar...</Typography>
              </Box>
            )}
            
            <TextField
              fullWidth
              label="Image URL"
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
                    sx={{ width: 120, height: 120, mb: 2 }}
                  />
                  <IconButton
                    onClick={handleRemoveLogo}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      backgroundColor: 'error.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'error.dark',
                      },
                    }}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </IconButton>
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
                  <PhotoIcon className="h-8 w-8 text-gray-400" />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {isExistingEns ? 'No current avatar' : 'No image'}
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
                disabled={!imageUrl}
              >
                Next
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
            
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
            
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