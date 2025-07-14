import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import axios from "axios";
import { getTokens, EVM, getTokenBalances, createConfig, getRoutes, getStepTransaction, executeRoute } from '@lifi/sdk';
import { createWalletClient, WalletClient, HttpTransport, Chain, custom, Hex, toHex, type Address, type Account as ViemAccount } from "viem";

import { encodeFunctionData, parseUnits, TransactionExecutionError, formatUnits } from 'viem';

import { erc20Abi } from 'viem';

import type { Token, Route, LiFiStep } from '@lifi/types';
import { ChainId } from '@lifi/types';

import { getWalletClient, switchChain } from '@wagmi/core'
import { createClient, http, parseAbi, createPublicClient } from 'viem'

import { linea, mainnet, optimism, sepolia, optimismSepolia, lineaSepolia } from "viem/chains";

import { useCrossChainAccount } from "../hooks/useCrossChainTools";

import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

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
  Delegation,
} from "@metamask/delegation-toolkit";

import {
  createBundlerClient,
  createPaymasterClient,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";


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

import { CHAIN_ID, CIRCLE_API_KEY, RPC_URL, ETHERUM_RPC_URL, OPTIMISM_RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL, BUNDLER_URL, PAYMASTER_URL } from "../config";


import { CallSharp } from '@mui/icons-material';

import { IRIS_API_URL, CHAIN_IDS_TO_EXPLORER_URL, CHAIN_IDS_TO_MESSAGE_TRANSMITTER, CIRCLE_SUPPORTED_CHAINS, CHAIN_IDS_TO_USDC_ADDRESSES, CHAIN_TO_CHAIN_NAME, CHAIN_IDS_TO_TOKEN_MESSENGER, CHAIN_IDS_TO_RPC_URLS, DESTINATION_DOMAINS, CHAINS } from '../libs/chains';
import DelegationService from '../service/DelegationService';

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
  const [creditCardBalances, setCreditCardBalances] = useState<{ [accountDid: string]: { USDC: string } }>({});
  const [savingsAccountBalances, setSavingsAccountBalances] = useState<{ [accountDid: string]: { USDC: string } }>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // LiFi route states
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  
  // Available tokens state
  const [availableTokens, setAvailableTokens] = useState<{ symbol: string; name: string; address: string }[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  const { signatory, chain, indivDid, orgDid, indivAccountClient, orgAccountClient, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation } = useWallectConnectContext();
  const { isConnected } = useAccount();

  const { getUSDCChainTokenInfo, getUSDCBalance } = useCrossChainAccount();



  const burnUSDC = async (
    delegationChain: any,
    indivAccountClient: any,
    sourceChainId: number,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
  ) => {
    console.info("*********** burnUSDC ****************");
    console.info("*********** delegationChain ****************", delegationChain);
    console.info("*********** indivAccountClient ****************", indivAccountClient);



    const bundlerClient = createBundlerClient({
      transport: http(BUNDLER_URL || ''),
      paymaster: true,
      chain: chain,
      paymasterContext: {
        mode: 'SPONSORED',
      },
    });

    let calls: any[] = [];

    // Use the actual amount parameter
    const fundingAmount = amount;

    const tokenMessenger = CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId] as `0x${string}`
    const usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`
    const approvalExecution = {
      target: usdcAddress,
      callData: encodeFunctionData({
        abi: parseAbi(["function approve(address,uint)"]),
        functionName: "approve",
        args: [tokenMessenger, fundingAmount],
      }),
      value: 0n, // since it's an ERC-20 approval, you don't need to send ETH
    };

    const data0 = DelegationFramework.encode.redeemDelegations({
      delegations: [delegationChain],
      modes: [SINGLE_DEFAULT_MODE],
      executions: [[approvalExecution]]
    });

    const call0 = {
      to: indivAccountClient.address,
      data: data0,
    }

    calls.push(call0)

    const finalityThreshold = transferType === "fast" ? 1000 : 2000;
    const maxFee = fundingAmount - 1n;

    const mintRecipient = `0x${destinationAddress
      .replace(/^0x/, "")
      .padStart(64, "0")}`;

    const callData = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "depositForBurn",
          stateMutability: "nonpayable",
          inputs: [
            { name: "amount", type: "uint256" },
            { name: "destinationDomain", type: "uint32" },
            { name: "mintRecipient", type: "bytes32" },
            { name: "burnToken", type: "address" },
            { name: "hookData", type: "bytes32" },
            { name: "maxFee", type: "uint256" },
            { name: "finalityThreshold", type: "uint32" },
          ],
          outputs: [],
        },
      ],
      functionName: "depositForBurn",
      args: [
        fundingAmount,
        DESTINATION_DOMAINS[destinationChainId],
        mintRecipient as Hex,
        CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        maxFee,
        finalityThreshold,
      ],
    })

    const execution = {
      target: CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId] as `0x${string}`,
      callData: callData,
      value: 0n, // since it's an ERC-20 approval, you don't need to send ETH
    };

    console.info("*********** redeemDelegations ****************");
    const data = DelegationFramework.encode.redeemDelegations({
      delegations: [delegationChain],
      modes: [SINGLE_DEFAULT_MODE],
      executions: [[execution]]
    });

    const call = {
      to: indivAccountClient.address,
      data: data,
    }
    calls.push(call)

    const fee = {maxFeePerGas: 14342570635n, maxPriorityFeePerGas: 14342570635n}
    const paymasterClient = createPaymasterClient({
      transport: http(PAYMASTER_URL),
    });

    // Send user operation
    console.info("*********** sendUserOperation ****************");
    const userOpHash = await bundlerClient.sendUserOperation({
      account: indivAccountClient,
      calls: calls,
      paymaster: paymasterClient,
      ...fee
    });

    console.info("*********** waitForUserOperationReceipt ****************");
    const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

    console.info("*********** burn tx ****************", userOperationReceipt);

    return userOperationReceipt;
  };


  const retrieveAttestation = async (
    transactionHash: string,
    sourceChainId: number,
  ) => {




    //console.info("***********  DESTINATION_DOMAINS[sourceChainId]: ", DESTINATION_DOMAINS[sourceChainId], sourceChainId);

    //const url = `${IRIS_API_URL}/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;
    console.info("***********  CIRCLE_API_KEY: ", CIRCLE_API_KEY);
    //const url = `${IRIS_API_URL}/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;
    const url = `https://iris-api-sandbox.circle.com/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;
    console.info("***********  url: ", url);
    
    /*
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    */


    let count = 0;
    console.info("***********  url ****************", url);
    while (true) {

      try {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${CIRCLE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },);


        console.log("attestation response without", response);
    
        if (response.data?.messages?.[0]?.status === "pending") {
          return response.data.messages[0];
        }
        if (response.data?.messages?.[0]?.status === "complete") {
          return response.data.messages[0];
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }
        setError("Attestation retrieval failed");
        console.info(
          `Attestation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    }
      
  };

  const mintUSDC = async (
    destinationAddress: string,
    destinationChainId: number,
    attestation: any,
  ) => {
    const MAX_RETRIES = 3;
    let retries = 0;

    console.info("Minting USDC...");

    while (retries < MAX_RETRIES) {
      try {



        const destinationMessageTransmitter = CHAIN_IDS_TO_MESSAGE_TRANSMITTER[destinationChainId] as `0x${string}`;

        console.info("********** destinationMessageTransmitter *************", destinationMessageTransmitter);
        console.info("********** destinationChainId *************", destinationChainId);

        const contractConfig = {
          address: destinationMessageTransmitter,
          abi: [
            {
              type: "function",
              name: "receiveMessage",
              stateMutability: "nonpayable",
              inputs: [
                { name: "message", type: "bytes" },
                { name: "attestation", type: "bytes" },
              ],
              outputs: [],
            },
          ] as const,
        };

        const CHAIN_RPC_URL = CHAIN_IDS_TO_RPC_URLS[destinationChainId]
        const CHAIN = CHAINS[destinationChainId]

        const publicClient = createPublicClient({
          chain: CHAINS[destinationChainId],
          transport: custom(window.ethereum),
          //transport: http(CHAIN_IDS_TO_RPC_URLS[destinationChainId]),
        });
        const feeData = await publicClient.estimateFeesPerGas();

        const walletClient = createWalletClient({
          chain: CHAIN,
          transport: custom(window.ethereum),
          //transport: http(CHAIN_IDS_TO_RPC_URLS[destinationChainId]),
          account: destinationAddress as `0x${string}`,
        });

        const gasEstimate = await publicClient.estimateContractGas({
          ...contractConfig,
          functionName: "receiveMessage",
          args: [attestation.message, attestation.attestation],
          account: destinationAddress as `0x${string}`,
        });

        

        /*

        const txRequest = await client.prepareTransactionRequest({
          to: contractConfig.address,
          data: encodeFunctionData({
            ...contractConfig,
            functionName: "receiveMessage",
            args: [attestation.message, attestation.attestation],
          }),
          gas: gasEstimate,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
        const serialized = await client.signTransaction(txRequest);

        const tx = await publicClient.sendRawTransaction({ serializedTransaction: serialized });
        */

      
        /*
        
        const destinationClient = await toMetaMaskSmartAccount({
          address: destinationAddress.toLowerCase() as `0x${string}`,
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [destinationAddress.toLowerCase() as `0x${string}`, [], [], []] as [`0x${string}`, string[], bigint[], bigint[]],
          signatory: { walletClient },
          //deploySalt: toHex(0),
        });


        const calls: any[] = [];
        const call = 
          {
            to: contractConfig.address,
            data: encodeFunctionData({
              ...contractConfig,
              functionName: "receiveMessage",
              args: [attestation.message, attestation.attestation],
            }),
            gas: gasEstimate,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        

        calls.push(call)


        const bundlerClient = createBundlerClient({
          transport: http(BUNDLER_URL),
          paymaster: true,
          chain: chain,
          paymasterContext: {
            mode: 'SPONSORED',
          },
        });

        //const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
        const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n}

        // Send user operation
        const userOpHash = await bundlerClient.sendUserOperation({
          account: destinationClient,
          calls: calls,

          ...fee
        });

        const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

        */



     
     
        const gasWithBuffer = (gasEstimate * 120n) / 100n;
        console.info(`Gas Used: ${formatUnits(gasWithBuffer, 9)} Gwei`);

        console.info("********** send transaction *************")
        const tx = await walletClient.sendTransaction({
          to: contractConfig.address,
          data: encodeFunctionData({
            ...contractConfig,
            functionName: "receiveMessage",
            args: [attestation.message, attestation.attestation],
          }),
          gas: gasWithBuffer,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });
       
      
   
        

        console.info(`Mint Tx: ${tx}`);

        break;
      } catch (err) {
        if (err instanceof TransactionExecutionError && retries < MAX_RETRIES) {
          retries++;
          console.info(`Retry ${retries}/${MAX_RETRIES}...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * retries));
          continue;
        }
        throw err;
      }
    }
  };

  // Function to add Optimism Sepolia network to MetaMask
  const addChainToMetaMask = async (chainId: number) => {
    try {
      // First try to switch to the netwCork (in case it's already added)
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHex(chainId) }] // 11155420 in hex
      });
    } catch (switchError: any) {
      // If the network doesn't exist (error code 4902), add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: toHex(chainId),
              chainName: CHAIN_TO_CHAIN_NAME[chainId],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: [CHAIN_IDS_TO_RPC_URLS[chainId]],
              blockExplorerUrls: [CHAIN_IDS_TO_EXPLORER_URL[chainId]]
            }]
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          setError('Please add network to MetaMask manually');
        }
      } else {
        console.error('Error switching to network:', switchError);
        setError('Please switch to network in MetaMask');
      }
    }
  };

  const circleTransferUSDC = async (
    delegationChain: any,
    indivAccountClient: any,
    sourceAddress: string, 
    sourceChainId: number, 
    destinationAddress: string, 
    destinationChainId: number, 
    amount: bigint) => {

    const sourceChain = CHAINS[sourceChainId];
    const sourcePublicClient = createPublicClient({
      chain: sourceChain,
      transport: http(),
    });

    //const sourceWalletClient = createWalletClient({
    //  chain: sourceChain,
    //  transport: http(),
      //account: sourceAddress as `0x${string}`,
    //  account: add as `0x${string}`,
    //});
    const sourceWalletClient = signatory.walletClient
    //const destinationClient = signatory.walletClient

    const destinationChain = CHAINS[destinationChainId]


    console.info("************ destinationChain *************", destinationChain);
    
    // Add Optimism Sepolia to MetaMask if needed



    //const destinationWalletClient = createWalletClient({
    //  chain: destinationChain,
    //  transport: http(OPTIMISM_SEPOLIA_RPC_URL),
    //  account: destinationAddress as `0x${string}`,
    //});





    console.info("************ sourceAddress: ", sourceAddress);
    console.info("************ sourceChainId: ", sourceChainId);
    console.info("************ destinationAddress: ", destinationAddress);
    console.info("************ destinationChainId: ", destinationChainId);
    console.info("************ amount: ", amount);



    const transferType = "fast";
    let burnTx = await burnUSDC(
      delegationChain,
      indivAccountClient,
      sourceChainId,
      amount,
      destinationChainId,
      destinationAddress,
      transferType,
    );

    // Extract transaction hash from user operation receipt
    const transactionHash = burnTx.receipt.transactionHash;
    console.info("***********  transactionHash ****************", transactionHash);

    console.info("***********  retrieve attestation ****************");
    const attestation = await retrieveAttestation(transactionHash, sourceChainId);

    console.info("***********  mint USDC attestation ****************", attestation);

    await addChainToMetaMask(destinationChain.id);
    
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHex(destinationChain.id) }],
    });

    /*
    const destinationPublicClient = createPublicClient({
      chain: destinationChain,
      transport: http(OPTIMISM_SEPOLIA_RPC_URL),
    });
    const destinationWalletClient = createWalletClient({
      chain: optimismSepolia,
      transport: custom(window.ethereum), // MetaMask injected provider
      account: destinationAddress as `0x${string}`,
    } as any);
    */

    await mintUSDC(destinationAddress, destinationChainId, attestation);

    // flip back to default chain
    console.info("***********  flip back to default chain: ", CHAIN_ID);
    const defaultChainId : number = CHAIN_ID
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHex(sourceChain.id) }],
    });
    console.info("***********  flip back to default chain done");
  }

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

  // Function to get chain name from chain ID
  const getChainName = (chainId: number): string => {
    return CHAIN_TO_CHAIN_NAME[chainId]
  };
    
  // Initialize LiFi SDK
  const wagmiConfig = createWagmiConfig({
    chains: [mainnet, optimism, linea, sepolia, optimismSepolia],
    client({ chain }) {
      console.info("*********** CHAIN ****************", chain);
      return createClient({ chain, transport: http(RPC_URL) })
    },
  })
  createConfig({
    integrator: 'MyOrgWallet',
    rpcUrls: {
      //[ChainId.ETH]: [ETHERUM_RPC_URL],
      [ChainId.OPT]: [OPTIMISM_RPC_URL],
      [ChainId.LNA]: [LINEA_RPC_URL],
    },
    providers: [
      EVM({
        getWalletClient: () => {
          console.info("*********** GET WALLET CLIENT ****************")
          console.info("*********** signatory.walletClient ****************", signatory.walletClient);
          return signatory.walletClient
          
        },
        switchChain: async (chainId: ChainId) => {
          console.info("*********** SWITCH CHAIN ****************: ", chainId);
          const chain = await switchChain(wagmiConfig, { chainId: chainId as any })
          return getWalletClient(wagmiConfig, { chainId: chain.id })
        },
      }),
    ],
    preloadChains: true,
  })
  


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

    // only working with USDC
    if (!chain) return;

    const usdcChainTokenInfo = await getUSDCChainTokenInfo(chain.id)
    const availableTokensList = [
      usdcChainTokenInfo
    ];
    
    setAvailableTokens(availableTokensList);
    if (selectedToken === '') {
      setSelectedToken('USDC');
    }

    /*
    
    setIsLoadingTokens(true);
    try {
      const tokensResponse = await getTokens({ chains: [chain.id as ChainId] });
      const tokens = tokensResponse.tokens[chain.id as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff";
      
      const availableTokensList = [
        { symbol: 'USDC', name: 'USD Coin', address: usdcToken }
      ];
      
      setAvailableTokens(availableTokensList);
      if (selectedToken === '') {
        setSelectedToken('USDC');
      }
    } catch (error) {
      console.error('Error loading available tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
    */
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

      const usdcBalance = await getUSDCBalance(accountAddress, accountChainId)

      setSelectedToken('USDC'); // Set default token

      const usdcChainTokenInfo = await getUSDCChainTokenInfo(chain.id)
      const availableTokensList = [
        usdcChainTokenInfo
      ];
      setAvailableTokens(availableTokensList);
      setSelectedToken('USDC');

      const balances: { USDC: string } = { USDC: usdcBalance };
      setCreditCardBalances(prev => ({
        ...prev,
        [accountDid]: balances
      }));

      /*
      const tokensResponse = await getTokens({ chains: [accountChainId as ChainId] });
      const tokens = tokensResponse.tokens[accountChainId as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      // Find USDC token dynamically from the response
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
      

      const filteredTokens = tokens.filter(item => 
        item.address === nativeToken || item.address === usdcToken
      );
      
      if (filteredTokens.length > 0) {
        const tokenBalances = await getTokenBalances(accountAddress, filteredTokens);
        
        // Update available tokens for the first account (they should be the same across accounts on same chain)
        if (Object.keys(creditCardBalances).length === 0) {
          const tokens = [
            { symbol: 'USDC', name: 'USD Coin', address: usdcToken }
          ];
          setAvailableTokens(tokens);
          setSelectedToken('USDC'); // Set default token
        }
        
        const balances: { USDC: string } = { USDC: '0' };
        
        // USDC balance
        const usdcBalance = tokenBalances.find(balance => balance.address === usdcToken);
        if (usdcBalance && usdcBalance.amount) {
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          balances.USDC = dollars.toFixed(2);
        } else {
          balances.USDC = '0';
        }

        console.info("*********** balances ****************", balances);
        
        setCreditCardBalances(prev => ({
          ...prev,
          [accountDid]: balances
        }));
      }
      */
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

      const usdcBalance = await getUSDCBalance(accountAddress, accountChainId)
      console.info("***********  usdcBalance ****************", usdcBalance);

      setSelectedToken('USDC'); // Set default token

      const usdcChainTokenInfo = await getUSDCChainTokenInfo(chain.id)
      const availableTokensList = [
        usdcChainTokenInfo
      ];
      setAvailableTokens(availableTokensList);
      setSelectedToken('USDC');

      const balances: { USDC: string } = { USDC: usdcBalance };
      setSavingsAccountBalances(prev => ({
        ...prev,
        [accountDid]: balances
      }));




      /*
      const tokensResponse = await getTokens({ chains: [accountChainId as ChainId] });
      const tokens = tokensResponse.tokens[accountChainId as ChainId] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      // Find USDC token dynamically from the response
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
      
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
      */
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
      
      
      // For now, we'll get routes from the first selected savings account
      const firstSavingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);

      // test sending from Op EOA account
      //const firstSavingsAccount =  {
      //  accountName: "Op Saving Account",
      //  did: "did:pkh:eip155:10:0x9cfc7E44757529769A28747F86425C682fE64653"
      //}

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

      console.info("***********  fromTokenAddress ****************", fromTokenAddress);
      
      const toTokenAddress = selectedToken === 'ETH' 
        ? '0x0000000000000000000000000000000000000000' 
        : await getTokenAddressForChain(creditCardExtracted.chainId, 'USDC');

      console.info("***********  toTokenAddress ****************", toTokenAddress);
      
      const amount = (parseFloat(fundingAmount) * 1e6).toString();

      // use LiFi to move funds from savings account to credit card
      const walletAddress = signatory.walletClient.account.address;

      console.log('Getting routes with params:', {
        fromChainId: savingsAccountExtracted.chainId,
        toChainId: creditCardExtracted.chainId,
        fromTokenAddress,
        toTokenAddress,
        fromAmount: amount,
        fromAddress: savingsAccountExtracted.address,
        //fromAddress: walletAddress,
        toAddress: creditCardExtracted.address,
      });
      
      

      const routes = await getRoutes({
        fromChainId: savingsAccountExtracted.chainId,
        toChainId: creditCardExtracted.chainId,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress: toTokenAddress,
        fromAmount: amount,
        fromAddress: savingsAccountExtracted.address,
        //fromAddress: walletAddress,
        toAddress: creditCardExtracted.address,
      });

      
      console.log('Routes received:', routes);

      
      setAvailableRoutes(routes.routes);
      if (routes.routes.length > 0) {
        setSelectedRoute(routes.routes[0]);
        console.log('Selected route:', routes.routes[0]);
      } else {
        setSelectedRoute(null);
        console.error('No routes available, so handle it without LiFi');
      }

      
      
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
      

      const firstSavingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);
      if (!firstSavingsAccount) {
        console.error('First savings account not found');
        setError('Selected savings account not found');
        return;
      }
      
      const savingsAccountExtracted = extractFromAccountDid(firstSavingsAccount.did);
      if (!savingsAccountExtracted) {
        setError('Error');
        return;
      }

      if (CIRCLE_SUPPORTED_CHAINS[savingsAccountExtracted?.chainId]) {
        // nothing needed here
      }
      else {
        // Get routes when moving to confirmation step
        await getTransferRoutes();
      }
      
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

    // transfer USDC from savings account to credit card

    setIsLoading(true);
    setError(null);

    if (selectedToken != 'USDC') {
      setError('Only USDC is supported for this transfer');
      setIsLoading(false);
      return;
    }

    if (!selectedCreditCard) {
      setError('No credit card selected');
      setIsLoading(false);
      return;
    }

    if (!indivAccountClient) {
      setError('No individual or organization account client found');
      setIsLoading(false);
      return;
    }

    try {

      const savingsAccount = savingsAccounts.find(acc => acc.id === selectedSavingsAccounts[0]);
      if (!savingsAccount) {
        setError('Error');
        return;
      }

      const savingsAccountExtracted = extractFromAccountDid(savingsAccount?.did);
      const creditCardExtracted = extractFromAccountDid(selectedCreditCard.accountDid);

      if (!savingsAccountExtracted || !creditCardExtracted) {
        setError('Error');
        return;
      }

      // check if source and destination are test chains.  If so use circle to transfer
      const sourceChain = savingsAccountExtracted?.chainId ? CHAINS[savingsAccountExtracted.chainId] : undefined;
      const destinationChain = creditCardExtracted?.chainId ? CHAINS[creditCardExtracted.chainId] : undefined;

      
      const accountIndivDelegationStr = savingsAccount?.attestation?.indivDelegation;
      const accountOrgDelegationStr = savingsAccount?.attestation?.orgDelegation;

      if (!accountOrgDelegationStr || !accountIndivDelegationStr) {
        throw new Error('No delegations found');
      }

      const accountIndivDelegation = JSON.parse(accountIndivDelegationStr) 
      const accountOrgDelegation = JSON.parse(accountOrgDelegationStr) 


      if (selectedRoute) {
        // LiFi Transfer

        // execute using cross chain USDC transfer
        console.info("***********  EXECUTE CROSS-CHAIN USDC TRANSFER ****************");

        const accountIndivDelegationStr = savingsAccount?.attestation?.indivDelegation;
        const accountOrgDelegationStr = savingsAccount?.attestation?.orgDelegation;

        const accountIndivDelegation = JSON.parse(accountIndivDelegationStr || '{}') 
        const accountOrgDelegation = JSON.parse(accountOrgDelegationStr || '{}') 

        // Setup bundler and paymaster clients
        const bundlerClient = createBundlerClient({
          transport: http(BUNDLER_URL),
          paymaster: true,
          chain: chain,
          paymasterContext: {
            mode: 'SPONSORED',
          },
        });

        const calls = []
        for (const step of selectedRoute.steps) {

          const tx = await getStepTransaction(step);
          const txRequest = tx.transactionRequest;

          if (!txRequest) {
            throw new Error('No transaction data in route');
          }

          const liftAddress = txRequest?.to as `0x${string}`
          const approvalAmount = BigInt((parseFloat(fundingAmount) * 1e6).toString());
          const usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[savingsAccountExtracted.chainId] as `0x${string}`

          const approvalExecution = {
            target: usdcAddress,
            callData: encodeFunctionData({
              abi: parseAbi(["function approve(address,uint)"]),
              functionName: "approve",
              args: [liftAddress, approvalAmount],
            }),
            value: 0n, // since it's an ERC-20 approval, you don't need to send ETH
          };

          const data0 = DelegationFramework.encode.redeemDelegations({
            delegations: [[accountIndivDelegation, accountOrgDelegation]],
            modes: [SINGLE_DEFAULT_MODE],
            executions: [[approvalExecution]]
          });

          const call0 = {
            to: indivAccountClient.address,
            data: data0,
          }

          calls.push(call0)


         
          const includedExecutions = [
            {
              target: txRequest.to as `0x${string}`,
              value: BigInt(txRequest.value || '0'),
              callData: txRequest.data as `0x${string}`,
            },
          ];

          // Encode the delegation execution
          const data = DelegationFramework.encode.redeemDelegations({
            delegations: [[accountIndivDelegation, accountOrgDelegation]],
            modes: [SINGLE_DEFAULT_MODE],
            executions: [includedExecutions]
          });

          const call = {
            to: indivAccountClient.address,
            data: data,
          }

          calls.push(call)

        }


        const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n}

        // Send user operation
        const userOpHash = await bundlerClient.sendUserOperation({
          account: indivAccountClient,
          calls: calls,
          ...fee
        });

        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

        // Refresh balances after transfer
        await fetchCreditCardBalances(selectedCreditCard.accountDid);
        for (const accountId of selectedSavingsAccounts) {
          const account = savingsAccounts.find(acc => acc.id === accountId);
          if (account) {
            await fetchSavingsAccountBalances(account.did);
          }
        }

        handleClose();
          
      }
      else if (CIRCLE_SUPPORTED_CHAINS[creditCardExtracted?.chainId]) {
        // Circle Transfer

        console.info("***********  EXECUTE CIRCLE TRANSFER ****************");
        // use circle to move funds from savings account to credit card

        if (indivAccountClient && burnerAccountClient) {

          const owner = signatory.walletClient.account.address
          const addressType = "account-" + savingsAccount.did
          const accountBurnerDel = await DelegationService.getDelegationFromStorage(addressType, owner, indivAccountClient.address, burnerAccountClient.address)
          if (accountBurnerDel && indivDid) {

            const fundingAmountBigInt = BigInt((parseFloat(fundingAmount) * 1e6).toString());
            //const delegationChain = [accountBurnerDel, accountIndivDelegation, accountOrgDelegation]
            const delegationChain = [accountIndivDelegation, accountOrgDelegation]
            console.info("************* delegationChain: ", delegationChain)
            console.info("************* accountAccountClient address: ", burnerAccountClient.address)
            await circleTransferUSDC(
              delegationChain,
              indivAccountClient,
              //burnerAccountClient,
              savingsAccountExtracted?.address as `0x${string}`, 
              savingsAccountExtracted?.chainId as number, 
              creditCardExtracted?.address as `0x${string}`, 
              creditCardExtracted?.chainId as number, 
              fundingAmountBigInt);

            // Refresh balances after transfer
            await fetchCreditCardBalances(selectedCreditCard.accountDid);
            for (const accountId of selectedSavingsAccounts) {
              const account = savingsAccounts.find(acc => acc.id === accountId);
              if (account) {
                await fetchSavingsAccountBalances(account.did);
              }
            }

            handleClose();
          }
        }
      }
      else {

        // execute using direct transfer of USDC
        console.info("***********  EXECUTE DIRECT TRANSFER ****************");


        const bundlerClient = createBundlerClient({
          transport: http(BUNDLER_URL || ''),
          paymaster: true,
          chain: chain,
          paymasterContext: {
            mode: 'SPONSORED',
          },
        });

        const calls = []


        // USDC
        // use direct transfer
        const decimals = 6
        const value = parseUnits(fundingAmount, decimals);
        const usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[savingsAccountExtracted.chainId] as `0x${string}`

        //const value = BigInt(amount)
        const to = creditCardExtracted?.address as `0x${string}`
        const callData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [to, value],
        });


        const includedExecutions = [
          {
            target: usdcAddress,
            value: 0n,
            callData: callData
          },
        ];

        // Encode the delegation execution
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [[accountIndivDelegation, accountOrgDelegation]],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [includedExecutions]
        });


        const call = {
          to: indivAccountClient.address,
          data: data,
        }

        calls.push(call)
        


        //const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
        const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n}
        // Send user operation

        const userOpHash = await bundlerClient.sendUserOperation({
          account: indivAccountClient,
          calls: calls,
          ...fee
        });

        const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        
        // Refresh balances after transfer
        await fetchCreditCardBalances(selectedCreditCard.accountDid);
        for (const accountId of selectedSavingsAccounts) {
          const account = savingsAccounts.find(acc => acc.id === accountId);
          if (account) {
            await fetchSavingsAccountBalances(account.did);
          }
        }

        handleClose();
      } 
    }
    catch (error) {
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
                              {(() => {
                                const extracted = extractFromAccountDid(account.accountDid);
                                return extracted && (
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }} component="div">
                                      <Chip 
                                        label={getChainName(extracted.chainId)}
                                        size="small"
                                        color="primary"
                                        variant="filled"
                                        sx={{ mr: 1, fontWeight: 'bold' }}
                                      />
                                      Chain ID: {extracted.chainId} | Address: {extracted.address}
                                    </Typography>
                                  </Box>
                                );
                              })()}
                              {isLoadingBalances ? (
                                <CircularProgress size={12} />
                              ) : (
                                <Box display="flex" gap={1} mt={0.5}>
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
                              <Chip 
                                label={getChainName(extracted.chainId)}
                                size="small"
                                color="primary"
                                variant="filled"
                                sx={{ mr: 1, fontWeight: 'bold' }}
                              />
                              Chain ID: {extracted.chainId} | Address: {extracted.address}
                            </Typography>
                          </Box>
                        )}
                        {balances && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip 
                              label={`${balances.USDC} USDC`}
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
                No savings accounts found. Please add accounts first.
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
                  const availableAmount = balances?.USDC || '0' 

                  
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
          <Box display="flex" flexDirection="column" height="100%">
            <Typography variant="h6" gutterBottom>
              Confirm Transfer
            </Typography>
            
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {/* Transfer Amount - Made smaller */}
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  textAlign: 'center',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.50'
                }}
              >
                <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Transfer Amount
                </Typography>
                <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                  {fundingAmount} {selectedToken}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  From savings accounts to credit card
                </Typography>
              </Paper>
              
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
                          <Chip 
                            label={getChainName(extracted.chainId)}
                            size="small"
                            color="primary"
                            variant="filled"
                            sx={{ mr: 1, fontWeight: 'bold' }}
                          />
                          Chain ID: {extracted.chainId} | Address: {extracted.address}
                        </Typography>
                      )}
                      {balances && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Chip 
                            label={`${balances.USDC} USDC`}
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
                        <Chip 
                          label={getChainName(extracted.chainId)}
                          size="small"
                          color="primary"
                          variant="filled"
                          sx={{ mr: 1, fontWeight: 'bold' }}
                        />
                        Chain ID: {extracted.chainId} | Address: {extracted.address}
                      </Typography>
                    );
                  })()}
                  {selectedCreditCard?.accountDid && creditCardBalances[selectedCreditCard.accountDid] && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
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
            
            {/* Action buttons - moved up and always visible */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
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
            style={{ maxHeight: "90vh", minWidth: "43em" }}
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

            <div className="flex flex-col p-4" style={{ height: "calc(90vh - 70px)" }}>
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