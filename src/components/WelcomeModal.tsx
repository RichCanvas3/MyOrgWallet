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
} from '@mui/material';
import { Check, ArrowForward, ArrowBack } from '@mui/icons-material';

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
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });

  // Flipped step order: Full Name first, then Org Name
  const steps: Step[] = [
    { id: 1, title: 'Your Name', isActive: currentStep === 1, isCompleted: currentStep > 1 },
    { id: 2, title: 'Org Name', isActive: currentStep === 2, isCompleted: currentStep > 2 },
    { id: 3, title: 'Org Verification', isActive: currentStep === 3, isCompleted: currentStep > 3 },
  ];

  const handleToast = (message: string, severity: 'info' | 'success' | 'error' = 'info') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = () => setToast((t) => ({ ...t, open: false }));

  const sendVerificationEmail = async () => {
    try {
      const response = await axios.post('http://localhost:4000/send-verification-email', { email });
      handleToast(response.data.message, 'info');
      setShowEmailVerification(true);
    } catch (error: any) {
      handleToast(error.response?.data?.error || 'Failed to send verification email', 'error');
    }
  };

  const verifyCode = async () => {
    try {
      const response = await axios.post('http://localhost:4000/verify-code', { email, code: verificationCode });
      handleToast(response.data.message, 'success');
      return true;
    } catch (error: any) {
      handleToast(error.response?.data?.error || 'Invalid verification code', 'error');
      return false;
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 1 && !fullName.trim()) {
      handleToast('Please enter your name.', 'error');
      return;
    }
    if (currentStep === 2 && !organizationName.trim()) {
      handleToast('Please enter your organization name.', 'error');
      return;
    }
    if (currentStep === 3) {
      if (!email.trim() || !email.includes('@')) {
        handleToast('Please enter a email to verify organization.', 'error');
        return;
      }
      if (!showEmailVerification) {
        await sendVerificationEmail();
        return;
      }
      const ok = await verifyCode();
      if (!ok) return;
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        handleToast('Setup complete! Redirecting...', 'success');
        navigate('/setup');
      }, 1000);
      return;
    }
    setCurrentStep((s) => s + 1);
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      if (currentStep === 3 && showEmailVerification) {
        setShowEmailVerification(false);
      }
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3">Welcome</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Complete these steps to verify org</Typography>
          </Box>

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
                  }}>{step.isCompleted ? <Check fontSize="small" /> : step.id}</Box>
                  <Typography variant="caption" sx={{ mt: 1, color: step.isActive || step.isCompleted ? 'primary.main' : 'grey.500' }}>{step.title}</Typography>
                </Box>
                {idx < steps.length - 1 && <Divider sx={{ flex: 1, mx: 1, bgcolor: steps[idx+1].isActive||steps[idx+1].isCompleted ? 'primary.main' : 'grey.300' }} />}
              </React.Fragment>
            ))}
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {currentStep === 1 && (
              <Fade in>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography>Your Full Name</Typography>
                  <TextField fullWidth placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Box>
              </Fade>
            )}
            {currentStep === 2 && (
              <Fade in>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography>Organization Name</Typography>
                  <TextField fullWidth placeholder="Acme Inc." value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                </Box>
              </Fade>
            )}
            {currentStep === 3 && (
              <Fade in>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography>Your Email at Organization</Typography>
                  <TextField fullWidth type="email" placeholder="you@organization.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={showEmailVerification} />
                  {showEmailVerification && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>Verification Code</Typography>
                      <TextField fullWidth placeholder="123456" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
                    </Box>
                  )}
                </Box>
              </Fade>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            {currentStep > 1 ? (
              <Button variant="outlined" onClick={handlePreviousStep} startIcon={<ArrowBack />}>Back</Button>
            ) : <Box />}
            <Button variant="contained" onClick={handleNextStep} disabled={isSubmitting} endIcon={currentStep < 3 ? <ArrowForward /> : null}>
              {currentStep === 3
                ? showEmailVerification
                  ? 'Complete Setup'
                  : 'Send Verification'
                : 'Next'
              }
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Snackbar open={toast.open} autoHideDuration={6000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WelcomeModal;
