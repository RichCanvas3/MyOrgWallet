import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';
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
} from "viem";



import { CHAIN_IDS_TO_USDC_ADDRESSES, CHAIN_IDS_TO_TOKEN_MESSENGER, DESTINATION_DOMAINS } from '../libs/chains';

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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { IndivAccountAttestation, AccountOrgDelAttestation } from '../models/Attestation';

import { ETHERUM_RPC_URL, OPTIMISM_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, LINEA_SEPOLIA_RPC_URL } from "../config";
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


import { getWalletClient, switchChain } from '@wagmi/core'

import { createConfig as createWagmiConfig2 } from '@wagmi/core'
import { createConfig as createWagmiConfig } from 'wagmi'
import { metaMask } from 'wagmi/connectors'

const optimismProvider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);



// Create Wagmi config
console.info("*********** create wagmiConfig ****************")



const wagmiConfig = createWagmiConfig2({
  //connectors: [metaMask({  [mainnet, optimism, linea, sepolia, base, baseSepolia, optimismSepolia] })],
   chains: [mainnet, optimism, linea, sepolia, base, baseSepolia, optimismSepolia],
    client({ chain }) {
      console.info("*********** create client ****************: ", chain.id);
      return createClient({ chain, transport: http() })
    },
  })

  // chain for optimism sepolia is 11155420
  // chain for linea sepolia is 59141
  // chain for eth sepolia is 11155111




createConfig({
    integrator: 'MyOrgWallet',
    rpcUrls: {
      [ChainId.ETH]: [ETHERUM_RPC_URL],
      [ChainId.OPT]: [OPTIMISM_RPC_URL],
      [ChainId.LNA]: [LINEA_RPC_URL],
      [ChainId.SUP]: [SEPOLIA_RPC_URL],
      [11155420]: [OPTIMISM_SEPOLIA_RPC_URL],
      [59141]: [LINEA_SEPOLIA_RPC_URL],
    } as any,
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
    preloadChains: true,
  })




interface AddAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const steps = ['Select Chain & Account', 'Account Details', 'Confirm'];

// Available chains for selection
const availableChains = [
  { id: linea.id, name: linea.name, nativeCurrency: linea.nativeCurrency, chain: linea },
  { id: mainnet.id, name: mainnet.name, nativeCurrency: mainnet.nativeCurrency, chain: mainnet },
  { id: optimism.id, name: optimism.name, nativeCurrency: optimism.nativeCurrency, chain: optimism },
  { id: lineaSepolia.id, name: lineaSepolia.name, nativeCurrency: lineaSepolia.nativeCurrency, chain: lineaSepolia },
  { id: sepolia.id, name: sepolia.name, nativeCurrency: sepolia.nativeCurrency, chain: sepolia },
  { id: optimismSepolia.id, name: optimismSepolia.name, nativeCurrency: optimismSepolia.nativeCurrency, chain: optimismSepolia },
];

