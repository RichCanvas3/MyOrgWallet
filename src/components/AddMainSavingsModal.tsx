import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers, AbiCoder } from 'ethers';
import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage, signatureToCompactSignature  } from "viem";



//import { IPFSStorage } from '../service/IPFSStorage'

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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { AccountOrgDelAttestation, OrgAccountAttestation } from '../models/Attestation';

import { RPC_URL, } from "../config";


import VerifiableCredentialsService from '../service/VerifiableCredentialsService';

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


interface AddMainSavingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface MetaMaskAccount {
  address: string;
  balance: string;
  name: string;
}

const AddMainSavingsModal: React.FC<AddMainSavingsModalProps> = ({ isVisible, onClose }) => {
  const [accounts, setAccounts] = useState<MetaMaskAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<MetaMaskAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [coaCategory, setCoaCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL_PROVER = import.meta.env.VITE_PROVER_API_URL  || 'http://localhost:3051';

  const { chain, veramoAgent, mascaApi, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid, signatory, indivDid, indivName, indivAccountClient } = useWallectConnectContext();

  const { isConnected } = useAccount();



  const findValidOrgAccount = async(owner: any, signatory: any, publicClient: any) : Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> => {
    const startSeed = 50000
    const tryCount = 30

    for (let i = 0; i < tryCount; i++) {

      // build account AA for EOA Connected Wallet
      const accountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        signatory: signatory,
        deploySalt: toHex(startSeed),
      });

      const address = await accountClient.getAddress()
      return accountClient
    }
    return undefined
  }



  useEffect(() => {
    const getAccounts = async () => {
      if (isVisible && window.ethereum) {
        try {
          // Request account access
          const addresses = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
          }) as string[];

          // Get balance for each account
          const accountsWithDetails = await Promise.all(
            addresses.map(async (address, index) => {
              const balance = await window.ethereum!.request({
                method: 'eth_getBalance',
                params: [address, 'latest']
              }) as string;
              
              return {
                address,
                name: `Account ${index + 1}`,
                balance: (parseInt(balance, 16) / 1e18).toFixed(4)
              };
            })
          );

          setAccounts(accountsWithDetails);
        } catch (error) {
          console.error('Error fetching accounts:', error);
          setError('Failed to fetch accounts from MetaMask');
        }
      }
    };

    getAccounts();
  }, [isVisible]);

  const handleAccountSelect = (account: MetaMaskAccount) => {
    setSelectedAccount(account);
    setAccountName(account.name); // Set initial name to MetaMask account name
  };

  const handleBack = () => {
    setSelectedAccount(null);
    setAccountName('');
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedAccount || !accountName || !coaCode || !coaCategory) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);



    const eoaAccountDid = "did:pkh:eip155:" + chain?.id + ":" + selectedAccount.address.toLowerCase()


    console.info("*********** ADD ORG ACCOUNT ATTESTATION ****************")
    const provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const walletSigner = await provider.getSigner()

    const walletClient = signatory.walletClient
    let entityId = "account(org)"

    const publicClient = createPublicClient({
      chain: chain,
      transport: http(RPC_URL),
    });

    const accountClient = await findValidOrgAccount(selectedAccount.address, signatory, publicClient)
    let isDeployed = await accountClient?.isDeployed()
    console.info("is indivAccountClient deployed: ", isDeployed)
 
    if (isDeployed == false) {
      // deploy account AA

      const pimlicoClient = createPimlicoClient({
        transport: http(BUNDLER_URL),
      });

      //const paymasterClient = createPaymasterClient({
      //  transport: http(PAYMASTER_URL),
      //});

      console.info("create bundler client ", BUNDLER_URL, PAYMASTER_URL)
      const bundlerClient = createBundlerClient({
                      transport: http(BUNDLER_URL),
                      paymaster: true,
                      chain: chain,
                      paymasterContext: {
                        mode:             'SPONSORED',
                      },
                    });

      console.info("get gas price") 
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();


      try {
        console.info("send user operation with bundlerClient 2: ", bundlerClient)

        console.info("fee: ", fee)
        const fee2 = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n}
        console.info("fee2: ", fee2)  


        const userOperationHash = await bundlerClient!.sendUserOperation({
          account: accountClient,
          calls: [
            {
              to: zeroAddress,
            },
          ],
          ...fee2,
        });

        console.info(" account is deployed - done")
        const { receipt } = await bundlerClient!.waitForUserOperationReceipt({
          hash: userOperationHash,
        });
      }
      catch (error) { 
        console.info("error deploying accountClient: ", error)
      }
    }




    const accountDid = "did:pkh:eip155:" + chain?.id + ":" + accountClient?.address.toLowerCase()

    if (walletSigner && walletClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

      const vc = await VerifiableCredentialsService.createOrgAccountVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, coaCode, coaCategory);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof

      

      if (fullVc && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {
      
        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: OrgAccountAttestation = {
            accountName: accountName,
            accountDid: accountDid,
            coaCode: coaCode,
            coaCategory: coaCategory,
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

        const uid = await AttestationService.addOrgAccountAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
      }
    }

    console.info("*********** ADD ORG ACCOUNT DELEGATION ATTESTATION ****************")
    entityId = "account-org(org)"

    if (walletSigner && walletClient && accountClient &&  orgAccountClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

      // setup delegation between them
      let accountOrgDel = createDelegation({
        to: orgAccountClient.address,
        from: accountClient.address,
        caveats: [] }
      );

      const signature = await accountClient.signDelegation({
        delegation: accountOrgDel,
      });

      accountOrgDel = {
        ...accountOrgDel,
        signature,
      }

      const delegationJsonStr = JSON.stringify(accountOrgDel)



      //  test out delegation

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
      const creditCardAddress = "0x9d09782B42A1886639D585Ee03d39A90E011c5EC"
      const executions = [
        {
          target: creditCardAddress,
          value: 10n,
          callData: '0x' as `0x${string}`,
        },
      ];

      console.info("@@@@@@@@@@@@@ creditCardAddress: ", creditCardAddress) 


      const delegationChain = [accountOrgDel];
      console.info("@@@@@@@@@@@@@ delegationChain: ", delegationChain)
      const data = DelegationFramework.encode.redeemDelegations({
        delegations: [delegationChain],
        modes: [SINGLE_DEFAULT_MODE],
        executions: [executions]
      });

      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
      
      console.info("@@@@@@@@@@@@@ orgAccountClient: ", orgAccountClient.address) 
      if (orgAccountClient) {
        const userOpHash = await bundlerClient.sendUserOperation({
          account: orgAccountClient,
          calls: [
            {
              to: orgAccountClient.address,
              data,
            },
          ],
          ...fee
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHash,
        });


      }





















      const vc = await VerifiableCredentialsService.createAccountOrgDelVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, coaCode, coaCategory, delegationJsonStr);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof


      if (fullVc && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {

        // now create attestation
        console.info("********** add org account delegation attestation ****************")
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


    setSelectedAccount(null);
    setAccountName('');
    setError(null);
    onClose();

  }

  const handleClose = () => {
    setSelectedAccount(null);
    setAccountName('');
    setError(null);
    onClose();
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
            {}
            <div className="flex justify-between items-center border-b border-gray-200 p-4">
              <div className="flex items-center gap-2">
                {selectedAccount && (
                  <button
                    onClick={handleBack}
                    className="text-gray-700 hover:text-gray-900"
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                  </button>
                )}
                <h1 className="text-lg font-semibold">
                  {selectedAccount ? 'Savings Account' : 'Add Savings Account'}
                </h1>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-700 hover:text-gray-900"
              >
                <XMarkIcon className="h-8 w-8" aria-hidden="true" />
              </button>
            </div>

            {}
            <div className="flex flex-col p-4" style={{ height: "calc(80vh - 70px)" }}>
              {!isConnected ? (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={4}>
                  <Typography variant="h6">Connect your MetaMask wallet</Typography>

                </Box>
              ) : selectedAccount ? (
                // Account naming step
                <Box display="flex" flexDirection="column" gap={3} p={2}>
                  <Typography variant="subtitle1" color="text.secondary">
                    Selected Account: {selectedAccount.address.slice(0, 6)}...{selectedAccount.address.slice(-4)}
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Credit Card Account Name"
                    variant="outlined"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter a name for this credit card account"
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

                  <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={!accountName || !coaCode || !coaCategory || isLoading}
                    >
                      {isLoading ? <CircularProgress size={24} /> : 'Save'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                // Account selection step
                <Box display="flex" flexDirection="column" height="100%">
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search accounts..."
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
                  
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      flex: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <List sx={{ 
                      flex: 1,
                      overflow: 'auto',
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                        '&:hover': {
                          background: '#666',
                        },
                      },
                    }}>
                      {accounts
                        .filter(account =>
                          account.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          account.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((account) => (
                          <ListItem key={account.address} disablePadding>
                            <ListItemButton onClick={() => handleAccountSelect(account)}>
                              <ListItemIcon>
                                <AccountBalanceWalletIcon />
                              </ListItemIcon>
                              <ListItemText
                                primary={account.name}
                                secondary={
                                  <React.Fragment>
                                    <Typography component="span" variant="body2" color="text.secondary">
                                      {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                                    </Typography>
                                    <br />
                                    <Typography component="span" variant="body2" color="text.secondary">
                                      Balance: {account.balance} ETH
                                    </Typography>
                                  </React.Fragment>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                    </List>
                  </Paper>
                  
                  {accounts.length === 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', mt: 2 }}
                    >
                      No accounts found
                    </Typography>
                  )}
                </Box>
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default AddMainSavingsModal;
 