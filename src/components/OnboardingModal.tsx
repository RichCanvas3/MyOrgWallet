import * as React from 'react';
import { useState } from 'react';
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

const OnboardingModal = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const [steps, setSteps] = useState([
    { id: 1, title: 'Org Name', isCompleted: false, isActive: true },
    { id: 2, title: 'Your Name', isCompleted: false, isActive: false },
    { id: 3, title: 'Email Verification', isCompleted: false, isActive: false },
    { id: 4, title: 'LinkedIn Verification', isCompleted: false, isActive: false },
  ]);

  const updateStepStatus = (stepNumber: number, isActive: boolean, isCompleted: boolean) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepNumber ? { ...step, isActive, isCompleted } : step
      )
    );
  };

  const handleToast = (message: string, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  const sendVerificationEmail = async () => {
    try {
      console.info("email to send: ", email)
      const response = await axios.post('http://localhost:4000/send-verification-email', { email });
      handleToast(response.data.message, 'info');
      setShowVerification(true);
    } catch (error) {
      handleToast(
        error.response?.data?.error || 'Failed to send verification email',
        'error'
      );
    }
  };
  const verifyCode = async () => {
    try {
      const response = await axios.post('http://localhost:4000/verify-code', {
        email,
        code: verificationCode,
      });
      handleToast(response.data.message, 'success');
      return true;
    } catch (error) {
      handleToast(
        error.response?.data?.error || 'Failed to verify code',
        'error'
      );
      return false;
    }
  };
  const handleNextStep = async () => {
    if (currentStep === 1 && !organizationName.trim()) {
      handleToast('Please enter your organization name to continue.', 'error');
      return;
    }

    if (currentStep === 2 && !fullName.trim()) {
      handleToast('Please enter your full name to continue.', 'error');
      return;
    }

    if (currentStep === 3) {
      if (!email.trim() || !email.includes('@')) {
        handleToast('Please enter a valid email address to continue.', 'error');
        return;
      }

      if (showVerification) {
        const isVerified = await verifyCode();
        if (!isVerified) return;
      } else {
        await sendVerificationEmail();
        return;
      }
    }

    if (currentStep === 4 && !linkedInUrl.trim()) {
      handleToast("Please enter your organization's LinkedIn URL.", 'error');
      return;
    }

    if (currentStep < 4) {
      updateStepStatus(currentStep, false, true);
      updateStepStatus(currentStep + 1, true, false);
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      updateStepStatus(currentStep, false, false);
      updateStepStatus(currentStep - 1, true, true);
      setCurrentStep((prev) => prev - 1);
      if (currentStep === 3 && showVerification) {
        setShowVerification(false);
      }
    }
  };

  const simulateSendVerificationCode = () => {
    handleToast(
      "We've sent a verification code to your email. Use code 123456 for this demo.",
      'info'
    );
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      updateStepStatus(4, true, true);
      handleToast('Your account has been successfully set up.', 'success');
      console.log('Form submitted with:', {
        organizationName,
        fullName,
        email,
        linkedInUrl,
      });
    }, 1500);
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="text.primary">
              Welcome
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Complete these steps to get started
            </Typography>
          </Box>

          {/* Steps Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid',
                      borderColor: step.isCompleted ? 'primary.main' : step.isActive ? 'primary.main' : 'grey.300',
                      bgcolor: step.isCompleted ? 'primary.main' : 'transparent',
                      color: step.isCompleted ? 'white' : step.isActive ? 'primary.main' : 'grey.500',
                      fontSize: '0.875rem',
                      fontWeight: 'medium',
                    }}
                  >
                    {step.isCompleted ? <Check fontSize="small" /> : step.id}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ mt: 1, color: step.isActive || step.isCompleted ? 'primary.main' : 'grey.500', whiteSpace: 'nowrap' }}
                  >
                    {step.title}
                  </Typography>
                </Box>
                {index < steps.length - 1 && (
                  <Divider
                    sx={{
                      flex: 1,
                      mx: 1,
                      bgcolor: steps[index + 1].isActive || steps[index + 1].isCompleted ? 'primary.main' : 'grey.300',
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </Box>

          <Divider />

          {/* Form Content */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Step 1 - Organization Name */}
            {currentStep === 1 && (
              <Fade in={true}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="body1">Organization Name</Typography>
                  <TextField
                    id="organization"
                    placeholder="Acme Inc."
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    variant="outlined"
                    fullWidth
                  />
                </Box>
              </Fade>
            )}

            {/* Step 2 - Your Name */}
            {currentStep === 2 && (
              <Fade in={true}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="body1">Your Full Name</Typography>
                  <TextField
                    id="fullName"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    variant="outlined"
                    fullWidth
                  />
                </Box>
              </Fade>
            )}

            {/* Step 3 - Email Verification */}
            {currentStep === 3 && (
              <Fade in={true}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="body1">Your Organization Email</Typography>
                  <TextField
                    id="email"
                    type="email"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={showVerification}
                    variant="outlined"
                    fullWidth
                  />
                  {showVerification && (
                    <Fade in={true}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <Typography variant="body1">Verification Code</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <TextField
                            id="verificationCode"
                            placeholder="123456"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            variant="outlined"
                            fullWidth
                          />
                          <Button variant="outlined" onClick={simulateSendVerificationCode}>
                            Resend
                          </Button>
                        </Box>
                        <Typography variant="caption" sx={{ mt: 1 }}>
                          For this demo, use the code: 123456
                        </Typography>
                      </Box>
                    </Fade>
                  )}
                </Box>
              </Fade>
            )}

            {/* Step 4 - LinkedIn Verification */}
            {currentStep === 4 && (
              <Fade in={true}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="body1">Organization LinkedIn URL</Typography>
                  <TextField
                    id="linkedIn"
                    placeholder="linkedin.com/company/your-organization"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    variant="outlined"
                    fullWidth
                  />
                  <Typography variant="caption" sx={{ mt: 1 }}>
                    This helps us verify your organization and connect you with colleagues.
                  </Typography>
                </Box>
              </Fade>
            )}
          </Box>

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            {currentStep > 1 ? (
              <Button
                variant="outlined"
                onClick={handlePreviousStep}
                startIcon={<ArrowBack />}
              >
                Back
              </Button>
            ) : (
              <Box />
            )}
            <Button
              variant="contained"
              onClick={handleNextStep}
              disabled={isSubmitting}
              endIcon={currentStep !== 4 && !(currentStep === 3 && !showVerification) ? <ArrowForward /> : null}
            >
              {isSubmitting
                ? 'Processing...'
                : currentStep === 3 && !showVerification
                ? 'Send Verification Code'
                : currentStep === 4
                ? 'Complete Setup'
                : 'Next'}
            </Button>
          </Box>
        </CardContent>
      </Card>
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

export default OnboardingModal;