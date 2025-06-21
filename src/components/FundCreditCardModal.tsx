import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import { getTokens, EVM, getTokenBalances, createConfig, getRoutes, executeRoute } from '@lifi/sdk';

import type { Token, Route } from '@lifi/types';
import { ChainId } from '@lifi/types';

import { getWalletClient, switchChain } from '@wagmi/core'
import { createClient, http } from 'viem'

import { linea, mainnet, optimism, sepolia } from "viem/chains";

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
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { IndivAccountAttestation, AccountOrgDelAttestation, AccountIndivDelAttestation } from '../models/Attestation';
import { Account, IndivAccount } from '../models/Account';

import {  createConfig as createWagmiConfig } from 'wagmi'

import { ETHERUM_RPC_URL, OPTIMISM_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL } from "../config";

// Utility function to extract chainId and address from accountDid
const extractFromAccountDid = (accountDid: string): { chainId: number; address: `0x${string}` } | null => {
  try {
    // Parse did:pkh:eip155:chainId:address format
    const parts = accountDid.split(':');
    if (parts.length === 5 && parts[0] === 'did' && parts[1] === 'pkh' && parts[2] === 'eip155') {
      const chainId = parseInt(parts[3], 10);
      const address = parts[4] as `0x${string}`;
      return { chainId, address };
    }
    return null;
  } catch (error) {
    console.error('Error parsing accountDid:', error);
    return null;
  }
};

// Initialize LiFi SDK
createConfig({
  integrator: 'MyOrgWallet',
  rpcUrls: {
    [ChainId.ETH]: [ETHERUM_RPC_URL],
    [ChainId.OPT]: [OPTIMISM_RPC_URL],
    [ChainId.LNA]: [LINEA_RPC_URL],
  },
});

// Create Wagmi config
const wagmiConfig = createWagmiConfig({
    chains: [mainnet, optimism, linea, sepolia],
    client({ chain }) {
      return createClient({ chain, transport: http() })
    },
  })
  
createConfig({
    integrator: 'MyOrgWallet',
    rpcUrls: {
      [ChainId.ETH]: [ETHERUM_RPC_URL],
      [ChainId.OPT]: [OPTIMISM_RPC_URL],
      [ChainId.LNA]: [LINEA_RPC_URL],
    },
    providers: [
      EVM({
        getWalletClient: () => getWalletClient(wagmiConfig),
        switchChain: async (chainId) => {
            console.info("*********** SWITCH CHAIN ****************")
          const chain = await switchChain(wagmiConfig, { chainId })
          return getWalletClient(wagmiConfig, { chainId: chain.id })
        },
      }),
    ],
    preloadChains: false,
  })

interface FundCreditCardModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const steps = ['Select Credit Card', 'Select Funding Sources', 'Enter Amount & Token', 'Confirm Transfer'];

// Token options for transfer
const TOKEN_OPTIONS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' },
];

