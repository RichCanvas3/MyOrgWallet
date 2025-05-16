import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import parse from 'html-react-parser';
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
import { Check, ArrowBack } from '@mui/icons-material';

import { useWallectConnectContext } from "../context/walletConnectContext";


interface Step {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
}

const SetupSmartWalletModal: React.FC = () => {

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const navigate = useNavigate();
  const { selectedSignatory, buildSmartWallet, setupSmartWallet } = useWallectConnectContext();


  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: 'Connect EOA Wallet', description: '', isActive: true, isCompleted: false },
    { id: 2, title: 'Build Smart Wallet', description: '',isActive: false, isCompleted: false },
    { id: 3, title: 'Setup Wallet Permissions', description: '',isActive: false, isCompleted: false },
  ]);
  const [currentStep, setCurrentStep] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });

  const [signatory, setSignatory] = useState<any | undefined>();
  const [owner, setOwner] = useState<any | undefined>();

  // Toast helpers
  const handleToast = (message: string, severity: 'info' | 'success' | 'error' = 'info') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = () => setToast(t => ({ ...t, open: false }));

  // Advance to next step
  const advanceStep = () => {
    setSteps(prev =>
      prev.map(s =>
        s.id === currentStep
          ? { ...s, isCompleted: true, isActive: false }
          : s.id === currentStep + 1
          ? { ...s, isActive: true }
          : s
      )
    );
    setCurrentStep(c => c + 1);
  };

  // Handlers for each step
  const handleWalletConnect = async () => {
    if (!selectedSignatory) return;
    setIsSubmitting(true);
    try {
      const loginResp = await selectedSignatory.login();
      setOwner(loginResp.owner)
      setSignatory(loginResp.signatory)

      // you can grab loginResp.owner/signatory if needed here
      handleToast('Wallet connected', 'success');
      advanceStep();
    } catch (err: any) {
      handleToast(err.message || 'Connection failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleBuildWallet = async () => {
    console.info("handle build wallet")
    setIsSubmitting(true);
    try {
      await buildSmartWallet(owner, signatory);
      handleToast('Smart wallet built', 'success');
      advanceStep();
    } catch (err: any) {
      handleToast(err.message || 'Build failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissions = async () => {
    setIsSubmitting(true);
    try {
      await setupSmartWallet(owner, signatory);
      console.info("start sleep")
      await sleep(13000);
      console.info("end sleep")
      handleToast('Permissions granted', 'success');

      navigate('/chat/')
    } catch (err: any) {
      handleToast(err.message || 'Permission denied', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };



  // Decide current action
  const stepAction = [
    { label: 'Connect EOA Wallet - USE OP Mainnet', description: `
      No wallet funds are required to get started. <br/><br/>
      Connect to your local Externally Owned Account (EOA) (ie. MetaMask). <br/><br/>
      This local wallet account will be the owner of your newly created Personal Smart Wallet and Organization Smart Wallet.`
      , onClick: handleWalletConnect },
    { label: 'Build Smart Wallet', description: `
        <ul style="list-style-type: disc; margin-left: 1.5em; padding-left: 0;">
          <li>Build your Personal Smart Wallet and deploy it to the blockchain.</li>
          <li>Build your Organizations Smart Wallet and deploy it to the blockchain.</li>
          <li>Setup permissions between Personal your Smart Wallet and Organizations Smart Wallet.</li>
        </ul>`
      , onClick: handleBuildWallet },
    { label: 'Grant Attestation Permissions', description: `
        <ul style="list-style-type: disc; margin-left: 1.5em; padding-left: 0;">
          <li>Grant Personal Smart Wallet permission to manage Personal Attestations.</li>
          <li>Grant Organization Smart Wallet permission to manage Organization Attestations.</li>
        </ul>`, onClick: handlePermissions },
  ][currentStep - 1];
  return (
    <Box sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Header */}
          <Box textAlign="center">
            <Typography variant="h4">Build Your Smart Wallet</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Please complete the steps below</Typography>
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

          {/* Action Area */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body1">{`Step ${currentStep}: ${steps[currentStep - 1]?.title}`}</Typography>
            <Button
              variant="contained"
              onClick={stepAction?.onClick}
              disabled={isSubmitting}
              sx={{ mt: 2 }}
            >
              {isSubmitting ? 'Processing...' : stepAction?.label}
            </Button>
          </Box>
          <Box>
            {/* description */}
            {parse(stepAction.description)}
          </Box>

          {/* Back & (implicit) Next */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 2 }}>
            {currentStep > 1 && (
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => {
                  // go back one step
                  setSteps(prev =>
                    prev.map(s =>
                      s.id === currentStep ? { ...s, isActive: false, isCompleted: false } :
                      s.id === currentStep - 1 ? { ...s, isActive: true, isCompleted: false } :
                      s
                    )
                  );
                  setCurrentStep(c => c - 1);
                }}
              >
                Back
              </Button>
            )}
          </Box>
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

export default SetupSmartWalletModal;