const AddAccountModal: React.FC<AddAccountModalProps> = ({ isVisible, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [accountName, setAccountName] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [coaCategory, setCoaCategory] = useState('');
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

  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();

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
    setSelectedAccount('');
    setSelectedChain(linea.id);
    setEthBalance('0');
    setUsdcBalance('0');
    setError(null);
    onClose();
  };

  const connectWallet = async () => {
    try {
      await connect({ connector: injected() });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError('Failed to connect wallet');
    }
  };

  const circleCheckNativeBalance = async (address: string, chainId: number) => {

    const ch = availableChains.find(c => c.id === chainId)?.chain;
    const publicClient = createPublicClient({
        chain: ch,
        transport: http(),
      });
    
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });
    return balance;

  };


  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];
  const USDC_ADDRESSES: Record<number, string> = {
    // Mainnets
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",       // Ethereum
    10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",     // Optimism
    59144: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",   // Linea
  
    // Testnets
    11155111: "0x65aFADD39029741B3b8f0756952C74678c9cEC93", // Ethereum Sepolia
    11155420: "0x694cD7F69C99B5e928044974C9dD480b688372B1", // Optimism Sepolia
    59141: "0x8d48ba6D6ABD283E672B917cDFbD6222dd1B80dB",    // Linea Sepolia
  };


  const circleCheckUSDCBalance = async (address: string, chainId: number): Promise<string> => {

    // get testnet USDC balances
    let usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[chainId] as `0x${string}`;
    const ch = availableChains.find(c => c.id === chainId)?.chain;
    const publicClient = createPublicClient({
      chain: ch,
      transport: http(),
    });

    
    if (usdcAddress && ch) {
      // used to get testnet USDC balances
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            payable: false,
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      console.info("balance: ", balance)

      const decimals = 6

      return ethers.formatUnits(balance, decimals); 


    }
  

    // used to get mainnet USDC balances
    usdcAddress = USDC_ADDRESSES[chainId].toLowerCase() as `0x${string}`;
    const rpcUrl = RPC_URLS[chainId];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
    const balance = await usdcContract.balanceOf(address)
    const decimals = await usdcContract.decimals()


    return ethers.formatUnits(balance, decimals); 
  };


  const fetchBalances = async (accountAddress: string, chainId: number) => {
    if (!accountAddress) return;
    
    setIsLoadingBalances(true);
    try {

        //const nativeToken = "0x0000000000000000000000000000000000000000"
        //const usdcToken = "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"

        // get balances for the tokens using LiFi SDK
        //const tokensResponse = await getTokens({ chains: [chainId] });
        //const tokens = tokensResponse.tokens[chainId];
        //console.info("tokens: ", tokens)
        //const filteredTokens = tokens.filter(item => 
        //    item.address === nativeToken || 
        //    item.address === usdcToken);





        
        // Set native token balance

        const nativeBalance = await circleCheckNativeBalance(accountAddress, chainId)
        console.info("nativeBalance: ", nativeBalance)


        if (nativeBalance) {
          const weiBigInt = typeof nativeBalance === 'string' ? BigInt(nativeBalance) : nativeBalance;
          const eth = Number(weiBigInt) / 1e18;
          setEthBalance(eth.toFixed(6));
        } else {
          setEthBalance('0');
        }

        
        const usdcBalance = await circleCheckUSDCBalance(accountAddress, chainId)
        console.info("usdcBalance 0: ", usdcBalance)
        const dollars = Number(usdcBalance)
        setUsdcBalance(dollars.toFixed(2));
        console.info("usdcBalance 1: ", usdcBalance)
          

        /*
        setEthBalance(nativeBalance.toString());
        setUsdcBalance(usdcBalance);

        
        // Fetch balances for the tokens
        const tokenBalances = await getTokenBalances(accountAddress, tokens);
        const nativeBalance = tokenBalances.find(balance => 
          balance.symbol === "ETH"
        );
        if (nativeBalance && nativeBalance.amount) {
          const weiBigInt = typeof nativeBalance.amount === 'string' ? BigInt(nativeBalance.amount) : nativeBalance.amount;
          const eth = Number(weiBigInt) / 1e18;
          setEthBalance(eth.toFixed(6));
        } else {
          setEthBalance('0');
        }

        
        // Set USDC balance
        const usdcBalance = tokenBalances.find(balance => 
          balance.symbol === "USDC"
        );
        console.info("usdcBalance: ", usdcBalance)
        if (usdcBalance && usdcBalance.amount) {
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          setUsdcBalance(dollars.toFixed(2));
        } else {
          setUsdcBalance('0');
        }
          */



    } catch (error) {
      console.error('Error fetching balances:', error);
      setEthBalance('0');
      setUsdcBalance('0');
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const switchToChain = async (chainId: number) => {
    console.info("*********** switchToChain ****************: ", chainId);
    setIsSwitchingChain(true);
    setError(null);
    
    try {
      await switchChain({ chainId });
      setSelectedChain(chainId);
      // Refresh accounts after chain switch
      await getMetaMaskAccounts();
    } catch (error) {
      console.error('Error switching chain:', error);
      setError('Failed to switch chain. Please try switching manually in MetaMask.');
    } finally {
      setIsSwitchingChain(false);
    }
  };

  const getMetaMaskAccounts = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setAvailableAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedAccount(accounts[0]);
          // Fetch balances for the first account
          await fetchBalances(accounts[0], selectedChain);
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
    // Fetch balances for the selected account
    await fetchBalances(account, selectedChain);
  };

  const handleChainSelect = async (chainId: number) => {
    if (chainId !== selectedChain) {
      await switchToChain(chainId);
      // Fetch balances for the selected account on the new chain
      if (selectedAccount) {
        await fetchBalances(selectedAccount, chainId);
      }
    }
  };

  const handleSave = async () => {

    if (!selectedAccount || !accountName || !coaCode || !coaCategory || !chain || !indivDid) {
      setError('Missing required information');
      return;
    }

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
              category: "account",
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

        const delegationJsonStr = ""

        const vc = await VerifiableCredentialsService.createAccountOrgDelVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, coaCode, coaCategory, delegationJsonStr);
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
              coaCategory: coaCategory,
              delegation: delegationJsonStr,
              attester: orgDid,
              class: "organization",
              category: "account",
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

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box display="flex" flexDirection="column" gap={3} p={2}>
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
              <>
                <Typography variant="body1" color="text.secondary">
                  Connected Account: {address?.slice(0, 6)}...{address?.slice(-4)}
                </Typography>
                
                <FormControl fullWidth>
                  <InputLabel>Select Chain</InputLabel>
                  <Select
                    value={selectedChain}
                    onChange={(e) => handleChainSelect(e.target.value as number)}
                    label="Select Chain"
                    disabled={isSwitchingChain}
                  >
                    {availableChains.map((chain) => (
                      <MenuItem key={chain.id} value={chain.id}>
                        {chain.name} ({chain.nativeCurrency.symbol})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {isSwitchingChain && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={16} />
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

                {selectedAccount && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Account Balances:
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {isLoadingBalances ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <CircularProgress size={16} />
                          <Typography variant="body2">Loading balances...</Typography>
                        </Box>
                      ) : (
                        <>
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
                        </>
                      )}
                    </Box>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary">
                  Current Chain: {chain?.name} (ID: {chain?.id})
                </Typography>

                <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={!selectedAccount || isSwitchingChain}
                  >
                    Next
                  </Button>
                </Box>
              </>
            )}
          </Box>
        );

      case 1:
        return (
          <Box display="flex" flexDirection="column" gap={3} p={2}>
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

            <TextField
              fullWidth
              label="Account Name"
              variant="outlined"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Enter a name for this account"
              error={!!error}
              helperText={error}
            />

            <TextField
              fullWidth
              label="CoA Code"
              variant="outlined"
              value={coaCode}
              onChange={(e) => setCoaCode(e.target.value)}
              placeholder="Enter the Chart of Accounts code"
            />

            <TextField
              fullWidth
              label="CoA Category"
              variant="outlined"
              value={coaCategory}
              onChange={(e) => setCoaCategory(e.target.value)}
              placeholder="Enter the Chart of Accounts category"
            />

            <Box display="flex" justifyContent="space-between" gap={2} mt={2}>
              <Button onClick={handleBack}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!accountName || !coaCode || !coaCategory}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box display="flex" flexDirection="column" gap={3} p={2}>
            <Typography variant="h6" gutterBottom>
              Confirm Account Creation
            </Typography>
            
            <Alert severity="info">
              <Typography variant="body2">
                You are about to create an account attestation with the following details:
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
                <strong>CoA Category:</strong> {coaCategory}
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

            <Box display="flex" justifyContent="space-between" gap={2} mt={2}>
              <Button onClick={handleBack}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
              </Button>
            </Box>
          </Box>
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
              <h1 className="text-lg font-semibold">
                Add Account
              </h1>
              <button
                onClick={handleClose}
                className="text-gray-700 hover:text-gray-900"
              >
                <XMarkIcon className="h-8 w-8" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col p-4" style={{ height: "calc(80vh - 70px)" }}>
              <Paper
                elevation={4}
                sx={{
                  width: "100%",
                  height: "100%",
                  p: 4,
                }}
              >
                <Box
                  display="flex"
                  flexDirection="column"
                  justifyContent="flex-start"
                  alignItems="flex-start"
                  bgcolor="grey.50"
                  width="100%"
                >
                  <Stepper activeStep={activeStep} sx={{ width: '100%', mb: 4 }}>
                    {steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                  {renderStepContent()}
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