const FundCreditCardModal: React.FC<FundCreditCardModalProps> = ({ isVisible, onClose }) => {
  const [creditCardAccounts, setCreditCardAccounts] = useState<IndivAccountAttestation[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<IndivAccount[]>([]);
  const [selectedCreditCard, setSelectedCreditCard] = useState<IndivAccountAttestation | null>(null);
  const [selectedSavingsAccounts, setSelectedSavingsAccounts] = useState<string[]>([]);
  const [fundingAmount, setFundingAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  
  // Balance states
  const [creditCardBalances, setCreditCardBalances] = useState<{ [key: string]: string }>({});
  const [savingsAccountBalances, setSavingsAccountBalances] = useState<{ [key: string]: { eth: string; usdc: string } }>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // LiFi route states
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  const { chain, indivDid, orgDid, indivAccountClient, orgAccountClient, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation } = useWallectConnectContext();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isVisible && chain && indivDid) {
      loadCreditCardAccounts();
      loadSavingsAccounts();
    }
  }, [isVisible, chain, indivDid]);

  // Fetch balances for credit card
  const fetchCreditCardBalances = async (accountDid: string) => {
    if (!accountDid || !chain) return;
    
    setIsLoadingBalances(true);
    try {
      const extracted = extractFromAccountDid(accountDid);
      if (!extracted) {
        console.error('Invalid accountDid format:', accountDid);
        return;
      }
      
      const { address: accountAddress, chainId: accountChainId } = extracted;

      console.info("*********** ACCOUNT CHAIN ID ****************", accountChainId);
      console.info("*********** ACCOUNT ADDRESS ****************", accountAddress);
      
      const tokensResponse = await getTokens({ chains: [accountChainId] });
      const tokens = tokensResponse.tokens[accountChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      const usdcToken = "0x176211869cA2b568f2A7D4EE941E073a821EE1ff";
      
      const filteredTokens = tokens.filter(item => 
        item.address === nativeToken || item.address === usdcToken
      );
      
      if (filteredTokens.length > 0) {
        const tokenBalances = await getTokenBalances(accountAddress, filteredTokens);
        
        const balances: { [key: string]: string } = {};
        
        // ETH balance
        const ethBalance = tokenBalances.find(balance => balance.address === nativeToken);
        if (ethBalance && ethBalance.amount) {
          const weiBigInt = typeof ethBalance.amount === 'string' ? BigInt(ethBalance.amount) : ethBalance.amount;
          const eth = Number(weiBigInt) / 1e18;
          balances.ETH = eth.toFixed(6);
        } else {
          balances.ETH = '0';
        }
        
        // USDC balance
        const usdcBalance = tokenBalances.find(balance => balance.address === usdcToken);
        if (usdcBalance && usdcBalance.amount) {
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          balances.USDC = dollars.toFixed(2);
        } else {
          balances.USDC = '0';
        }
        
        setCreditCardBalances(balances);
      }
    } catch (error) {
      console.error('Error fetching credit card balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Fetch balances for savings accounts
  const fetchSavingsAccountBalances = async (accountDid: string) => {
    if (!accountDid || !chain) return;
    
    try {
      const extracted = extractFromAccountDid(accountDid);
      if (!extracted) {
        console.error('Invalid accountDid format:', accountDid);
        return;
      }
      
      const { address: accountAddress, chainId: accountChainId } = extracted;

      console.info("*********** ACCOUNT CHAIN ID ****************", accountChainId);
      console.info("*********** ACCOUNT ADDRESS ****************", accountAddress);
      
      const tokensResponse = await getTokens({ chains: [accountChainId] });
      const tokens = tokensResponse.tokens[accountChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      const usdcToken = "0x176211869cA2b568f2A7D4EE941E073a821EE1ff";
      
      const filteredTokens = tokens.filter(item => 
        item.address === nativeToken || item.address === usdcToken
      );
      
      if (filteredTokens.length > 0) {
        const tokenBalances = await getTokenBalances(accountAddress, filteredTokens);
        
        const balances: { eth: string; usdc: string } = { eth: '0', usdc: '0' };
        
        // ETH balance
        const ethBalance = tokenBalances.find(balance => balance.address === nativeToken);
        if (ethBalance && ethBalance.amount) {
          const weiBigInt = typeof ethBalance.amount === 'string' ? BigInt(ethBalance.amount) : ethBalance.amount;
          const eth = Number(weiBigInt) / 1e18;
          balances.eth = eth.toFixed(6);
        }
        
        // USDC balance
        const usdcBalance = tokenBalances.find(balance => balance.address === usdcToken);
        if (usdcBalance && usdcBalance.amount) {
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          balances.usdc = dollars.toFixed(2);
        }
        
        setSavingsAccountBalances(prev => ({
          ...prev,
          [accountDid]: balances
        }));
      }
    } catch (error) {
      console.error('Error fetching savings account balances:', error);
    }
  };

  // Get LiFi routes for transfer
  const getTransferRoutes = async () => {
    if (!selectedCreditCard || selectedSavingsAccounts.length === 0 || !fundingAmount || !chain) return;
    
    setIsLoadingRoutes(true);
    try {
      const creditCardExtracted = extractFromAccountDid(selectedCreditCard.accountDid);
      if (!creditCardExtracted) {
        console.error('Invalid credit card accountDid format:', selectedCreditCard.accountDid);
        return;
      }
      
      const creditCardAddress = creditCardExtracted.address;
      
      // For now, we'll get routes from the first selected savings account
      const firstSavingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);
      if (!firstSavingsAccount) return;
      
      const savingsAccountExtracted = extractFromAccountDid(firstSavingsAccount.did);
      if (!savingsAccountExtracted) {
        console.error('Invalid savings account did format:', firstSavingsAccount.did);
        return;
      }
      
      const savingsAccountAddress = savingsAccountExtracted.address;
      
      const tokenAddress = selectedToken === 'ETH' 
        ? '0x0000000000000000000000000000000000000000' 
        : '0x176211869cA2b568f2A7D4EE941E073a821EE1ff';
      
      const amount = selectedToken === 'ETH' 
        ? (parseFloat(fundingAmount) * 1e18).toString()
        : (parseFloat(fundingAmount) * 1e6).toString();
      
      const routes = await getRoutes({
        fromChainId: chain.id,
        toChainId: chain.id,
        fromTokenAddress: tokenAddress,
        toTokenAddress: tokenAddress,
        fromAmount: amount,
        fromAddress: savingsAccountAddress,
        toAddress: creditCardAddress,
      });
      
      setAvailableRoutes(routes.routes);
      if (routes.routes.length > 0) {
        setSelectedRoute(routes.routes[0]);
      }
    } catch (error) {
      console.error('Error getting routes:', error);
      setError('Failed to get transfer routes');
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const loadCreditCardAccounts = async () => {
    try {
      if (!chain || !indivDid) return;
      const allAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, indivDid, "");
      const creditCards = allAttestations.filter(att => att.entityId === "account(indiv)") as IndivAccountAttestation[];
      setCreditCardAccounts(creditCards);
      
      // Fetch balances for all credit card accounts
      for (const creditCard of creditCards) {
        await fetchCreditCardBalances(creditCard.accountDid);
      }
    } catch (error) {
      console.error('Error loading credit card accounts:', error);
      setError('Failed to load credit card accounts');
    }
  };

  const loadSavingsAccounts = async () => {
    try {
      if (orgDid && indivDid && chain) {
        const accounts = await AttestationService.loadIndivAccounts(chain, orgDid, indivDid, "1110");
        setSavingsAccounts(accounts);
      }
    } catch (error) {
      console.error('Error loading savings accounts:', error);
      setError('Failed to load savings accounts');
    }
  };

  const handleCreditCardSelect = async (creditCard: IndivAccountAttestation) => {
    setSelectedCreditCard(creditCard);
    await fetchCreditCardBalances(creditCard.accountDid);
    setActiveStep(1);
  };

  const handleSavingsAccountSelect = async (accountId: string) => {
    setSelectedSavingsAccounts(prev => {
      const newSelection = prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId];
      
      // Fetch balances for newly selected accounts
      if (!prev.includes(accountId)) {
        const account = savingsAccounts.find(acc => acc.id === accountId);
        if (account) {
          fetchSavingsAccountBalances(account.did);
        }
      }
      
      return newSelection;
    });
  };

  const handleNext = async () => {
    if (activeStep === 2) {
      // Get routes when moving to confirmation step
      await getTransferRoutes();
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleClose = () => {
    setSelectedCreditCard(null);
    setSelectedSavingsAccounts([]);
    setFundingAmount('');
    setSelectedToken('ETH');
    setError(null);
    setActiveStep(0);
    setCreditCardBalances({});
    setSavingsAccountBalances({});
    setAvailableRoutes([]);
    setSelectedRoute(null);
    onClose();
  };

  const handleConfirmTransfer = async () => {
    if (!selectedCreditCard || selectedSavingsAccounts.length === 0 || !fundingAmount || !selectedRoute) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Execute the LiFi route
      const result = await executeRoute(selectedRoute);
      
      console.info('Transfer executed:', result);
      
      // Refresh balances after transfer
      await fetchCreditCardBalances(selectedCreditCard.accountDid);
      for (const accountId of selectedSavingsAccounts) {
        const account = savingsAccounts.find(acc => acc.id === accountId);
        if (account) {
          await fetchSavingsAccountBalances(account.did);
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
                          secondary={
                            <Box>
                              <Typography variant="body2">Credit Card Account</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {account.accountDid}
                              </Typography>
                              {isLoadingBalances ? (
                                <CircularProgress size={12} />
                              ) : (
                                <Box display="flex" gap={1} mt={0.5}>
                                  <Chip 
                                    label={`${creditCardBalances.ETH || '0'} ETH`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip 
                                    label={`${creditCardBalances.USDC || '0'} USDC`}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Box>
                              )}
                            </Box>
                          }
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
              {savingsAccounts.map(account => {
                const balances = savingsAccountBalances[account.did];
                return (
                  <FormControlLabel
                    key={account.id}
                    control={
                      <Checkbox
                        checked={selectedSavingsAccounts.includes(account.id)}
                        onChange={() => handleSavingsAccountSelect(account.id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">{account.name} ({account.code})</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {account.did}
                        </Typography>
                        {balances && (
                          <Box display="flex" gap={1} mt={0.5}>
                            <Chip 
                              label={`${balances.eth} ETH`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip 
                              label={`${balances.usdc} USDC`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        )}
                      </Box>
                    }
                    sx={{
                      color: 'text.primary',
                      '& .MuiFormControlLabel-label': {
                        color: 'text.primary',
                      }
                    }}
                  />
                );
              })}
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
              Enter Amount & Select Token
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Token</InputLabel>
              <Select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                label="Token"
              >
                {TOKEN_OPTIONS.map((token) => (
                  <MenuItem key={token.symbol} value={token.symbol}>
                    {token.name} ({token.symbol})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label={`Amount (${selectedToken})`}
              variant="outlined"
              value={fundingAmount}
              onChange={(e) => setFundingAmount(e.target.value)}
              placeholder={`Enter the amount to transfer in ${selectedToken}`}
              type="number"
              inputProps={{ min: 0, step: selectedToken === 'ETH' ? 0.001 : 0.01 }}
              error={!!error}
              helperText={error}
              sx={{ mb: 2 }}
            />
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                This will use LiFi to transfer {selectedToken} from your selected savings accounts to the credit card account.
              </Typography>
            </Alert>
            
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
            
            {isLoadingRoutes ? (
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CircularProgress size={20} />
                <Typography variant="body2">Finding best transfer route...</Typography>
              </Box>
            ) : selectedRoute ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Best route found via {selectedRoute.steps[0]?.tool || 'LiFi'}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  No transfer routes available. Please check your balances and try a different amount.
                </Typography>
              </Alert>
            )}
            
            <Typography variant="body1" paragraph sx={{ color: 'text.primary' }}>
              You are about to transfer {fundingAmount} {selectedToken} to {selectedCreditCard?.accountName} from the following accounts:
            </Typography>
            
            <Box sx={{ ml: 2, mb: 2 }}>
              {selectedSavingsAccounts.map(accountId => {
                const account = savingsAccounts.find(acc => acc.id === accountId);
                const balances = account ? savingsAccountBalances[account.did] : null;
                return (
                  <Box key={accountId} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>
                      • {account?.name} ({account?.code})
                    </Typography>
                    {balances && (
                      <Box display="flex" gap={1} ml={2} mt={0.5}>
                        <Chip 
                          label={`${balances.eth} ETH`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip 
                          label={`${balances.usdc} USDC`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
            
            {selectedRoute && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Transfer Details:</strong><br />
                  Route: {selectedRoute.steps[0]?.tool || 'LiFi'}<br />
                  Estimated Gas: {selectedRoute.gasCostUSD ? `$${parseFloat(selectedRoute.gasCostUSD).toFixed(2)}` : 'N/A'}<br />
                  From Amount: {selectedRoute.fromAmount} {selectedRoute.fromToken.symbol}<br />
                  To Amount: {selectedRoute.toAmount} {selectedRoute.toToken.symbol}
                </Typography>
              </Alert>
            )}
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleConfirmTransfer}
                disabled={isLoading || !selectedRoute}
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