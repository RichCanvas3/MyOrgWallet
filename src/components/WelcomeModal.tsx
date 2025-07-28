import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Card,
  CardContent,
  Button,
  TextField,
  Typography,
  Divider,
  Box,
  Fade,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
} from '@mui/material';
import { Check, ArrowForward, ArrowBack } from '@mui/icons-material';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { createWeb3AuthSignatoryFactory } from "../signers/web3AuthSignatoryFactory";
import { createInjectedProviderSignatoryFactory } from "../signers/injectedProviderSignatoryFactory";

import { ethers } from 'ethers';

import '../custom_styles.css'
import { RPC_URL, WEB3_AUTH_CLIENT_ID, WEB3_AUTH_NETWORK } from '../config';


interface Step {
  id: number;
  title: string;
  isCompleted: boolean;
  isActive: boolean;
}

const WelcomeModal: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [earlyAccessCode, setEarlyAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showEarlyAccessDialog, setShowEarlyAccessDialog] = useState(false);
  const [earlyAccessName, setEarlyAccessName] = useState('');
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('');
  const [isSubmittingEarlyAccess, setIsSubmittingEarlyAccess] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWeb3AuthConnecting, setIsWeb3AuthConnecting] = useState(false);
  const [isMetaMaskConnecting, setIsMetaMaskConnecting] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'web3auth' | 'metamask'>('web3auth');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });
  const [hasValidEarlyAccess, setHasValidEarlyAccess] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [web3AuthEmail, setWeb3AuthEmail] = useState<string>('');
  const [connectedSignatory, setConnectedSignatory] = useState<any>(null);
  const [connectedOwner, setConnectedOwner] = useState<string>('');

  const { chain, connect, setIndivAndOrgInfo, setOrgNameValue, setOrgDidValue, checkIfDIDBlacklisted, setSelectedSignatoryFactoryName } = useWallectConnectContext();

  const steps: Step[] = [
    { id: 1, title: 'Connect', isActive: currentStep === 1, isCompleted: currentStep > 1 },
    { id: 2, title: 'Your Name', isActive: currentStep === 2, isCompleted: currentStep > 2 },
    { id: 3, title: 'Your Email', isActive: currentStep === 3, isCompleted: currentStep > 3 },
    { id: 4, title: 'Your Org Name', isActive: currentStep === 4, isCompleted: currentStep > 4 },
  ];

  const handleToast = (message: string, severity: 'info' | 'success' | 'error' = 'info') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = () => setToast(t => ({ ...t, open: false }));

  const handleEarlyAccessSubmit = async () => {
    if (!earlyAccessName.trim() || !earlyAccessEmail.trim()) {
      handleToast('Please enter both name and email.', 'error');
      return;
    }
    
    if (!earlyAccessEmail.includes('@')) {
      handleToast('Please enter a valid email address.', 'error');
      return;
    }

    setIsSubmittingEarlyAccess(true);
    
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/request-early-access`, {
        name: earlyAccessName,
        email: earlyAccessEmail
      });
      
      handleToast('Early access request sent successfully! We\'ll contact you soon.', 'success');
      setShowEarlyAccessDialog(false);
      setEarlyAccessName('');
      setEarlyAccessEmail('');
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Failed to send early access request. Please try again.', 'error');
    } finally {
      setIsSubmittingEarlyAccess(false);
    }
  };

  const handleEarlyAccessCodeSubmit = () => {
    if (!earlyAccessCode.trim()) {
      handleToast('Please enter your early access code.', 'error');
      return;
    }
    // You can add validation for specific access codes here
    if (earlyAccessCode.toLowerCase() !== 'early2024' && earlyAccessCode.toLowerCase() !== 'beta') {
      handleToast('Invalid early access code. Please check your code and try again.', 'error');
      return;
    }
    setHasValidEarlyAccess(true);
    handleToast('Early access code validated successfully!', 'success');
  };

  const sendVerificationEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      handleToast('Please enter a valid email address.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/send-verification-email`, { email });
      setShowEmailVerification(true);
      handleToast('Verification code sent to your email.', 'success');
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Failed to send verification code.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      handleToast('Please enter the verification code.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/verify-code`, { email, code: verificationCode });
      handleToast('Email verified successfully!', 'success');
      setShowEmailVerification(false);
      setVerificationCode('');
      setCurrentStep(4);
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Invalid verification code.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectWallet = async () => {
    if (connectionMethod === 'web3auth') {
      setIsWeb3AuthConnecting(true);
      try {
        // Import Web3AuthService dynamically
        const { default: Web3AuthService } = await import('../service/Web3AuthService');
        
        // Initialize Web3Auth
        await Web3AuthService.initialize();
        
        // Connect using Web3Auth (this will open the modal)
        console.log('Calling Web3AuthService.connect()...');
        let web3AuthSignatory;
        try {
          web3AuthSignatory = await Web3AuthService.connect();
          console.log('Web3AuthService.connect() completed successfully:', web3AuthSignatory);
        } catch (error) {
          console.error('Web3AuthService.connect() failed:', error);
          throw error;
        }

        console.log('Web3Auth connected successfully:', web3AuthSignatory);
        handleToast('Web3Auth connected successfully!', 'success');
        
        // Set the signatory type to Web3Auth
        setSelectedSignatoryFactoryName("web3AuthSignatoryFactory");
        console.log('Web3Auth signatory type set and stored:', web3AuthSignatory);

        const signatoryFactory = createWeb3AuthSignatoryFactory({
              chain: chain as any,
              web3AuthClientId: WEB3_AUTH_CLIENT_ID,
              web3AuthNetwork: WEB3_AUTH_NETWORK,
              rpcUrl: RPC_URL,
            });

        const credentials = await signatoryFactory.login()
        
        // Store the signatory and owner for later use
        setConnectedSignatory(credentials.signatory);
        setConnectedOwner(credentials.owner);
        
        // Try to get email and name from Web3Auth user info
        if (web3AuthSignatory && web3AuthSignatory.userInfo) {
          console.log('Full Web3Auth userInfo object:', web3AuthSignatory.userInfo);
          
          if (web3AuthSignatory.userInfo.email) {
            setWeb3AuthEmail(web3AuthSignatory.userInfo.email);
            setEmail(web3AuthSignatory.userInfo.email);
            console.log('Email from Web3Auth:', web3AuthSignatory.userInfo.email);
          }
          
          // Try different possible name fields from Web3Auth
          let userName = null;
          if (web3AuthSignatory.userInfo.name) {
            userName = web3AuthSignatory.userInfo.name;
          } else if (web3AuthSignatory.userInfo.full_name) {
            userName = web3AuthSignatory.userInfo.full_name;
          } else if (web3AuthSignatory.userInfo.given_name && web3AuthSignatory.userInfo.family_name) {
            userName = `${web3AuthSignatory.userInfo.given_name} ${web3AuthSignatory.userInfo.family_name}`;
          } else if (web3AuthSignatory.userInfo.given_name) {
            userName = web3AuthSignatory.userInfo.given_name;
          } else if (web3AuthSignatory.userInfo.family_name) {
            userName = web3AuthSignatory.userInfo.family_name;
          }
          
          if (userName) {
            setFullName(userName);
            console.log('Name from Web3Auth:', userName);
          } else {
            console.log('No name found in Web3Auth userInfo, available fields:', Object.keys(web3AuthSignatory.userInfo));
          }
        }
        
        setIsWalletConnected(true);
        setCurrentStep(2);
      } catch (error: unknown) {
        console.error('Web3Auth connection error:', error);
        if (error instanceof Error) {
          handleToast(`Web3Auth connection failed: ${error.message}`, 'error');
        } else {
          handleToast('Web3Auth connection failed. Please try again.', 'error');
        }
      } finally {
        setIsWeb3AuthConnecting(false);
      }
    } else if (connectionMethod === 'metamask') {
      setIsMetaMaskConnecting(true);
      try {
        // Check if MetaMask is available
        if (typeof window.ethereum === 'undefined') {
          throw new Error('MetaMask not found. Please install MetaMask and try again.');
        }

        // Request MetaMask connection
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No MetaMask accounts found. Please connect MetaMask first.');
        }

        const owner = accounts[0];
        console.log('MetaMask connected successfully:', owner);
        handleToast('MetaMask connected successfully!', 'success');
        
        // Set the signatory type to injected provider for MetaMask
        setSelectedSignatoryFactoryName("injectedProviderSignatoryFactory");
        console.log('MetaMask signatory type set to injected provider');

        const signatoryFactory = createInjectedProviderSignatoryFactory({
          chain: chain,
          web3AuthClientId: WEB3_AUTH_CLIENT_ID,
          web3AuthNetwork: WEB3_AUTH_NETWORK,
          rpcUrl: RPC_URL,
        });

        const credentials = await signatoryFactory.login()
        
        setConnectedSignatory(credentials.signatory);
        setConnectedOwner(credentials.owner);
        
        setIsWalletConnected(true);
        setCurrentStep(2);
      } catch (error: unknown) {
        console.error('MetaMask connection error:', error);
        if (error instanceof Error) {
          handleToast(`MetaMask connection failed: ${error.message}`, 'error');
        } else {
          handleToast('MetaMask connection failed. Please try again.', 'error');
        }
      } finally {
        setIsMetaMaskConnecting(false);
      }
    }
  };

  const handleNextStep = async () => {


    function getDomainFromEmail(email: string): string | null {
      const atIndex = email.lastIndexOf('@');
      if (atIndex <= 0 || atIndex === email.length - 1) {
        // no '@', '@' at start, or '@' at end → invalid
        return null;
      }
      return email.slice(atIndex + 1);
    }


    // Step 1: Connect wallet (handled by handleConnectWallet)
    if (currentStep === 1) {
      await handleConnectWallet();
      return;
    }

    // Step 2: full name
    if (currentStep === 2) {
      if (!fullName.trim()) {
        handleToast('Please enter your name.', 'error');
        return;
      }
      setCurrentStep(3);
      return;
    }

    // Step 3: Email verification (only for MetaMask)
    if (currentStep === 3) {
      if (connectionMethod === 'metamask') {
        if (!email.trim() || !email.includes('@')) {
          handleToast('Please enter a valid email address.', 'error');
          return;
        }
        // Send verification email
        await sendVerificationEmail();
        return;
      } else if (connectionMethod === 'web3auth') {
        // For Web3Auth, show email but skip verification
        if (web3AuthEmail) {
          setEmail(web3AuthEmail);
        }
        setCurrentStep(4);
        return;
      }
    }

    // Step 4: organization name
    if (currentStep === 4) {
      if (!organizationName.trim()) {
        handleToast('Please enter your organization name.', 'error');
        return;
      }

      try {
        // Set organization name
        setOrgNameValue(organizationName);
        
        // Extract domain from email for MetaMask users
        if (connectionMethod === 'metamask' && email) {
          const domain = getDomainFromEmail(email);
          if (domain) {
            console.info("*********** domain: ", domain)
            //setOrgDidValue(domain);
          }
        }

        // Call connect function with the collected information
        if (connectedSignatory && connectedOwner) {
          await connect(connectedOwner, connectedSignatory, organizationName, fullName, email);
        } else if (connectedOwner) {
          // For MetaMask, we need to create a signatory object
          // This will be handled by the injected provider signatory factory
          await connect(connectedOwner, null, organizationName, fullName, email);
        }
        
        // Set the individual and org info
        await setIndivAndOrgInfo(fullName, organizationName, email);

        // Navigate to setup page
        navigate('/setup');
      } catch (error) {
        console.error('Error completing setup:', error);
        handleToast('Failed to complete setup. Please try again.', 'error');
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Box className="custom" sx={{ 
      minHeight: '100vh', 
      width: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      p: 2, 
      bgcolor: 'background.default' 
    }}>
      <Card sx={{ 
        maxWidth: 600, 
        width: '100%', 
        p: 3, 
        boxShadow: 3, 
        borderRadius: 2 
      }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Early Access Check */}
          {!hasValidEarlyAccess ? (
            <Fade in>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Header */}
                <Box textAlign="center">
                  <Typography variant="h4">Welcome to MyOrgWallet</Typography>
                  <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                    We're currently in beta phase with a limited user community. 
                    Join our exclusive group of early adopters to help shape the future of organizational wallet management.
                  </Typography>
                </Box>

                <Divider />

                {/* Early Access Code Input */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6">Early Access Code</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Enter your early access code to continue with the setup process
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter your access code"
                    value={earlyAccessCode}
                    onChange={e => setEarlyAccessCode(e.target.value)}
                    type="password"
                  />
                  <Button
                    variant="contained"
                    onClick={handleEarlyAccessCodeSubmit}
                    disabled={isSubmitting || !earlyAccessCode.trim()}
                    sx={{ mt: 2 }}
                  >
                    Validate Code
                  </Button>
                </Box>

                {/* Request Early Access Link */}
                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    Don't have an access code?
                  </Typography>
                  <Button
                    variant="text"
                    onClick={() => setShowEarlyAccessDialog(true)}
                    sx={{ mt: 1 }}
                  >
                    Request Early Access
                  </Button>
                </Box>
              </Box>
            </Fade>
          ) : (
            <>
              {/* Header */}
              <Box textAlign="center">
                <Typography variant="h4">Welcome to MyOrgWallet</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>Set up your organization's wallet with Web3Auth or MetaMask</Typography>
              </Box>

              {/* Step Indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {steps.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: 80,
                      }}
                    >
                      {/* circle */}
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: step.isCompleted || step.isActive ? 'primary.main' : 'grey.300',
                          bgcolor: step.isCompleted ? 'primary.main' : 'transparent',
                          color: step.isCompleted ? 'white' : step.isActive ? 'primary.main' : 'grey.500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {step.isCompleted ? <Check fontSize="small" /> : step.id}
                      </Box>
                      {/* label */}
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 1,
                          textAlign: 'center',
                          color: step.isActive || step.isCompleted ? 'primary.main' : 'grey.500',
                        }}
                      >
                        {step.title}
                      </Typography>
                    </Box>
                    {/* connector */}
                    {idx < steps.length - 1 && (
                      <Box
                        sx={{
                          flex: 1,
                          height: 2,
                          mx: 1,
                          bgcolor:
                            steps[idx + 1].isActive || steps[idx + 1].isCompleted
                              ? 'primary.main'
                              : 'grey.300',
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </Box>

              <Divider />

              {/* Step content */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {currentStep === 1 && (
                  <Fade in>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Connection Method Selection */}
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Choose Your Connection Method
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <Button
                          variant={connectionMethod === 'web3auth' ? 'contained' : 'outlined'}
                          onClick={() => setConnectionMethod('web3auth')}
                          disabled={isWeb3AuthConnecting || isMetaMaskConnecting}
                          sx={{ flex: 1 }}
                        >
                          Web3Auth
                        </Button>
                        <Button
                          variant={connectionMethod === 'metamask' ? 'contained' : 'outlined'}
                          onClick={() => setConnectionMethod('metamask')}
                          disabled={isWeb3AuthConnecting || isMetaMaskConnecting}
                          sx={{ flex: 1 }}
                        >
                          MetaMask
                        </Button>
                      </Box>

                      {connectionMethod === 'web3auth' && (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Connect using Web3Auth for a seamless authentication experience. This will open a modal for you to sign in.
                          </Typography>
                        </>
                      )}

                      {connectionMethod === 'metamask' && (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Connect using MetaMask wallet. Make sure you have MetaMask installed and connected to the correct network.
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Fade>
                )}

                {currentStep === 2 && (
                  <Fade in>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>Your full name</Typography>
                      <TextField 
                        fullWidth 
                        placeholder="Jane Doe" 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)}
                        disabled={connectionMethod === 'web3auth' && fullName.trim() !== ''}
                        sx={connectionMethod === 'web3auth' && fullName.trim() !== '' ? { backgroundColor: '#f5f5f5' } : {}}
                      />
                      {connectionMethod === 'web3auth' && fullName.trim() !== '' && (
                        <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                          ✓ Using name from Web3Auth: {fullName}
                        </Typography>
                      )}
                    </Box>
                  </Fade>
                )}

                {currentStep === 3 && (
                  <Fade in>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>Your email at organization</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {connectionMethod === 'metamask' 
                          ? "We'll send a verification code to this email address."
                          : "Email from your Web3Auth account will be used."
                        }
                      </Typography>
                      <TextField
                        fullWidth
                        type="email"
                        placeholder="you@organization.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        disabled={isSubmitting || connectionMethod === 'web3auth'}
                        sx={connectionMethod === 'web3auth' ? { backgroundColor: '#f5f5f5' } : {}}
                      />
                      {connectionMethod === 'web3auth' && web3AuthEmail && (
                        <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                          ✓ Using email from Web3Auth: {web3AuthEmail}
                        </Typography>
                      )}
                      {isSubmitting && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Sending verification code...
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Fade>
                )}

                {currentStep === 4 && (
                  <Fade in>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>Your organization name</Typography>
                      <TextField 
                        fullWidth 
                        placeholder="Acme Corp" 
                        value={organizationName} 
                        onChange={e => setOrganizationName(e.target.value)} 
                      />
                    </Box>
                  </Fade>
                )}


              </Box>

          {/* Action Area */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body1">{`Step ${currentStep}: ${steps[currentStep - 1]?.title}`}</Typography>
            <Button
              className="solid"
              variant="contained"
              onClick={handleNextStep}
              disabled={
                (currentStep === 2 && !fullName.trim()) ||
                (currentStep === 3 && connectionMethod === 'metamask' && !email.trim()) ||
                (currentStep === 3 && connectionMethod === 'web3auth' && !web3AuthEmail) ||
                (currentStep === 4 && !organizationName.trim()) ||
                isSubmitting ||
                isWeb3AuthConnecting ||
                isMetaMaskConnecting
              }
              sx={{ mt: 2 }}
            >
              {isSubmitting || isWeb3AuthConnecting || isMetaMaskConnecting ? 'Processing...' : (currentStep === 4 ? 'Complete Setup' : 'Next')}
            </Button>
          </Box>

              {/* Back & (implicit) Next */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 2 }}>
                {currentStep > 1 && (
                  <Button
                    className="outlined"
                    variant="outlined"
                    startIcon={<ArrowBack />}
                    onClick={handlePreviousStep}
                  >
                    Back
                  </Button>
                )}
              </Box>
            </>
          )}

          {/* Early access dialog */}
          <Dialog open={showEarlyAccessDialog} onClose={() => setShowEarlyAccessDialog(false)}>
            <DialogTitle>Request Early Access</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                label="Name"
                value={earlyAccessName}
                onChange={e => setEarlyAccessName(e.target.value)}
                sx={{ mb: 2, mt: 1 }}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={earlyAccessEmail}
                onChange={e => setEarlyAccessEmail(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowEarlyAccessDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleEarlyAccessSubmit} 
                disabled={isSubmittingEarlyAccess || !earlyAccessName.trim() || !earlyAccessEmail.trim()}
              >
                Submit
              </Button>
            </DialogActions>
          </Dialog>

          {/* Email verification dialog */}
          <Dialog open={showEmailVerification} onClose={() => setShowEmailVerification(false)}>
            <DialogTitle>Verify Your Email</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                We've sent a verification code to {email}. Please enter it below.
              </Typography>
              <TextField
                fullWidth
                label="Verification Code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowEmailVerification(false)}>Cancel</Button>
              <Button onClick={verifyCode} disabled={isSubmitting || !verificationCode.trim()}>
                Verify
              </Button>
            </DialogActions>
          </Dialog>
        </CardContent>
      </Card>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WelcomeModal;
