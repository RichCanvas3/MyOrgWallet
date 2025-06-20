import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';

import {
  XMarkIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Paper,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { IndivAccountAttestation, AccountOrgDelAttestation, AccountIndivDelAttestation } from '../models/Attestation';
import { Account, IndivAccount } from '../models/Account';

import {
  DelegationFramework,
  SINGLE_DEFAULT_MODE,
  getDelegationHashOffchain,
} from "@metamask/delegation-toolkit";

import {
  createBundlerClient,
  createPaymasterClient,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";
import { http } from "viem";

import { BUNDLER_URL, PAYMASTER_URL } from "../config";

interface FundCreditCardModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const steps = ['Select Credit Card', 'Select Funding Sources', 'Enter Amount', 'Confirm Transfer'];

const FundCreditCardModal: React.FC<FundCreditCardModalProps> = ({ isVisible, onClose }) => {
  const [creditCardAccounts, setCreditCardAccounts] = useState<IndivAccountAttestation[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<IndivAccount[]>([]);
  const [selectedCreditCard, setSelectedCreditCard] = useState<IndivAccountAttestation | null>(null);
  const [selectedSavingsAccounts, setSelectedSavingsAccounts] = useState<string[]>([]);
  const [fundingAmount, setFundingAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { chain, indivDid, orgDid, indivAccountClient, orgAccountClient, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation } = useWallectConnectContext();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isVisible && chain && indivDid) {
      loadCreditCardAccounts();
      loadSavingsAccounts();
    }
  }, [isVisible, chain, indivDid]);

  const loadCreditCardAccounts = async () => {
    try {
      if (!chain || !indivDid) return;
      const allAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, indivDid, "");
      const creditCards = allAttestations.filter(att => att.entityId === "account(indiv)") as IndivAccountAttestation[];
      setCreditCardAccounts(creditCards);
    } catch (error) {
      console.error('Error loading credit card accounts:', error);
      setError('Failed to load credit card accounts');
    }
  };

  const loadSavingsAccounts = async () => {
    try {
      if (orgDid && indivDid && chain) {
        const accounts = await AttestationService.loadIndivAccounts(chain, orgDid, indivDid, "1150");
        setSavingsAccounts(accounts);
      }
    } catch (error) {
      console.error('Error loading savings accounts:', error);
      setError('Failed to load savings accounts');
    }
  };

  const handleCreditCardSelect = (creditCard: IndivAccountAttestation) => {
    setSelectedCreditCard(creditCard);
    setActiveStep(1);
  };

  const handleSavingsAccountSelect = (accountId: string) => {
    setSelectedSavingsAccounts(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleClose = () => {
    setSelectedCreditCard(null);
    setSelectedSavingsAccounts([]);
    setFundingAmount('');
    setError(null);
    setActiveStep(0);
    onClose();
  };

  const handleConfirmTransfer = async () => {
    if (!selectedCreditCard || selectedSavingsAccounts.length === 0 || !fundingAmount) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amount = parseFloat(fundingAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      // Process each selected savings account
      for (const accountId of selectedSavingsAccounts) {
        const savingsAccount = savingsAccounts.find(acc => acc.id === accountId);
        if (!savingsAccount) continue;

        // Get the individual account delegation for this savings account
        if (!indivDid || !orgDid || !chain) {
          console.warn('Individual DID not available');
          continue;
        }
        const indivAccounts = await AttestationService.loadIndivAccounts(chain!, orgDid, indivDid, "1150");
        const indivAccount = indivAccounts.find(acc => 
          acc.attestation?.accountName === savingsAccount.name
        );

        if (!indivAccount || !indivAccount.attestation) {
          console.warn(`No individual delegation found for account: ${savingsAccount.name}`);
          continue;
        }

        // Parse delegations
        const orgDel = JSON.parse(indivAccount.attestation.orgDelegation);
        const indivDel = JSON.parse(indivAccount.attestation.indivDelegation);

        // Create bundler client
        const pimlicoClient = createPimlicoClient({
          transport: http(BUNDLER_URL),
        });

        const bundlerClient = createBundlerClient({
          transport: http(BUNDLER_URL),
          paymaster: true,
          chain: chain!,
          paymasterContext: {
            mode: 'SPONSORED',
          },
        });

        // Create execution to transfer funds to credit card
        const creditCardAddress = selectedCreditCard.accountDid.replace('did:pkh:eip155:' + chain?.id + ':', '') as `0x${string}`;
        console.info("@@@@@@@@@@@@@ creditCardAddress: ", creditCardAddress) 
        
        const executions = [
          {
            target: creditCardAddress,
            value: BigInt(Math.floor(amount * 1e18)), // Convert to wei
            callData: '0x' as `0x${string}`, // Empty call data for simple ETH transfer
          },
        ];

        const delegationChain = [indivDel, orgDel];
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [delegationChain],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [executions]
        });

        const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
        
        if (indivAccountClient) {
          const userOpHash = await bundlerClient.sendUserOperation({
            account: indivAccountClient,
            calls: [
              {
                to: indivAccountClient.address,
                data,
              },
            ],
            ...fee
          });

          const { receipt } = await bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });

          console.info(`Transfer completed for account: ${savingsAccount.name}`, receipt);
        }
      }

      handleClose();
    } catch (error) {
      console.error('Error during transfer:', error);
      setError('Transfer failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <Typography variant="h6" gutterBottom>
              Select Credit Card to Fund
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search credit cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Paper variant="outlined" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <List sx={{ 
                flex: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: '8px' },
                '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '4px' },
                '&::-webkit-scrollbar-thumb': { background: '#888', borderRadius: '4px' },
              }}>
                {creditCardAccounts
                  .filter(account =>
                    account.accountName.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((account) => (
                    <ListItem key={account.uid} disablePadding>
                      <ListItemButton onClick={() => handleCreditCardSelect(account)}>
                        <ListItemIcon>
                          <CreditCardIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={account.accountName}
                          secondary={`Credit Card Account`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </Paper>
            {creditCardAccounts.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                No credit card accounts found. Please add a credit card account first.
              </Typography>
            )}
          </>
        );

      case 1:
        return (
          <>
            <Typography variant="h6" gutterBottom>
              Select Funding Sources for {selectedCreditCard?.accountName}
            </Typography>
            <FormGroup>
              {savingsAccounts.map(account => (
                <FormControlLabel
                  key={account.id}
                  control={
                    <Checkbox
                      checked={selectedSavingsAccounts.includes(account.id)}
                      onChange={() => handleSavingsAccountSelect(account.id)}
                    />
                  }
                  label={`${account.name} (${account.code})`}
                  sx={{
                    color: 'text.primary',
                    '& .MuiFormControlLabel-label': {
                      color: 'text.primary',
                    }
                  }}
                />
              ))}
            </FormGroup>
            {savingsAccounts.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                No savings accounts found. Please add savings accounts first.
              </Typography>
            )}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                disabled={selectedSavingsAccounts.length === 0}
              >
                Next
              </Button>
            </Box>
          </>
        );

      case 2:
        return (
          <>
            <Typography variant="h6" gutterBottom>
              Enter Funding Amount
            </Typography>
            <TextField
              fullWidth
              label="Amount (ETH)"
              variant="outlined"
              value={fundingAmount}
              onChange={(e) => setFundingAmount(e.target.value)}
              placeholder="Enter the amount to transfer"
              type="number"
              inputProps={{ min: 0, step: 0.001 }}
              error={!!error}
              helperText={error}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                disabled={!fundingAmount || parseFloat(fundingAmount) <= 0}
              >
                Next
              </Button>
            </Box>
          </>
        );

      case 3:
        return (
          <>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Confirm Transfer
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: 'text.primary' }}>
              You are about to transfer {fundingAmount} ETH to {selectedCreditCard?.accountName} from the following accounts:
            </Typography>
            <Box sx={{ ml: 2, mb: 2 }}>
              {selectedSavingsAccounts.map(accountId => {
                const account = savingsAccounts.find(acc => acc.id === accountId);
                return (
                  <Typography 
                    key={accountId} 
                    variant="body2"
                    sx={{ color: 'text.primary' }}
                  >
                    • {account?.name} ({account?.code})
                  </Typography>
                );
              })}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleConfirmTransfer}
                disabled={isLoading}
                color="primary"
              >
                {isLoading ? <CircularProgress size={24} /> : 'Confirm Transfer'}
              </Button>
            </Box>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Transition show={isVisible} as={React.Fragment}>
      <div className="modal-overlay fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50 px-4">
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div
            className="flex flex-col bg-white rounded-lg w-full max-w-md mx-auto overflow-hidden"
            style={{ maxHeight: "80vh", minWidth: "43em" }}
          >
            <div className="flex justify-between items-center border-b border-gray-200 p-4">
              <div className="flex items-center gap-2">
                {activeStep > 0 && (
                  <button onClick={handleBack} className="text-gray-700 hover:text-gray-900">
                    <ArrowLeftIcon className="h-5 w-5" />
                  </button>
                )}
                <h1 className="modal-title text-lg font-semibold">Fund Credit Card</h1>
              </div>
              <button onClick={handleClose} className="text-gray-700 hover:text-gray-900">
                <XMarkIcon className="h-8 w-8" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col p-4" style={{ height: "calc(80vh - 70px)" }}>
              {!isConnected ? (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={4}>
                  <Typography variant="h6">Connect your MetaMask wallet</Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" height="100%">
                  <Stepper activeStep={activeStep} sx={{ width: '100%', mb: 4 }}>
                    {steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                  {renderStepContent()}
                </Box>
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default FundCreditCardModal; 