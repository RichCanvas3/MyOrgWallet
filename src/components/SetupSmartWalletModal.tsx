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
  const { selectedSignatory, selectedSignatoryName, buildSmartWallet, setupSmartWallet, chain } = useWallectConnectContext();


  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: 'Build Smart Wallets', description: '', isActive: true, isCompleted: false },
    { id: 2, title: 'Setup Wallet Permissions', description: '',isActive: false, isCompleted: false },
  ]);
  const [currentStep, setCurrentStep] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' as 'info' | 'success' | 'error' });

  // Note: signatory and owner are now obtained from context during each step

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
  // Note: Wallet connection is now handled in the welcome page via Web3Auth or MetaMask


  const handleBuildWallet = async () => {
    console.info("handle build wallet")
    setIsSubmitting(true);
    try {
      // Get the signatory from the context (set during welcome page)
      if (!selectedSignatory) {
        throw new Error('No wallet connected. Please complete the welcome setup first.');
      }

      // Check if we already have the owner and signatory from the welcome page
      let owner, signatory;
      
      // Check if we're using MetaMask (injected provider) or Web3Auth
      const provider = (window as any).ethereum;
      const isUsingMetaMask = selectedSignatory && provider && selectedSignatoryName === 'injectedProviderSignatoryFactory';
      
      if (isUsingMetaMask) {
        try {
          // Try to get current accounts without requesting permissions
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            // We have MetaMask accounts, use them without requesting permissions again
            owner = accounts[0];
            // Create wallet client without triggering new permission request
            const { createWalletClient, custom } = await import('viem');
            const walletClient = createWalletClient({
              chain: chain as any,
              transport: custom(provider),
              account: owner,
            });
            signatory = { walletClient };
          } else {
            // No accounts found, but we have MetaMask - this means user needs to connect
            // Since user already connected in welcome page, this shouldn't happen
            // If it does, it means MetaMask was disconnected, so we need to reconnect
            throw new Error('MetaMask accounts not found. Please reconnect MetaMask in the welcome page.');
          }
        } catch (error: unknown) {
          // If we can't get accounts or there's an error, don't try to login again
          // This prevents the permission conflict
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`MetaMask connection error: ${errorMessage}. Please ensure MetaMask is connected and try again.`);
        }
      } else {
        // For Web3Auth or other providers, we can safely call login
        console.info("web3Auth login")
        const loginResp = await selectedSignatory.login();
        owner = loginResp.owner;
        signatory = loginResp.signatory;
        console.info("web3Auth login done: ", owner, signatory)
      }

      console.info("build smart wallet")
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
      // Get the signatory from the context (set during welcome page)
      if (!selectedSignatory) {
        throw new Error('No wallet connected. Please complete the welcome setup first.');
      }

      // Check if we already have the owner and signatory from the welcome page
      let owner, signatory;
      
      // Check if we're using MetaMask (injected provider) or Web3Auth
      const provider = (window as any).ethereum;
      const isUsingMetaMask = selectedSignatory && provider && selectedSignatoryName === 'injectedProviderSignatoryFactory';
      
      if (isUsingMetaMask) {
        try {
          // Try to get current accounts without requesting permissions
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            // We have MetaMask accounts, use them without requesting permissions again
            owner = accounts[0];
            // Create wallet client without triggering new permission request
            const { createWalletClient, custom } = await import('viem');
            const walletClient = createWalletClient({
              chain: chain as any,
              transport: custom(provider),
              account: owner,
            });
            signatory = { walletClient };
          } else {
            // No accounts found, but we have MetaMask - this means user needs to connect
            // Since user already connected in welcome page, this shouldn't happen
            // If it does, it means MetaMask was disconnected, so we need to reconnect
            throw new Error('MetaMask accounts not found. Please reconnect MetaMask in the welcome page.');
          }
        } catch (error: unknown) {
          // If we can't get accounts or there's an error, don't try to login again
          // This prevents the permission conflict
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`MetaMask connection error: ${errorMessage}. Please ensure MetaMask is connected and try again.`);
        }
      } else {
        // For Web3Auth or other providers, we can safely call login
        const loginResp = await selectedSignatory.login();
        owner = loginResp.owner;
        signatory = loginResp.signatory;
      }

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
    { label: 'Build Smart Wallets', description: `
      <b>Your wallet is already connected from the welcome page!</b> <br/><br/>

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
