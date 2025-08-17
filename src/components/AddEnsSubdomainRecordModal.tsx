import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, formatEther } from 'viem';

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

interface AddEnsSubdomainRecordModalProps {
  isVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  parentEnsName: string; // The parent ENS name to create subdomains under
}

const AddEnsSubdomainRecordModal: React.FC<AddEnsSubdomainRecordModalProps> = ({ 
  isVisible, 
  onClose, 
  onRefresh, 
  parentEnsName 
}) => {
  const [subdomainName, setSubdomainName] = useState('app');
  const [isCreatingSubdomain, setIsCreatingSubdomain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSubdomainInput, setShowSubdomainInput] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60); // 1 minute timer
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [canCreateSubdomain, setCanCreateSubdomain] = useState(false);
  
  // New state for wrapping functionality
  const [isCheckingWrapStatus, setIsCheckingWrapStatus] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);
  const [isParentWrapped, setIsParentWrapped] = useState<boolean | null>(null);
  const [wrapError, setWrapError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout>();

  // Update the context usage
  const { chain, signatory, orgAccountClient } = useWallectConnectContext();

  const cleanEnsName = (name: string) => {
    return name.replace('.eth', '').trim();
  };

  // Check if parent ENS domain is already wrapped
  const checkParentWrapStatus = async () => {
    if (!parentEnsName || !chain) {
      return;
    }

    setIsCheckingWrapStatus(true);
    setWrapError(null);

    try {
      const cleanName = cleanEnsName(parentEnsName);
      const status = await EnsService.checkEnsNameStatus(cleanName, chain);
      setIsParentWrapped(status.isWrapped);
    } catch (error) {
      console.error('Error checking wrap status:', error);
      setWrapError(`Failed to check wrap status: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCheckingWrapStatus(false);
    }
  };

  // Wrap the parent ENS domain
  const wrapParentDomain = async () => {
    if (!parentEnsName || !chain || !orgAccountClient) {
      setWrapError('Missing required information for wrapping');
      return;
    }

    setIsWrapping(true);
    setWrapError(null);

    try {
      const signer = signatory.signer;
      const cleanName = cleanEnsName(parentEnsName);
      const wrappedName = await EnsService.wrapEnsDomainName(signer, orgAccountClient, cleanName, chain);
      console.log('Parent ENS domain wrapped successfully:', wrappedName);
      setIsParentWrapped(true);
      setSuccess(`Parent domain "${wrappedName}.eth" has been wrapped successfully! You can now create subdomains.`);
      
      // Call refresh if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error wrapping parent ENS domain:', error);
      setWrapError(`Failed to wrap parent domain: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsWrapping(false);
    }
  };

  // Check wrap status when component mounts or parentEnsName changes
  useEffect(() => {
    if (isVisible && parentEnsName) {
      checkParentWrapStatus();
    }
  }, [isVisible, parentEnsName]);

  const createSubdomain = async () => {
    if (!parentEnsName || !chain || !orgAccountClient) {
      setError('Missing required information');
      return;
    }

    if (!subdomainName.trim()) {
      setError('Please enter a subdomain name');
      return;
    }

    setIsCreatingSubdomain(true);
    setError(null);

    try {
      const signer = signatory.signer;
      const cleanParentName = cleanEnsName(parentEnsName);
      const result = await EnsService.createSubdomain(signer, orgAccountClient, cleanParentName, subdomainName.trim(), chain);
      setSuccess(`Subdomain "${result}" created successfully!`);
      
      // Reset form
      setSubdomainName('app');
      setShowSubdomainInput(false);
      
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

  // Timer effect for subdomain creation
  useEffect(() => {
    if (isTimerActive && timerSeconds > 0) {
      timerRef.current = setTimeout(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerActive(false);
      setCanCreateSubdomain(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isTimerActive, timerSeconds]);

  // Start timer when subdomain input is shown
  useEffect(() => {
    if (showSubdomainInput && !isTimerActive && timerSeconds === 60) {
      setIsTimerActive(true);
      setCanCreateSubdomain(false);
    }
  }, [showSubdomainInput, isTimerActive, timerSeconds]);

  // Reset timer when subdomain input is hidden
  useEffect(() => {
    if (!showSubdomainInput) {
      setIsTimerActive(false);
      setTimerSeconds(60);
      setCanCreateSubdomain(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [showSubdomainInput]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setSubdomainName('app');
    setShowSubdomainInput(false);
    setTimerSeconds(60);
    setIsTimerActive(false);
    setCanCreateSubdomain(false);
    setWrapError(null);
    onClose();
  };

  const handleCreateAnother = () => {
    setSuccess(null);
    setSubdomainName('app');
    setShowSubdomainInput(false);
    setTimerSeconds(60);
    setIsTimerActive(false);
    setCanCreateSubdomain(false);
    setWrapError(null);
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
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <Transition
            show={isVisible}
            enter="transition ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="transition ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:min-w-[450px] sm:max-w-lg sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <GlobeAltIcon className="h-6 w-6 text-blue-600 mr-2" />
                  <Typography variant="h6" component="h2">
                    Create ENS Subdomain
                  </Typography>
                </div>
                <IconButton onClick={handleClose} size="small">
                  <XMarkIcon className="h-5 w-5" />
                </IconButton>
              </div>

              {/* Parent ENS Name Display */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.primary" gutterBottom>
                  Parent Domain:
                </Typography>
                <Typography variant="h6" fontWeight="medium">
                  {parentEnsName}
                </Typography>
                
                {/* Initial Loading State */}
                {isParentWrapped === null && !isCheckingWrapStatus && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Loading wrap status...
                    </Typography>
                  </Box>
                )}
                
                {/* Wrap Status and Action */}
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  {isCheckingWrapStatus ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Checking wrap status...
                      </Typography>
                    </Box>
                  ) : isParentWrapped === null ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
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
                  ) : isParentWrapped ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="success.main" sx={{ fontWeight: 'medium' }}>
                        ✓ Domain is wrapped
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={checkParentWrapStatus}
                        disabled={isCheckingWrapStatus}
                        sx={{ ml: 1 }}
                      >
                        Refresh
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'medium' }}>
                        ⚠ Domain needs to be wrapped
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={wrapParentDomain}
                        disabled={isWrapping}
                        sx={{ ml: 1 }}
                      >
                        {isWrapping ? (
                          <>
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                            Wrapping...
                          </>
                        ) : (
                          'Wrap Domain'
                        )}
                      </Button>
                    </Box>
                  )}
                </Box>
                
                {/* Wrap Error Display */}
                {wrapError && (
                  <Alert severity="error" sx={{ mt: 2 }} onClose={() => setWrapError(null)}>
                    {wrapError}
                  </Alert>
                )}
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
              {!success && !isParentWrapped && isParentWrapped !== null && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="info">
                    <AlertTitle>Parent Domain Must Be Wrapped</AlertTitle>
                    The parent ENS domain must be wrapped before you can create subdomains. Please wrap the domain first using the button above.
                  </Alert>
                </Box>
              )}
              
              {/* Subdomain Creation Section */}
              {!success && isParentWrapped && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                    Create Subdomain
                  </Typography>
                  {!showSubdomainInput ? (
                    <Button
                      variant="outlined"
                      onClick={() => setShowSubdomainInput(true)}
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      Create Custom Subdomain
                    </Button>
                  ) : (
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        label="Subdomain Name"
                        placeholder="Enter subdomain (e.g., app, team, support)"
                        value={subdomainName}
                        onChange={(e) => setSubdomainName(e.target.value)}
                        helperText={`Will create: ${subdomainName}.${cleanEnsName(parentEnsName)}.eth`}
                        sx={{ mb: 2 }}
                      />
                      {/* Timer Display */}
                      {isTimerActive && timerSeconds > 0 && (
                        <Box sx={{ mb: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Please wait before creating subdomain: {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          onClick={createSubdomain}
                          disabled={isCreatingSubdomain || !subdomainName.trim() || !canCreateSubdomain}
                          sx={{ flex: 1 }}
                        >
                          {isCreatingSubdomain ? (
                            <>
                              <CircularProgress size={20} sx={{ mr: 1 }} />
                              Creating...
                            </>
                          ) : !canCreateSubdomain ? (
                            `Wait ${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`
                          ) : (
                            'Create Subdomain'
                          )}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setShowSubdomainInput(false);
                            setSubdomainName('app');
                          }}
                          sx={{ flex: 1 }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Close Button */}
              {!success && (
                <Button
                  variant="outlined"
                  onClick={handleClose}
                  fullWidth
                >
                  Close
                </Button>
              )}
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  );
};

export default AddEnsSubdomainRecordModal;
