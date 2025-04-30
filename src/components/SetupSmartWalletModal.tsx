import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import { Check, ArrowForward, ArrowBack } from '@mui/icons-material';

import { useWallectConnectContext } from "../context/walletConnectContext";

interface Step {
  id: number;
  title: string;
  isCompleted: boolean;
  isActive: boolean;
}

const SetupSmartWalletModal: React.FC = () => {
  const navigate = useNavigate();

  const { selectedSignatory, buildSmartWallet, setupSmartWallet, orgName, orgDid } = useWallectConnectContext();


  const [currentStep, setCurrentStep] = useState(1);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: 'Connect Wallet', isActive: true, isCompleted: false },
    { id: 2, title: 'Build Smart Wallet', isActive: false, isCompleted: false },
    { id: 3, title: 'Setup Wallet Permissions', isActive: false, isCompleted: false },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletBuilt, setIsWalletBuilt] = useState(false);
  const [isPermGranted, setIsPermGranted] = useState(false);

  const [signatory, setSignatory] = useState<any | undefined>();
  const [owner, setOwner] = useState<any | undefined>();


  const handleToast = (message: string, severity: 'info' | 'success' | 'error' = 'info') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = () => setToast(t => ({ ...t, open: false }));

  const advanceStep = () => {
    setSteps(prev => prev.map(s =>
      s.id === currentStep ? { ...s, isCompleted: true, isActive: false } :
      s.id === currentStep + 1 ? { ...s, isActive: true } : s
    ));
    setCurrentStep(c => c + 1);
  };

  // Step 1: Connect Wallet
  const handleWalletConnect = async () => {
    try {
      setIsSubmitting(true);
      await connect();
      handleToast('Wallet connected', 'success');
      setIsWalletConnected(true);
      setSteps(prev => prev.map(s => s.id === 1 ? { ...s, isCompleted: true } : s));
    } catch (error: any) {
      handleToast(error.message || 'Connection failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Build Smart Wallet
  const handleBuildWallet = async () => {
    try {
      setIsSubmitting(true);
      await bldSmartWallet();
      handleToast('Smart wallet built', 'success');
      setIsWalletBuilt(true);
      setSteps(prev => prev.map(s => s.id === 2 ? { ...s, isCompleted: true } : s));
    } catch (error: any) {
      handleToast(error.message || 'Build failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Grant Permissions
  const handlePermissions = async () => {
    try {
      setIsSubmitting(true);
      await requestPermissions();
      handleToast('Permissions granted', 'success');
      setIsPermGranted(true);
      setSteps(prev => prev.map(s => s.id === 3 ? { ...s, isCompleted: true } : s));
    } catch (error: any) {
      handleToast(error.message || 'Permission denied', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Next button logic
  const handleNext = () => {
    if (currentStep === 1) {
      if (isWalletConnected) advanceStep();
      return;
    }
    if (currentStep === 2) {
      if (isWalletBuilt) advanceStep();
      return;
    }
    if (currentStep === 3) {
      if (isPermGranted) {
        navigate('/dashboard');
      }
      return;
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setSteps(prev => prev.map(s =>
        s.id === currentStep ? { ...s, isActive: false, isCompleted: false } :
        s.id === currentStep - 1 ? { ...s, isActive: true, isCompleted: false } : s
      ));
      setCurrentStep(c => c - 1);
      if (currentStep === 1) setIsWalletConnected(false);
    }
  };

  const connect = async () => {
    if (selectedSignatory) {
        selectedSignatory.login().then(( loginResp ) => {
            setOwner(loginResp.owner)
            setSignatory(loginResp.signatory)
            setIsWalletConnected(true)
          })
    }
  };
  const bldSmartWallet  = async () => {
    await buildSmartWallet(owner, signatory)
  };
  const requestPermissions = async () => {
    await setupSmartWallet(owner, signatory)
  };

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 700, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4">Setup Your New Smart Wallet</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Please complete the steps below</Typography>
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
                {idx < steps.length - 1 && <Divider sx={{ flex: 1, mx: 1, bgcolor: steps[idx+1].isActive || steps[idx+1].isCompleted ? 'primary.main' : 'grey.300' }} />}
              </React.Fragment>
            ))}
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {currentStep === 1 && (
              <>
                <Typography>Click below to connect your wallet.</Typography>
                <Button variant="contained" onClick={handleWalletConnect} disabled={isSubmitting || isWalletConnected}>
                  {isWalletConnected ? 'Connected' : 'Connect your existing Wallet'}
                </Button>
              </>
            )}
            {currentStep === 2 && (
              <>
                <Typography>Now let's build your smart wallet.</Typography>
                <Button variant="contained" onClick={handleBuildWallet} disabled={isSubmitting}>
                  Build Smart Wallet
                </Button>
              </>
            )}
            {currentStep === 3 && (
              <>
                <Typography>Finally, grant permissions.</Typography>
                <Button variant="contained" onClick={handlePermissions} disabled={isSubmitting}>
                  Grant Permissions
                </Button>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            {currentStep > 1 ? (
              <Button variant="outlined" onClick={handleBack} startIcon={<ArrowBack />}>Back</Button>
            ) : <Box />}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                isSubmitting ||
                (currentStep === 1 && !isWalletConnected) ||
                (currentStep === 2 && !isWalletBuilt)
              }
              endIcon={currentStep < steps.length ? <ArrowForward /> : null}
            >
              {isSubmitting
                ? 'Processing...'
                : currentStep < steps.length
                  ? 'Next'
                  : 'Finish'
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

export default SetupSmartWalletModal;

