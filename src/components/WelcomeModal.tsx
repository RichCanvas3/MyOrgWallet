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

import AttestationService from "../service/AttestationService"
import { OrgAttestation, RegisteredDomainAttestation } from "../models/Attestation"
import { domainSeparator } from 'viem';
import { useAccount } from 'wagmi';

import '../custom_styles.css'
import { chainIdNetworkParamsMapping } from '@blockchain-lab-um/masca-connector';

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

  const { chain, setIndivAndOrgInfo, setOrgNameValue, setOrgDidValue, checkIfDIDBlacklisted, setSelectedSignatoryFactoryName } = useWallectConnectContext();

  const steps: Step[] = [
    { id: 1, title: 'Your Name',      isActive: currentStep === 1, isCompleted: currentStep > 1 },
    { id: 2, title: 'Early Access', isActive: currentStep === 2, isCompleted: currentStep > 2 },
    { id: 3, title: 'Connect Wallet', isActive: currentStep === 3, isCompleted: currentStep > 3 },
    { id: 4, title: 'Your Org Name',      isActive: currentStep === 4, isCompleted: currentStep > 4 },
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

  const sendVerificationEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      handleToast('Please enter a valid email address.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/send-verification`, { email });
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
      setCurrentStep(4);
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Invalid verification code.', 'error');
    } finally {
      setIsSubmitting(false);
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

    // Step 1: full name
    if (currentStep === 1) {
      if (!fullName.trim()) {
        handleToast('Please enter your name.', 'error');
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2: early access code
    if (currentStep === 2) {
      if (!earlyAccessCode.trim()) {
        handleToast('Please enter your early access code.', 'error');
        return;
      }
      // You can add validation for specific access codes here
      if (earlyAccessCode.toLowerCase() !== 'early2024' && earlyAccessCode.toLowerCase() !== 'beta') {
        handleToast('Invalid early access code. Please check your code and try again.', 'error');
        return;
      }
      setCurrentStep(3);
      return;
    }

    // Step 3: wallet connection (Web3Auth or MetaMask)
    if (currentStep === 3) {
      if (connectionMethod === 'web3auth') {
        // Web3Auth connection
        if (!email.trim() || !email.includes('@')) {
          handleToast('Please enter a valid email address.', 'error');
          return;
        }
        if (!password.trim()) {
          handleToast('Please enter your password.', 'error');
          return;
        }

        // Web3Auth username/password authentication
        setIsWeb3AuthConnecting(true);
        try {
          // Import Web3AuthService dynamically
          const { default: Web3AuthService } = await import('../service/Web3AuthService');
          
          // Initialize Web3Auth
          await Web3AuthService.initialize();
          
          // Connect using email/password (sign up if new account, sign in if existing)
          const signatory = await Web3AuthService.connectWithEmailPassword(email, password, isSignUpMode);
          
          const action = isSignUpMode ? 'created' : 'connected';
          console.log(`Web3Auth ${action} successfully:`, signatory);
          handleToast(`Web3Auth account ${action} successfully!`, 'success');
          
          // Set the signatory type to Web3Auth
          setSelectedSignatoryFactoryName("web3AuthSignatoryFactory");
          console.log('Web3Auth signatory type set and stored:', signatory);
          
          // get ready for step 4
          // if email is for existing registered domain then set org name
          const domain = getDomainFromEmail(email)
          if (domain && chain) {
            console.info("domain: ", domain)
            console.info("chain: ", chain)
            setOrgNameValue("")
            setOrgDidValue("")
            const registeredDomainAttestations = await AttestationService.getRegisteredDomainAttestations(chain, domain, AttestationService.RegisteredDomainSchemaUID, "domain(org)")
            console.info("registered domain attestations: ", registeredDomainAttestations)
            if (registeredDomainAttestations) {
              for (const registeredDomainAttestation of registeredDomainAttestations) {

                console.info("registered domain: ", registeredDomainAttestation)
                const orgDid = registeredDomainAttestation.attester
                const orgAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.OrgSchemaUID, "org(org)", "")
                console.info("org attestation: ", orgAttestation)
                if (orgAttestation) {

                  const orgDidValue = (orgAttestation as OrgAttestation).attester

                  console.info("check if blacklisted: ", orgDidValue)
                  const isBlacklisted = await checkIfDIDBlacklisted(orgDidValue)
                  if (!isBlacklisted) {

                    console.info("not blacklisted so continue: ", orgDidValue)

                    console.info("set org did value: ", orgDidValue)
                    setOrgDidValue(orgDidValue)

                    setOrganizationName((orgAttestation as OrgAttestation).name)
                    setOrgNameValue((orgAttestation as OrgAttestation).name)

                    break

                  }
                  else {
                    console.info("blacklisted so don't use it: ", orgDidValue)
                  }
                }
              }
            }
          }

          setCurrentStep(4);
        } catch (error: unknown) {
          console.error('Web3Auth authentication error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to authenticate with Web3Auth';
          handleToast(errorMessage, 'error');
        } finally {
          setIsWeb3AuthConnecting(false);
        }
        return;
      } else if (connectionMethod === 'metamask') {
        // MetaMask connection
        if (!email.trim() || !email.includes('@')) {
          handleToast('Please enter a valid email address.', 'error');
          return;
        }

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
          // This ensures the setup page uses the correct signatory
          setSelectedSignatoryFactoryName("injectedProviderSignatoryFactory");
          console.log('MetaMask signatory type set to injected provider');
          
          // get ready for step 4
          // if email is for existing registered domain then set org name
          const domain = getDomainFromEmail(email)
          if (domain && chain) {
            console.info("domain: ", domain)
            console.info("chain: ", chain)
            setOrgNameValue("")
            setOrgDidValue("")
            const registeredDomainAttestations = await AttestationService.getRegisteredDomainAttestations(chain, domain, AttestationService.RegisteredDomainSchemaUID, "domain(org)")
            console.info("registered domain attestations: ", registeredDomainAttestations)
            if (registeredDomainAttestations) {
              for (const registeredDomainAttestation of registeredDomainAttestations) {

                console.info("registered domain: ", registeredDomainAttestation)
                const orgDid = registeredDomainAttestation.attester
                const orgAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.OrgSchemaUID, "org(org)", "")
                console.info("org attestation: ", orgAttestation)
                if (orgAttestation) {

                  const orgDidValue = (orgAttestation as OrgAttestation).attester

                  console.info("check if blacklisted: ", orgDidValue)
                  const isBlacklisted = await checkIfDIDBlacklisted(orgDidValue)
                  if (!isBlacklisted) {

                    console.info("not blacklisted so continue: ", orgDidValue)

                    console.info("set org did value: ", orgDidValue)
                    setOrgDidValue(orgDidValue)

                    setOrganizationName((orgAttestation as OrgAttestation).name)
                    setOrgNameValue((orgAttestation as OrgAttestation).name)

                    break

                  }
                  else {
                    console.info("blacklisted so don't use it: ", orgDidValue)
                  }
                }
              }
            }
          }

          setCurrentStep(4);
        } catch (error: unknown) {
          console.error('MetaMask connection error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to connect MetaMask';
          handleToast(errorMessage, 'error');
        } finally {
          setIsMetaMaskConnecting(false);
        }
        return;
      }
    }

    // Step 4: organization name
    if (currentStep === 4) {
      if (!organizationName.trim()) {
        handleToast('Please enter your organization name.', 'error');
        return;
      }

      setIsSubmitting(true);
      try {
        await setIndivAndOrgInfo(fullName, organizationName, email);
        handleToast('Organization setup completed!', 'success');
        navigate('/setup');
      } catch (err: any) {
        handleToast(err.message || 'Failed to complete setup.', 'error');
      } finally {
        setIsSubmitting(false);
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
                  <Typography>Your full name</Typography>
                  <TextField fullWidth placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
                </Box>
              </Fade>
            )}

            {currentStep === 2 && (
              <Fade in>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography>Early Access Code</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Enter your early access code to continue
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter your access code"
                    value={earlyAccessCode}
                    onChange={e => setEarlyAccessCode(e.target.value)}
                    type="password"
                  />
                </Box>
              </Fade>
            )}

            {currentStep === 3 && (
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
                        {isSignUpMode 
                          ? 'Create a new Web3Auth account with your email and password. This will create a secure wallet for your organization.'
                          : 'Sign in to your existing Web3Auth account or create a new one. This will provide a secure wallet for your organization.'
                        }
                      </Typography>
                      
                      {/* Sign Up/Sign In Toggle */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <Button
                          variant={!isSignUpMode ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => setIsSignUpMode(false)}
                          disabled={isWeb3AuthConnecting}
                          sx={{ mr: 1 }}
                        >
                          Sign In
                        </Button>
                        <Button
                          variant={isSignUpMode ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => setIsSignUpMode(true)}
                          disabled={isWeb3AuthConnecting}
                        >
                          Sign Up
                        </Button>
                      </Box>
                      
                      <Typography>Your email at organization</Typography>
                      <TextField
                        fullWidth
                        type="email"
                        placeholder="you@organization.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        disabled={isWeb3AuthConnecting}
                      />
                      <Typography>Your password</Typography>
                      <TextField
                        fullWidth
                        type="password"
                        placeholder={isSignUpMode ? "Create a password" : "Enter your password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={isWeb3AuthConnecting}
                      />
                      {isWeb3AuthConnecting && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            {isSignUpMode ? 'Creating account with Web3Auth...' : 'Signing in with Web3Auth...'}
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}

                  {connectionMethod === 'metamask' && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Connect using MetaMask wallet. Make sure you have MetaMask installed and connected to the correct network.
                      </Typography>
                      
                      <Typography>Your email at organization</Typography>
                      <TextField
                        fullWidth
                        type="email"
                        placeholder="you@organization.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        disabled={isMetaMaskConnecting}
                      />
                      
                      {isMetaMaskConnecting && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Connecting to MetaMask...
                          </Typography>
                        </Box>
                      )}
                    </>
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
                (currentStep === 1 && !fullName.trim()) ||
                (currentStep === 2 && !earlyAccessCode.trim()) ||
                (currentStep === 3 && connectionMethod === 'web3auth' && (!email.trim() || !password.trim())) ||
                (currentStep === 3 && connectionMethod === 'metamask' && !email.trim()) ||
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
