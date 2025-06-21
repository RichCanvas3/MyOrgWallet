import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import { getTokens, EVM, getTokenBalances, createConfig, getRoutes, getStepTransaction, executeRoute } from '@lifi/sdk';


import { encodeFunctionData, parseUnits } from 'viem';





import type { Token, Route, LiFiStep } from '@lifi/types';
import { ChainId } from '@lifi/types';

import { getWalletClient, switchChain } from '@wagmi/core'
import { createClient, http, parseAbi } from 'viem'

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

import { ETHERUM_RPC_URL, OPTIMISM_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL, BUNDLER_URL, PAYMASTER_URL } from "../config";

import { createPaymasterClient, createBundlerClient } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { DelegationFramework, SINGLE_DEFAULT_MODE } from '@metamask/delegation-toolkit';
import { CallSharp } from '@mui/icons-material';

const ERC20_ABI = parseAbi([
  // Read-only
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',

  // Write
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',

  // Events (optional, useful for indexing/logs)
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);
const USDC_OPTIMISM = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as const;

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
        switchChain: async (chainId: ChainId) => {
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

// Token options will be determined dynamically from LiFi

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
  const [creditCardBalances, setCreditCardBalances] = useState<{ [accountDid: string]: { ETH: string; USDC: string } }>({});
  const [savingsAccountBalances, setSavingsAccountBalances] = useState<{ [key: string]: { eth: string; usdc: string } }>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // LiFi route states
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  
  // Available tokens state
  const [availableTokens, setAvailableTokens] = useState<{ symbol: string; name: string; address: string }[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  const { chain, indivDid, orgDid, indivAccountClient, orgAccountClient, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation } = useWallectConnectContext();
  const { isConnected } = useAccount();

  // Get token address for a specific chain
  const getTokenAddressForChain = async (chainId: number, symbol: string): Promise<string> => {
    try {
      const tokensResponse = await getTokens({ chains: [chainId as ChainId] });
      const tokens = tokensResponse.tokens[chainId as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      const token = tokens.find(token => 
        token.symbol === symbol && token.address !== nativeToken
      );
      
      return token?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
    } catch (error) {
      console.error(`Error getting ${symbol} address for chain ${chainId}:`, error);
      return "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
    }
  };

  // Load available tokens for the current chain
  const loadAvailableTokens = async () => {
    if (!chain) return;
    
    setIsLoadingTokens(true);
    try {
      const tokensResponse = await getTokens({ chains: [chain.id as ChainId] });
      const tokens = tokensResponse.tokens[chain.id as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff";
      
      const availableTokensList = [
        { symbol: 'ETH', name: 'Ethereum', address: nativeToken },
        { symbol: 'USDC', name: 'USD Coin', address: usdcToken }
      ];
      
      setAvailableTokens(availableTokensList);
      if (selectedToken === '') {
        setSelectedToken('ETH');
      }
    } catch (error) {
      console.error('Error loading available tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    if (isVisible && chain && indivDid) {
      loadCreditCardAccounts();
      loadSavingsAccounts();
      loadAvailableTokens(); // Load tokens when modal opens
    }
  }, [isVisible, chain, indivDid]);

  // Ensure tokens are loaded when reaching step 2
  useEffect(() => {
    if (activeStep === 2 && availableTokens.length === 0 && chain) {
      loadAvailableTokens();
    }
  }, [activeStep, availableTokens.length, chain]);

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

      console.info("*********** ACCOUNT CHAIN ID 1 ****************", accountChainId);
      console.info("*********** ACCOUNT ADDRESS 1 ****************", accountAddress);
      
      const tokensResponse = await getTokens({ chains: [accountChainId as ChainId] });
      const tokens = tokensResponse.tokens[accountChainId as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      // Find USDC token dynamically from the response
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
      
      console.info("*********** USDC TOKEN ADDRESS 1 ****************", usdcToken);
      
      const filteredTokens = tokens.filter(item => 
        item.address === nativeToken || item.address === usdcToken
      );
      
      if (filteredTokens.length > 0) {
        const tokenBalances = await getTokenBalances(accountAddress, filteredTokens);
        
        // Update available tokens for the first account (they should be the same across accounts on same chain)
        if (Object.keys(creditCardBalances).length === 0) {
          const tokens = [
            { symbol: 'ETH', name: 'Ethereum', address: nativeToken },
            { symbol: 'USDC', name: 'USD Coin', address: usdcToken }
          ];
          setAvailableTokens(tokens);
          setSelectedToken('ETH'); // Set default token
        }
        
        const balances: { ETH: string; USDC: string } = { ETH: '0', USDC: '0' };
        
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
        
        setCreditCardBalances(prev => ({
          ...prev,
          [accountDid]: balances
        }));
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

      console.info("*********** ACCOUNT CHAIN ID 2 ****************", accountChainId);
      console.info("*********** ACCOUNT ADDRESS 2 ****************", accountAddress);
      
      const tokensResponse = await getTokens({ chains: [accountChainId as ChainId] });
      const tokens = tokensResponse.tokens[accountChainId as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      // Find USDC token dynamically from the response
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
      
      console.info("*********** USDC TOKEN ADDRESS 2 ****************", usdcToken);
      
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
        console.info("*********** USDC BALANCE ****************", usdcBalance);
        if (usdcBalance && usdcBalance.amount) {
            console.info("*********** USDC BALANCE ****************", usdcBalance.amount);
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          balances.usdc = dollars.toFixed(2);
          console.info("*********** USDC BALANCE ****************", balances.usdc);
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
    if (!selectedCreditCard || selectedSavingsAccounts.length === 0 || !fundingAmount || !chain) {
      console.error('Missing required data for routes:', { 
        selectedCreditCard: !!selectedCreditCard, 
        selectedSavingsAccounts: selectedSavingsAccounts.length, 
        fundingAmount, 
        chain: !!chain 
      });
      return;
    }
    
    setIsLoadingRoutes(true);
    setError(null);
    try {
      const creditCardExtracted = extractFromAccountDid(selectedCreditCard.accountDid);
      if (!creditCardExtracted) {
        console.error('Invalid credit card accountDid format:', selectedCreditCard.accountDid);
        setError('Invalid credit card account format');
        return;
      }
      
      const creditCardAddress = creditCardExtracted.address;
      
      // For now, we'll get routes from the first selected savings account
      const firstSavingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);
      if (!firstSavingsAccount) {
        console.error('First savings account not found');
        setError('Selected savings account not found');
        return;
      }
      
      const savingsAccountExtracted = extractFromAccountDid(firstSavingsAccount.did);
      if (!savingsAccountExtracted) {
        console.error('Invalid savings account did format:', firstSavingsAccount.did);
        setError('Invalid savings account format');
        return;
      }

      // Get token addresses for both chains
      const fromTokenAddress = selectedToken === 'ETH' 
        ? '0x0000000000000000000000000000000000000000' 
        : await getTokenAddressForChain(savingsAccountExtracted.chainId, 'USDC');
      
      const toTokenAddress = selectedToken === 'ETH' 
        ? '0x0000000000000000000000000000000000000000' 
        : await getTokenAddressForChain(creditCardExtracted.chainId, 'USDC');
      
      const amount = selectedToken === 'ETH' 
        ? (parseFloat(fundingAmount) * 1e18).toString()
        : (parseFloat(fundingAmount) * 1e6).toString();
      
      console.log('Getting routes with params:', {
        fromChainId: savingsAccountExtracted.chainId,
        toChainId: creditCardExtracted.chainId,
        fromTokenAddress,
        toTokenAddress,
        fromAmount: amount,
        fromAddress: savingsAccountExtracted.address,
        toAddress: creditCardExtracted.address,
      });
      
      /*
      const routes = await getRoutes({
        fromChainId: savingsAccountExtracted.chainId,
        toChainId: creditCardExtracted.chainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: amount,
        fromAddress: savingsAccountExtracted.address,
        toAddress: creditCardExtracted.address,
      });

      
      console.log('Routes received:', routes);

      
      setAvailableRoutes(routes.routes);
      if (routes.routes.length > 0) {
        setSelectedRoute(routes.routes[0]);
        console.log('Selected route:', routes.routes[0]);
      } else {
        console.error('No routes available');
        setError('No transfer routes available for this amount and token combination');
      }
      */
      setSelectedRoute(null);
    } catch (error) {
      console.error('Error getting routes:', error);
      setError('Failed to get transfer routes: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
    //if (!selectedCreditCard || selectedSavingsAccounts.length === 0 || !fundingAmount || !selectedRoute) {
    //  setError('Missing required information');
    //  return;
    //}

    setIsLoading(true);
    setError(null);

    try {
      // Execute the LiFi route using delegation
      console.info("***********  EXECUTE SELECTED ROUTE ****************", selectedRoute);

      //await executeRoute(selectedRoute);


  
      const savingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);

      const accountIndivDelegationStr = savingsAccount?.attestation?.indivDelegation;
      const accountOrgDelegationStr = savingsAccount?.attestation?.orgDelegation;
      
      

      if (!orgAccountClient && !indivAccountClient && !accountOrgDelegationStr) {
        throw new Error('No delegations found');
      }

      const accountIndivDelegation = JSON.parse(accountIndivDelegationStr || '{}') 
      const accountOrgDelegation = JSON.parse(accountOrgDelegationStr || '{}') 

      // Setup bundler and paymaster clients
      const paymasterClient = createPaymasterClient({
        transport: http(PAYMASTER_URL || ''),
      });

      const pimlicoClient = createPimlicoClient({
        transport: http(BUNDLER_URL || ''),
      });

      const bundlerClient = createBundlerClient({
        transport: http(BUNDLER_URL || ''),
        paymaster: paymasterClient,
        chain: chain,
        paymasterContext: {
          mode: 'SPONSORED',
        },
      });

      const calls = []


      console.info("***********  selected credit card ****************", selectedCreditCard);
      const amount = selectedToken === 'ETH' 
        ? (parseFloat(fundingAmount) * 1e18).toString()
        : (parseFloat(fundingAmount) * 1e6).toString();
      const creditCardExtracted = extractFromAccountDid(selectedCreditCard.accountDid);


      if (selectedToken === 'ETH') {

        // ETH
        const includedExecutions = [
          {
            target: creditCardExtracted.address as `0x${string}`,
            value: amount,
            callData: "0x"
          },
        ];


        // Encode the delegation execution
        console.info("***********  redeemDelegations ****************");
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [[accountIndivDelegation, accountOrgDelegation]],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [includedExecutions]
        });

        console.info("***********  call ****************");

        const call = {
          to: indivAccountClient.address,
          data: data,
        }

        calls.push(call)
      }
      else {

        // USDC

        const decimals = 6
        const value = parseUnits(amount, decimals);
        const to = creditCardExtracted.address as `0x${string}`
        const callData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [to, value],
        });


        const includedExecutions = [
          {
            target: USDC_OPTIMISM,
            value: 0n,
            callData: callData
          },
        ];


        // Encode the delegation execution
        console.info("***********  redeemDelegations ****************");
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [[accountIndivDelegation, accountOrgDelegation]],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [includedExecutions]
        });

        console.info("***********  call ****************");

        const call = {
          to: indivAccountClient.address,
          data: data,
        }

        calls.push(call)

      }

      /*
      for (const step of selectedRoute.steps) {

        const tx = await getStepTransaction(step);
        const txRequest = tx.transactionRequest;

        if (!txRequest || !orgAccountClient) {
          throw new Error('No transaction data in route');
        }

        const includedExecutions = [
          {
            target: txRequest.to as `0x${string}`,
            value: BigInt(txRequest.value || '0'),
            callData: txRequest.data as `0x${string}`,
          },
        ];

        // Encode the delegation execution
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [[accountOrgDelegation]],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [includedExecutions]
        });

        const call = {
          to: orgAccountClient.address,
          data: data,
        }

        calls.push(call)

      }
      */


      //const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
      const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n}
      // Send user operation
      const userOpHash = await bundlerClient.sendUserOperation({
        account: indivAccountClient,
        calls: calls,
        paymaster: paymasterClient,
        ...fee
      });

      const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      console.info('Transfer executed:', userOperationReceipt);
      
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
                              <Typography variant="body2" component="div">Credit Card Account</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }} component="div">
                                {account.accountDid}
                              </Typography>
                              {isLoadingBalances ? (
                                <CircularProgress size={12} />
                              ) : (
                                <Box display="flex" gap={1} mt={0.5}>
                                  <Chip 
                                    label={`${creditCardBalances[account.accountDid]?.ETH || '0'} ETH`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip 
                                    label={`${creditCardBalances[account.accountDid]?.USDC || '0'} USDC`}
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
                const extracted = extractFromAccountDid(account.did);
                
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
                        <Typography variant="body1" component="div">{account.name} ({account.code})</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }} component="div">
                          {account.did}
                        </Typography>
                        {extracted && (
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }} component="div">
                              Chain ID: {extracted.chainId} | Address: {extracted.address}
                            </Typography>
                          </Box>
                        )}
                        {balances && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
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
                disabled={isLoadingTokens}
              >
                {isLoadingTokens ? (
                  <MenuItem disabled>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={16} />
                      Loading tokens...
                    </Box>
                  </MenuItem>
                ) : (
                  availableTokens.map((token) => (
                    <MenuItem key={token.symbol} value={token.symbol}>
                      {token.name} ({token.symbol})
                    </MenuItem>
                  ))
                )}
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
            
            {/* Show available amounts for selected savings accounts */}
            {selectedSavingsAccounts.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Available {selectedToken} in selected accounts:
                </Typography>
                {selectedSavingsAccounts.map(accountId => {
                  const account = savingsAccounts.find(acc => acc.id === accountId);
                  const balances = account ? savingsAccountBalances[account.did] : null;
                  const availableAmount = selectedToken === 'ETH' 
                    ? balances?.eth || '0'
                    : balances?.usdc || '0';
                  
                  return (
                    <Box key={accountId} sx={{ ml: 2, mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        • {account?.name}: {availableAmount} {selectedToken}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
            
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
            <Typography variant="h6" gutterBottom>
              Confirm Transfer
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" component="div" gutterBottom sx={{ fontWeight: 'bold' }}>
                Transfer {fundingAmount} {selectedToken}
              </Typography>
              
              {/* From Account Details */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontWeight: 'bold', color: 'error.main' }}>
                  From (Savings Accounts):
                </Typography>
                {selectedSavingsAccounts.map(accountId => {
                  const account = savingsAccounts.find(acc => acc.id === accountId);
                  const balances = account ? savingsAccountBalances[account.did] : null;
                  const extracted = account?.did ? extractFromAccountDid(account.did) : null;
                  
                  return (
                    <Box key={accountId} sx={{ mb: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                      <Typography variant="body2" component="div" sx={{ fontWeight: 'bold' }}>
                        {account?.name} ({account?.code})
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        DID: {account?.did}
                      </Typography>
                      {extracted && (
                        <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          Chain ID: {extracted.chainId} | Address: {extracted.address}
                        </Typography>
                      )}
                      {balances && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
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
              </Paper>
              
              {/* To Account Details */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  To (Credit Card Account):
                </Typography>
                <Box sx={{ pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                  <Typography variant="body2" component="div" sx={{ fontWeight: 'bold' }}>
                    {selectedCreditCard?.accountName}
                  </Typography>
                  <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    DID: {selectedCreditCard?.accountDid}
                  </Typography>
                  {selectedCreditCard?.accountDid && (() => {
                    const extracted = extractFromAccountDid(selectedCreditCard.accountDid);
                    return extracted && (
                      <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        Chain ID: {extracted.chainId} | Address: {extracted.address}
                      </Typography>
                    );
                  })()}
                  {selectedCreditCard?.accountDid && creditCardBalances[selectedCreditCard.accountDid] && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip 
                        label={`${creditCardBalances[selectedCreditCard.accountDid].ETH} ETH`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip 
                        label={`${creditCardBalances[selectedCreditCard.accountDid].USDC} USDC`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  )}
                </Box>
              </Paper>
              
              {/* Transfer Details */}
              {selectedRoute && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" component="div">
                    <strong>Transfer Route:</strong> {selectedRoute.steps[0]?.tool || 'LiFi'}<br />
                    <strong>Estimated Gas:</strong> {selectedRoute.gasCostUSD ? `$${parseFloat(selectedRoute.gasCostUSD).toFixed(2)}` : 'N/A'}<br />
                    <strong>From Amount:</strong> {(() => {
                      const amount = selectedRoute.fromToken.symbol === 'ETH' 
                        ? (parseFloat(selectedRoute.fromAmount) / 1e18).toFixed(6)
                        : (parseFloat(selectedRoute.fromAmount) / 1e6).toFixed(2);
                      return `${amount} ${selectedRoute.fromToken.symbol}`;
                    })()}<br />
                    <strong>To Amount:</strong> {(() => {
                      const amount = selectedRoute.toToken.symbol === 'ETH' 
                        ? (parseFloat(selectedRoute.toAmount) / 1e18).toFixed(6)
                        : (parseFloat(selectedRoute.toAmount) / 1e6).toFixed(2);
                      return `${amount} ${selectedRoute.toToken.symbol}`;
                    })()}
                  </Typography>
                </Alert>
              )}
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleConfirmTransfer}
                
                color="primary"
              >
                {isLoading ? <CircularProgress size={24} /> : 'Confirm Transfer'}
              </Button>
            </Box>
            
            {/* Show loading state when fetching routes */}
            {isLoadingRoutes && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Finding transfer routes...</Typography>
              </Box>
            )}
            
            {/* Show error if routes failed to load */}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
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