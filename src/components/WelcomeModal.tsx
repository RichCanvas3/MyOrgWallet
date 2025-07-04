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
  const [verificationCode, setVerificationCode] = useState('');
  const [showEarlyAccessDialog, setShowEarlyAccessDialog] = useState(false);
  const [earlyAccessName, setEarlyAccessName] = useState('');
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('');
  const [isSubmittingEarlyAccess, setIsSubmittingEarlyAccess] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });

  const { chain, setIndivAndOrgInfo, setOrgNameValue, setOrgDidValue, checkIfDIDBlacklisted } = useWallectConnectContext();

  const steps: Step[] = [
    { id: 1, title: 'Your Name',      isActive: currentStep === 1, isCompleted: currentStep > 1 },
    { id: 2, title: 'Early Access', isActive: currentStep === 2, isCompleted: currentStep > 2 },
    { id: 3, title: 'Your Org Email', isActive: currentStep === 3, isCompleted: currentStep > 3 },
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
    try {
      console.info("send verification ..........: ", import.meta.env.VITE_API_URL)
      const resp = await axios.post(`${import.meta.env.VITE_API_URL}/send-verification-email`, { email });
      handleToast(resp.data.message, 'info');
      setShowEmailVerification(true);
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Failed to send verification email', 'error');
    }
  };

  const verifyCode = async () => {
    try {
      const resp = await axios.post(`${import.meta.env.VITE_API_URL}/verify-code`, { email, code: verificationCode });
      handleToast(resp.data.message, 'success');
      return true;
    } catch (err: any) {
      handleToast(err.response?.data?.error || 'Invalid verification code', 'error');
      return false;
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

    // Step 3: email/org-verification
    if (currentStep === 3) {
      if (!email.trim() || !email.includes('@')) {
        handleToast('Please enter a valid email to verify organization.', 'error');
        return;
      }
      if (!showEmailVerification) {
        await sendVerificationEmail();
        return;
      }
      const ok = await verifyCode();
      if (!ok) return;
      // once verified, move on
      setShowEmailVerification(false);

      // get ready for step 3
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
      return;
    }

    // Step 4: organization name & final submit
    if (currentStep === 4) {

      if (!organizationName.trim()) {
        handleToast('Please enter your organization name.', 'error');
        return;
      }
      setIsSubmitting(true);

      await setIndivAndOrgInfo(fullName, organizationName, email)

      setTimeout(() => {

        setIsSubmitting(false);
        handleToast('Setup complete! Redirecting...', 'success');

        navigate('/setup');

      }, 1000);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      // if backing out of the email step reset verification UI
      if (currentStep === 2 && showEmailVerification) {
        setShowEmailVerification(false);
      }
      setCurrentStep(s => s - 1);
    }
  };

  return (
    <Box className="custom" sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ position: 'relative', maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{marginBottom: '30px'}}>Welcome</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Complete these steps to verify your organization and create your smart wallets.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Before beginning, make sure you have a <a className="colored_link" href="https://metamask.io/" target="_blank">MetaMask</a> account.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Watch <a className="colored_link" href="https://youtu.be/BI3S2YsL-po" target="_blank">How to Set Up MetaMask</a>.</Typography>
          </Box>

          {/* Stepper */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {steps.map((step, idx) => (
              <React.Fragment key={step.id}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid',
                    borderColor: step.isCompleted ? 'primary.main' : step.isActive ? 'primary.main' : 'grey.300',
                    bgcolor: step.isCompleted ? 'primary.main' : 'transparent',
                    color: step.isCompleted ? 'white' : step.isActive ? 'primary.main' : 'grey.500'
                  }}>
                    {step.isCompleted ? <Check fontSize="small" /> : step.id}
				  </Box>
                  <Typography variant="caption" sx={{ mt: 1, color: step.isActive || step.isCompleted ? 'primary.main' : 'grey.500' }}>
                    {step.title}
				  </Typography>
                </Box>
                {idx < steps.length - 1 && (
                  <Divider sx={{ flex: 1, mx: 1, bgcolor: steps[idx+1].isActive || steps[idx+1].isCompleted ? 'primary.main' : 'grey.300' }} />
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
                  <Typography>Your email at organization</Typography>
                  <TextField
                    fullWidth
                    type="email"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={showEmailVerification}
                  />
                  {showEmailVerification && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>Verification Code</Typography>
                      <TextField
                        fullWidth
                        placeholder="123456"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                      />
                    </Box>
                  )}
                </Box>
              </Fade>
            )}

            {currentStep === 4 && (
              <Fade in>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography>Organization Name</Typography>
                  <TextField
                    fullWidth
                    placeholder="Acme Inc."
                    value={organizationName}
                    onChange={e => setOrganizationName(e.target.value)}
                  />
                </Box>
              </Fade>
            )}
          </Box>

          {/* Navigation buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            {currentStep > 1
              ? <Button className="outlined" variant="outlined" onClick={handlePreviousStep} startIcon={<ArrowBack />}>Back</Button>
              : <Box />
            }
            <Button className="solid"
              variant="contained"
              onClick={handleNextStep}
              disabled={isSubmitting}
              endIcon={currentStep < 4 ? <ArrowForward /> : null}
            >
              {currentStep === 4
                ? 'Complete Setup'
                : showEmailVerification && currentStep === 3
                  ? 'Verify & Continue'
                  : currentStep === 3
                    ? 'Send Verification'
                    : 'Next'
              }
            </Button>
          </Box>

          {/* Early Access Disclaimer */}
          <Box sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'warning.light', 
            borderRadius: 1, 
            border: '1px solid',
            borderColor: 'warning.main'
          }}>
            <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 'medium' }}>
              ⚠️ Early Access Notice
            </Typography>
            <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 0.5 }}>
              This application is currently in early access/beta stage. Features may be limited, and you may encounter bugs or incomplete functionality. 
              We appreciate your patience as we continue to develop and improve the platform. Your feedback is valuable to us.
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <Link
                component="button"
                variant="body2"
                color="primary"
                onClick={() => setShowEarlyAccessDialog(true)}
                sx={{ 
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 'medium'
                }}
              >
                Request Early Access Code
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={toast.open} autoHideDuration={6000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Early Access Request Dialog */}
      <Dialog 
        open={showEarlyAccessDialog} 
        onClose={() => setShowEarlyAccessDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Request Early Access Code
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Enter your details below and we'll send you an early access code to get started with the platform.
            </Typography>
            
            <TextField
              fullWidth
              label="Full Name"
              placeholder="Jane Doe"
              value={earlyAccessName}
              onChange={e => setEarlyAccessName(e.target.value)}
              required
            />
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              placeholder="you@organization.com"
              value={earlyAccessEmail}
              onChange={e => setEarlyAccessEmail(e.target.value)}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setShowEarlyAccessDialog(false)}
            disabled={isSubmittingEarlyAccess}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleEarlyAccessSubmit}
            disabled={isSubmittingEarlyAccess}
          >
            {isSubmittingEarlyAccess ? 'Sending...' : 'Request Access'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WelcomeModal;
