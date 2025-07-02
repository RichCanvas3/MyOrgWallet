import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import { getAddress } from "ethers"; 
import { linea, mainnet, optimism, sepolia, optimismSepolia, lineaSepolia, base, baseSepolia } from "viem/chains";
import { getTokens, EVM, getToken, getTokenBalance , createConfig, getQuote, getTokenBalances,  } from '@lifi/sdk';
import {
  createWalletClient,
  http,
  encodeFunctionData,
  HttpTransport,
  type Chain,
  type Account,
  type WalletClient,
  type Hex,
  TransactionExecutionError,
  parseUnits,
  createClient,
  createPublicClient,
  formatUnits,
  parseEther,
  custom,
  toHex,
  zeroAddress,

} from "viem";

import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  createDelegation,
  type ToMetaMaskSmartAccountReturnType,
  DelegationFramework,
  SINGLE_DEFAULT_MODE,
  getExplorerTransactionLink,
  getExplorerAddressLink,
  createExecution,
  getDelegationHashOffchain,
  Delegation
} from "@metamask/delegation-toolkit";

import {
  createBundlerClient,
  createPaymasterClient,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { BUNDLER_URL, PAYMASTER_URL } from "../config";

import type { Token } from '@lifi/types';
import { ChainId } from '@lifi/types';

import {
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { IndivAccountAttestation, AccountOrgDelAttestation } from '../models/Attestation';

import { CHAIN_ID, ETHERUM_RPC_URL, OPTIMISM_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, LINEA_SEPOLIA_RPC_URL } from "../config";
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


import { getWalletClient, switchChain } from '@wagmi/core'

import { createConfig as createWagmiConfig } from '@wagmi/core'
//import { createConfig as createWagmiConfig } from 'wagmi'
//import { metaMask } from 'wagmi/connectors'

import { useCrossChainAccount } from "../hooks/useCrossChainTools";

import { IRIS_API_URL, CHAIN_IDS_TO_BUNDLER_URL, CHAIN_IDS_TO_MESSAGE_TRANSMITTER, CHAIN_IDS_TO_EXPLORER_URL, CIRCLE_SUPPORTED_CHAINS, CHAIN_IDS_TO_USDC_ADDRESSES, CHAIN_TO_CHAIN_NAME, CHAIN_IDS_TO_TOKEN_MESSENGER, CHAIN_IDS_TO_RPC_URLS, DESTINATION_DOMAINS, CHAINS } from '../libs/chains';
import { chainIdNetworkParamsMapping } from '@blockchain-lab-um/masca-connector';
import { COA_OPTIONS } from '../constants/chartOfAccounts';
import InfoIcon from '@mui/icons-material/Info';

// Debug: Check if COA_OPTIONS is imported correctly
console.log('COA_OPTIONS imported:', COA_OPTIONS?.length, 'items');

const optimismProvider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);



// Create Wagmi config
console.info("*********** create wagmiConfig ****************")



const wagmiConfig = createWagmiConfig({
  //connectors: [metaMask({  [mainnet, optimism, linea, sepolia, base, baseSepolia, optimismSepolia] })],
   chains: [mainnet, optimism, linea, sepolia, base, baseSepolia, optimismSepolia],
    client({ chain }) {
      console.info("*********** create client ****************: ", chain.id);
      return createClient({ chain, transport: http() })
    },
  })


createConfig({
    integrator: 'MyOrgWallet',
    rpcUrls: {
      [ChainId.ETH]: [ETHERUM_RPC_URL],
      [ChainId.OPT]: [OPTIMISM_RPC_URL],
      [ChainId.LNA]: [LINEA_RPC_URL],
      [ChainId.SUP]: [SEPOLIA_RPC_URL],
    } as any,
    providers: [
      EVM({
        getWalletClient: () => getWalletClient(wagmiConfig),
        switchChain: async (chainId: any) => {
            console.info("*********** SWITCH CHAIN ****************")
          const chain = await switchChain(wagmiConfig, { chainId })
          return getWalletClient(wagmiConfig, { chainId: chain.id })
        },
      }),
    ],
    preloadChains: true,
  })




interface AddAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const steps = ['Select Chain & Account', 'Account Details', 'Confirm'];

// Available chains for selection - include all supported chains
const availableChains = Object.entries(CHAINS).map(([chainId, chain]) => ({
  id: parseInt(chainId),
  name: chain.name,
  nativeCurrency: chain.nativeCurrency,
  chain: chain
}));

const AddAccountModal: React.FC<AddAccountModalProps> = ({ isVisible, onClose, onRefresh }) => {

  const [activeStep, setActiveStep] = useState(0);
  const [accountName, setAccountName] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [coaCategory, setCoaCategory] = useState('');
  const [selectedCoaCategory, setSelectedCoaCategory] = useState<string>('');
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState<number>(linea.id);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const { chain, orgDid, orgIndivDelegation, orgIssuerDelegation, orgAccountClient, veramoAgent, mascaApi, privateIssuerAccount, burnerAccountClient, indivIssuerDelegation, indivAccountClient, indivDid, privateIssuerDid, signatory } = useWallectConnectContext();

  const { getUSDCChainTokenInfo, getUSDCBalance, getEthBalance } = useCrossChainAccount();

  const { isConnected, address } = useAccount();
  const { connect } = useConnect();

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleClose = () => {
    setActiveStep(0);
    setAccountName('');
    setCoaCode('');
    setCoaCategory('');
    setSelectedCoaCategory('');
    setInputValue(undefined);
    setSelectedAccount('');
    setSelectedChain(CHAIN_ID);
    setEthBalance('0');
    setUsdcBalance('0');
    setError(null);
    onClose();
  };

  const connectWallet = async () => {
    try {
      await connect({ connector: injected() });
      // After connecting, get accounts with enhanced connection
      await connectToMetaMaskWithNetwork();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError('Failed to connect wallet');
    }
  };




  const fetchBalances = async (accountAddress: string, chainId: number) => {

    
    if (!accountAddress) return;

    console.info("*********** fetchBalances ****************: ", accountAddress, chainId)
    
    setIsLoadingBalances(true);
    try {

        // Set native token balance
        const nativeBalance = await getEthBalance(accountAddress, chainId)
        console.info("nativeBalance: ", nativeBalance)


        if (nativeBalance) {
          const weiBigInt = typeof nativeBalance === 'string' ? BigInt(nativeBalance) : nativeBalance;
          const eth = Number(weiBigInt) / 1e18;
          setEthBalance(eth.toFixed(6));
        } else {
          setEthBalance('0');
        }

        // connect to metamask account
        const usdcBalance = await getUSDCBalance(accountAddress, chainId)

        console.info("usdcBalance 0: ", usdcBalance)
        const dollars = Number(usdcBalance)
        setUsdcBalance(dollars.toFixed(2));
        console.info("usdcBalance 1: ", usdcBalance)
          



    } catch (error) {
      console.error('Error fetching balances:', error);
      setEthBalance('0');
      setUsdcBalance('0');
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Generic function to add/switch to any chain in MetaMask
  const addChainToMetaMask = async (chainId: number) => {
    try {
      console.info(`Attempting to switch to chain ${chainId} (${toHex(chainId)})`);
      
      // First try to switch to the network (in case it's already added)
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHex(chainId) }]
      });
      
      console.info(`Successfully switched to chain ${chainId}`);
    } catch (switchError: any) {
      console.info(`Switch error for chain ${chainId}:`, switchError);
      
      // If the network doesn't exist (error code 4902), add it
      if (switchError.code === 4902) {
        try {
          const chain = CHAINS[chainId];
          if (!chain) {
            throw new Error(`Chain with ID ${chainId} not supported`);
          }

          // Get RPC URL and block explorer URL
          const rpcUrl = CHAIN_IDS_TO_RPC_URLS[chainId];
          const explorerUrl = CHAIN_IDS_TO_EXPLORER_URL[chainId];
          
          console.info(`Adding chain ${chainId}:`, {
            chainId: toHex(chainId),
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrl,
            explorerUrl
          });
          
          // Ensure RPC URL is an array and not empty
          const rpcUrls = rpcUrl ? [rpcUrl] : ['https://ethereum.publicnode.com'];
          
          // Ensure block explorer URL is an array and not empty
          const blockExplorerUrls = explorerUrl ? [explorerUrl] : [];

          const addParams = {
            chainId: toHex(chainId),
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: rpcUrls,
            blockExplorerUrls: blockExplorerUrls
          };
          
          console.info(`Adding chain with params:`, addParams);

          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [addParams]
          });
          
          console.info(`Successfully added chain ${chainId}`);
        } catch (addError) {
          console.error(`Error adding chain ${chainId} to MetaMask:`, addError);
          throw new Error(`Please add ${CHAINS[chainId]?.name || 'the network'} to MetaMask manually`);
        }
      } else {
        console.error(`Error switching to chain ${chainId}:`, switchError);
        throw new Error(`Please switch to ${CHAINS[chainId]?.name || 'the network'} in MetaMask`);
      }
    }
  };

  // Function to check if current network is supported and switch if needed
  const checkAndSwitchToSupportedNetwork = async () => {
    try {
      // Get current chain ID from MetaMask
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });
      
      const currentChainId = parseInt(chainId, 16);
      console.info("Current chain ID:", currentChainId);
      
      // Check if current chain is supported
      const isSupported = availableChains.some(chain => chain.id === currentChainId);
      
      if (!isSupported) {
        console.info("Current network not supported, switching to default (Linea)");
        // Switch to a default supported network (Linea)
        await addChainToMetaMask(linea.id);
        setSelectedChain(linea.id);
        return linea.id;
      }
      
      setSelectedChain(currentChainId);
      return currentChainId;
    } catch (error) {
      console.error('Error checking current network:', error);
      // Default to Linea if there's an error
      setSelectedChain(linea.id);
      return linea.id;
    }
  };

  // Enhanced MetaMask connection with network switching
  const connectToMetaMaskWithNetwork = async (targetChainId?: number) => {
    try {
      // Request account access from MetaMask
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No MetaMask accounts found. Please connect your wallet.');
      }
      
      const connectedAccount = accounts[0] as `0x${string}`;
      console.info("Connected to MetaMask account:", connectedAccount);
      
      // Check and switch to supported network if needed
      const supportedChainId = await checkAndSwitchToSupportedNetwork();
      
      // If a specific chain is requested, switch to it
      if (targetChainId) {
        await addChainToMetaMask(targetChainId);
      }
      
      return connectedAccount;
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      throw new Error(`Failed to connect to MetaMask: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Enhanced chain switching with network addition
  const switchToChainWithNetwork = async (chainId: number) => {
    console.info("*********** switchToChainWithNetwork ****************: ", chainId);
    setIsSwitchingChain(true);
    setError(null);
    
    try {
      await addChainToMetaMask(chainId);
      setSelectedChain(chainId);
      
      // Refresh accounts after chain switch
      await getMetaMaskAccounts();
    } catch (error: any) {
      console.error('Error switching chain:', error);
      setError(error.message || 'Failed to switch chain. Please try switching manually in MetaMask.');
    } finally {
      setIsSwitchingChain(false);
    }
  };



  const getMetaMaskAccounts = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const connectedAccount = await connectToMetaMaskWithNetwork();
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setAvailableAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedAccount(accounts[0]);
          // Fetch balances for the first account
          await fetchBalances(accounts[0], selectedChain);

          // add AA for EOA account
          console.info("*********** add AA for EOA account: ", selectedChain)
          const RPC_URL = CHAIN_IDS_TO_RPC_URLS[selectedChain]
          const publicClient = createPublicClient({
            chain: chain,
            transport: http(RPC_URL),
          });
          const accountClient = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [selectedAccount as `0x${string}`, [], [], []],
            signatory: signatory,
            deploySalt: toHex(0),
          });
          console.info("*********** EOA default accountClient: ", accountClient.address)

        }
      } catch (error) {
        console.error('Error getting accounts:', error);
        setError('Failed to get MetaMask accounts');
      }
    } else {
      setError('MetaMask is not installed');
    }
  };

  const handleAccountSelect = async (account: string) => {
    setSelectedAccount(account);
    
    try {
      // Switch to the selected account in MetaMask
      await switchToMetaMaskAccount(account);
      
      // Fetch balances for the selected account
      await fetchBalances(account, selectedChain);
    } catch (error) {
      console.error('Error switching to account:', error);
      setError('Failed to switch to selected account in MetaMask');
    }
  };

  // Function to switch to a specific account in MetaMask
  const switchToMetaMaskAccount = async (accountAddress: string) => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Get current accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Check if the selected account is in the list
      if (!accounts.includes(accountAddress)) {
        throw new Error('Selected account not found in MetaMask');
      }

      // If the selected account is not the current active account, try to switch to it
      if (accounts[0] !== accountAddress) {
        try {
          // Try to request permissions for the specific account
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{
              eth_accounts: {}
            }]
          });
          
          // Wait a bit for MetaMask to process the request
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get accounts again to see if the switch worked
          const newAccounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
          });
          
          if (newAccounts[0] !== accountAddress) {
            console.warn('Account switch may not have been successful. User may need to manually switch in MetaMask.');
            // Show a user-friendly message
            setError('Please manually switch to the selected account in MetaMask');
          } else {
            console.info('Successfully switched to account:', accountAddress);
          }
        } catch (permissionError) {
          console.warn('Could not automatically switch accounts. User may need to manually switch in MetaMask.');
          setError('Please manually switch to the selected account in MetaMask');
        }
      } else {
        console.info('Account is already active:', accountAddress);
      }
    } catch (error) {
      console.error('Error switching to MetaMask account:', error);
      throw error;
    }
  };

  const handleChainSelect = async (chainId: number) => {
    setSelectedChain(chainId);
    await switchToChainWithNetwork(chainId);
    
    // If Linea mainnet is selected, request additional accounts
    if (chainId === linea.id) {
      await requestAdditionalAccounts();
    }
  };

  // Function to request additional accounts from MetaMask
  const requestAdditionalAccounts = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed');
      return;
    }

    try {
      console.info('Requesting additional accounts for Linea mainnet...');
      
      // Request permissions for additional accounts
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{
          eth_accounts: {}
        }]
      });
      
      // Wait a moment for MetaMask to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get all available accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      console.info('Available accounts after permission request:', accounts);
      setAvailableAccounts(accounts);
      
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0]);
        // Fetch balances for the first account
        await fetchBalances(accounts[0], selectedChain);
      }
      
    } catch (error) {
      console.error('Error requesting additional accounts:', error);
      setError('Failed to request additional accounts from MetaMask');
    }
  };

  const handleSave = async () => {

    if (!selectedAccount || !accountName || !coaCode || !selectedCoaCategory || !chain || !indivDid) {
      setError('Missing required information');
      return;
    }

    console.info("coaCode: ", coaCode)
    console.info("selectedCoaCategory: ", selectedCoaCategory)

    setIsLoading(true);
    setError(null);

    const accountDid = "did:pkh:eip155:" + selectedChain + ":" + selectedAccount

    console.info("*********** ADD ACCOUNT ATTESTATION ****************")
    const provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const walletSigner = await provider.getSigner()

    const walletClient = signatory.walletClient
    let entityId = "account(indiv)"

    if (walletSigner && walletClient && privateIssuerAccount && indivDid && mascaApi && privateIssuerDid) {

      const vc = await VerifiableCredentialsService.createAccountVC(entityId, privateIssuerDid, accountDid, indivDid, accountName);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof

      if (fullVc && chain && indivDid && indivAccountClient && burnerAccountClient && indivIssuerDelegation && indivAccountClient) {
      

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: IndivAccountAttestation = {
            accountName: accountName,
            accountDid: accountDid,
            accountBalance: "0",
            attester: indivDid,
            class: "individual",
            category: "financial",
            entityId: entityId,
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            proof: proof
        };

        const uid = await AttestationService.addIndivAccountAttestation(chain, attestation, walletSigner, [indivIssuerDelegation], indivAccountClient, burnerAccountClient)
      }
  }






    console.info("*********** ADD ORG ACCOUNT DELEGATION ATTESTATION ****************")
    entityId = "account-org(org)"

    if (walletSigner && walletClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

        

        /*

        let eoaAccountDel = createDelegation({
          to: accountClient.address,
          from: selectedAccount as `0x${string}`,
          caveats: [] }
        );
  
        const signature = await accountClient.signDelegation({
          delegation: eoaAccountDel,
        });
  
        eoaAccountDel = {
          ...eoaAccountDel,
          signature,
        }

        const delegationJsonStr = JSON.stringify(eoaAccountDel)
        */

        const delegationJsonStr = ""

        const vc = await VerifiableCredentialsService.createAccountOrgDelVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, coaCode, selectedCoaCategory, delegationJsonStr);
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof


        if (fullVc && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {

          // now create attestation
          console.info("********** add org account attestation ****************")
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: AccountOrgDelAttestation = {
              accountName: accountName,
              accountDid: accountDid,
              coaCode: coaCode,
              coaCategory: selectedCoaCategory,
              delegation: delegationJsonStr,
              attester: orgDid,
              class: "organization",
              category: "financial",
              entityId: entityId,
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              proof: proof
          };

          const uid = await AttestationService.addAccountOrgDelAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
        }
    }

    setAccountName('');
    setError(null);
    onClose();
    onRefresh?.();

  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box display="flex" flexDirection="column" gap={3} p={2} sx={{ flex: 1, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Select Chain & MetaMask Account
              </Typography>
              
              {!isConnected ? (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <Typography variant="body1">Please connect your MetaMask wallet</Typography>
                  <Button variant="contained" onClick={connectWallet}>
                    Connect MetaMask
                  </Button>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={3}>
                  <FormControl fullWidth>
                    <InputLabel>Select Chain</InputLabel>
                    <Select
                      value={selectedChain}
                      onChange={(e) => handleChainSelect(e.target.value as number)}
                      label="Select Chain"
                      disabled={isSwitchingChain}
                      autoFocus
                    >
                      {availableChains.map((chain) => (
                        <MenuItem key={chain.id} value={chain.id}>
                          {chain.name} ({chain.nativeCurrency.symbol})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {isSwitchingChain && (
                    <Box display="flex" alignItems="center" gap={2}>
                      <CircularProgress size={20} />
                      <Typography variant="body2">Switching chain...</Typography>
                    </Box>
                  )}

                  <FormControl fullWidth>
                    <InputLabel>Select Account</InputLabel>
                    <Select
                      value={selectedAccount}
                      onChange={(e) => handleAccountSelect(e.target.value)}
                      label="Select Account"
                      disabled={isSwitchingChain}
                    >
                      {availableAccounts.map((account) => (
                        <MenuItem key={account} value={account}>
                          {account.slice(0, 6)}...{account.slice(-4)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Button to request additional accounts */}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={requestAdditionalAccounts}
                    disabled={isSwitchingChain}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Request Additional Accounts
                  </Button>

                  {selectedAccount && (
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip 
                        label={`${ethBalance} ${availableChains.find(c => c.id === selectedChain)?.nativeCurrency.symbol}`}
                        color="primary"
                        size="small"
                      />
                      <Chip 
                        label={`${usdcBalance} USDC`}
                        color="secondary"
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {isConnected && (
              <Box display="flex" justifyContent="space-between" gap={2} mt={4}>
                <Button onClick={handleBack} tabIndex={-1}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!selectedChain || !selectedAccount}
                >
                  Next
                </Button>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box display="flex" flexDirection="column" gap={2} p={2} sx={{ flex: 1, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Account Details
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Selected Account: {selectedAccount.slice(0, 6)}...{selectedAccount.slice(-4)}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Selected Chain: {availableChains.find(c => c.id === selectedChain)?.name}
              </Typography>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Account Balances:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip 
                    label={`${ethBalance} ${availableChains.find(c => c.id === selectedChain)?.nativeCurrency.symbol}`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip 
                    label={`${usdcBalance} USDC`}
                    color="secondary"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 4, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Enter the following details for your account:
                </Typography>
                <Tooltip title="This information helps categorize and organize your account within the organization's chart of accounts.">
                  <IconButton size="small" sx={{ p: 0 }} tabIndex={-1}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Account Name"
                  variant="outlined"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Enter a name for this account"
                  error={!!error}
                  helperText={error}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && accountName && coaCode && selectedCoaCategory && !isLoading) {
                      handleNext();
                    }
                  }}
                />
              </Box>

              <Box sx={{ mt: 3 }}>
                <TextField
                  fullWidth
                  label="CoA Code"
                  variant="outlined"
                  value={coaCode}
                  onChange={(e) => setCoaCode(e.target.value)}
                  placeholder="Enter the Chart of Accounts code"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && accountName && coaCode && selectedCoaCategory && !isLoading) {
                      handleNext();
                    }
                  }}
                />
              </Box>

              <Box sx={{ mt: 3 }}>
                <Autocomplete
                  fullWidth
                  options={COA_OPTIONS}
                  getOptionLabel={(option) => option.displayName}
                  value={COA_OPTIONS.find(option => option.id === selectedCoaCategory) || null}
                  inputValue={inputValue}
                  onInputChange={(event, newInputValue) => {
                    setInputValue(newInputValue);
                  }}
                  onChange={(event, newValue) => {
                    setSelectedCoaCategory(newValue ? newValue.id : '');
                    setInputValue(newValue ? newValue.id : undefined);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      // Get the currently highlighted option and select it
                      const input = event.target as HTMLInputElement;
                      const highlightedOption = COA_OPTIONS.find(option => 
                        option.displayName.toLowerCase().includes(input.value.toLowerCase())
                      );
                      if (highlightedOption) {
                        setSelectedCoaCategory(highlightedOption.id);
                        setInputValue(highlightedOption.id);
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="CoA Category" 
                      placeholder="Search or select a category..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && accountName && coaCode && selectedCoaCategory && !isLoading) {
                          handleNext();
                        }
                      }}
                    />
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  clearOnBlur
                  selectOnFocus
                  handleHomeEndKeys
                  autoSelect
                  sx={{ minHeight: '56px' }}
                />
              </Box>
            </Box>

            <Box display="flex" justifyContent="space-between" gap={2} mt={4}>
              <Button onClick={handleBack} tabIndex={-1}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!accountName || !coaCode || !selectedCoaCategory}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box display="flex" flexDirection="column" gap={3} p={2} sx={{ flex: 1, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Confirm Account Creation
              </Typography>
              
              <Alert severity="info">
                <Typography variant="body2">
                  You are about to create an account attestation with the following details. This will:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • Create a verifiable credential for your account
                </Typography>
                <Typography variant="body2">
                  • Generate an individual account attestation
                </Typography>
                <Typography variant="body2">
                  • Generate an organizational account delegation attestation
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Please review the details below and click "Create Account" to proceed.
                </Typography>
              </Alert>

              <Box sx={{ ml: 2 }}>
                <Typography variant="body2">
                  <strong>Account Address:</strong> {selectedAccount.slice(0, 6)}...{selectedAccount.slice(-4)}
                </Typography>
                <Typography variant="body2">
                  <strong>Chain:</strong> {availableChains.find(c => c.id === selectedChain)?.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Account Name:</strong> {accountName}
                </Typography>
                <Typography variant="body2">
                  <strong>CoA Code:</strong> {coaCode}
                </Typography>
                <Typography variant="body2">
                  <strong>CoA Category:</strong> {selectedCoaCategory}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Balances:</strong>
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" sx={{ ml: 2, mt: 0.5 }}>
                  <Chip 
                    label={`${ethBalance} ${availableChains.find(c => c.id === selectedChain)?.nativeCurrency.symbol}`}
                    color="primary"
                    size="small"
                  />
                  <Chip 
                    label={`${usdcBalance} USDC`}
                    color="secondary"
                    size="small"
                  />
                </Box>
              </Box>
            </Box>

            <Box display="flex" justifyContent="space-between" gap={2} mt={4}>
              <Button onClick={handleBack} tabIndex={-1}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  // Create wallet client with connected MetaMask account
  const createMetaMaskWalletClient = async (chainId: number) => {
    try {
      // Ensure we're connected to MetaMask
      const connectedAccount = await connectToMetaMaskWithNetwork(chainId);
      
      // Get the chain configuration
      const chain = availableChains.find(c => c.id === chainId);
      if (!chain) {
        throw new Error(`Chain with ID ${chainId} not found`);
      }
      
      // Create wallet client with MetaMask provider
      const walletClient = createWalletClient({
        chain: chain.chain,
        transport: custom(window.ethereum),
        account: connectedAccount,
      });
      
      console.info("Created MetaMask wallet client for account:", connectedAccount);
      return walletClient;
    } catch (error) {
      console.error('Error creating MetaMask wallet client:', error);
      throw new Error(`Failed to create wallet client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Connect to MetaMask, switch network, and get wallet client
  const connectMetaMaskWithNetwork = async (chainId: number) => {
    try {
      // Connect to MetaMask and switch to the specified network
      const connectedAccount = await connectToMetaMaskWithNetwork(chainId);
      
      // Create wallet client
      const walletClient = await createMetaMaskWalletClient(chainId);
      
      return {
        account: connectedAccount,
        walletClient,
        chainId
      };
    } catch (error) {
      console.error('Error connecting to MetaMask with network:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (isVisible && activeStep === 0) {
      if (!isConnected) {
        connectWallet();
      } else {
        getMetaMaskAccounts();
      }
    }
  }, [isVisible, activeStep, isConnected]);

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
            style={{ maxHeight: "85vh", minWidth: "43em" }}
          >
            <div className="flex justify-between items-center border-b border-gray-200 p-4">
              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Add Account
              </Typography>
              <button
                onClick={handleClose}
                className="text-gray-700 hover:text-gray-900"
              >
                <XMarkIcon className="h-8 w-8" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col flex-1 p-4" style={{ minHeight: 0 }}>
              <Paper
                elevation={4}
                sx={{
                  width: "100%",
                  height: "100%",
                  p: 4,
                  display: "flex",
                  flexDirection: "column",
                  mb: 2,
                }}
              >
                <Box
                  display="flex"
                  flexDirection="column"
                  justifyContent="flex-start"
                  alignItems="flex-start"
                  bgcolor="grey.50"
                  width="100%"
                  height="100%"
                  sx={{ overflow: "auto" }}
                >
                  <Stepper activeStep={activeStep} sx={{ width: '100%', mb: 4 }}>
                    {steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                  <Box sx={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
                    {renderStepContent()}
                  </Box>
                </Box>
              </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default AddAccountModal; 