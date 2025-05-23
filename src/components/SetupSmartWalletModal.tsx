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

import '../custom_styles.css'

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
    { id: 2, title: 'Build Smart Wallets', description: '',isActive: false, isCompleted: false },
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
    { label: 'Connect EOA Wallet - Use OP Mainnet', description: `
      <b>No wallet funds are required to get started with MyOrgWallet</b> <br/><br/>

      Make sure your browser is connected to your MetaMask account and that OP Mainnnet is configured properly - this is required. <br/><br/>

      Watch <a className="colored_link" href="https://youtu.be/nVbJUDLtYCM" target="_blank">How to Configure OP Mainnet</a> if you are stuck or are getting the error: <code className="error">"Unrecognized chain ID 0xa." </code> <br><br>

      This local wallet account will be the owner of your newly created personal smart wallet and organization smart wallet.`
      , onClick: handleWalletConnect },
    { label: 'Build Smart Wallets', description: `

      <ul style="list-style-type: disc; margin-left: 1.5em; padding-left: 0;">
        <li>Build your personal smart wallet and deploy it to the blockchain.</li>
        <li>Build your organization's smart wallet and deploy it to the blockchain.</li>
        <li>Setup permissions between your personal smart wallet and your organization's smart wallet.</li>
      </ul>

      <br>

      Watch <a className="colored_link" href="https://youtu.be/B5mAdz4A5Y8" target="_blank">How to Create Smart Wallets on MyOrgWallet</a> to see these steps in action.`
      , onClick: handleBuildWallet },
    { label: 'Grant Attestation Permissions', description: `

      <ul style="list-style-type: disc; margin-left: 1.5em; padding-left: 0;">
        <li>Grant personal smart wallet permission to manage personal attestations.</li>
        <li>Grant organization smart wallet permission to manage organization attestations.</li>
      </ul>

      <br>

      Watch <a className="colored_link" href="https://youtu.be/B5mAdz4A5Y8" target="_blank">How to Create Smart Wallets on MyOrgWallet</a> to see these steps in action.
        `, onClick: handlePermissions },
  ][currentStep - 1];
  return (
    <Box className="custom" sx={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}> {/* position: 'relative', maxWidth: 600, width: '100%', p: 3, boxShadow: 3, borderRadius: 2 }} */}
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
              className="solid"
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
                className="outlined"
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
