import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers, AbiCoder } from 'ethers';
import type { MetaMaskEthereumProvider } from '@metamask/detect-provider';

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
import { AccountAttestation, OrgAccountAttestation } from '../models/Attestation';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService';

declare global {
  interface Window {
    ethereum?: MetaMaskEthereumProvider;
  }
}

interface AddCreditCardModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface MetaMaskAccount {
  address: string;
  balance: string;
  name: string;
}

const AddCreditCardModal: React.FC<AddCreditCardModalProps> = ({ isVisible, onClose }) => {
  const [accounts, setAccounts] = useState<MetaMaskAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<MetaMaskAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [coaCategory, setCoaCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL_PROVER = import.meta.env.VITE_PROVER_API_URL  || 'http://localhost:3051';

  const { chain,veramoAgent, mascaApi, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid, signatory, indivDid, indivName, indivAccountClient } = useWallectConnectContext();

  const { isConnected } = useAccount();


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

    console.info("handleSave ....")

    const accountData = {
      accountName: accountName,
      accountAddress: selectedAccount.address,
      accountBalance: selectedAccount.balance
    }

    const accountDid = "did:pkh:eip155" + chain?.id + ":" + selectedAccount.address



    /*
    console.info("-----------> store account data")
    const storeResp = await fetch(`${BASE_URL_PROVER}/api/account/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: accountName,
            address: selectedAccount.address
        }),
    })

    console.info("storeResp: ", storeResp)

    const storeResults = await storeResp.json()
    const js = JSON.parse(storeResults)

    console.info("storeResults: ", js)
    const cid = js.cid

    console.info("cid result: ", cid)
    */


    console.info("*********** ADD ACCOUNT ATTESTATION ****************")
    const provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const walletSigner = await provider.getSigner()

    const walletClient = signatory.walletClient
    let entityId = "account"

    console.info("********** accountDid: ", accountDid  )
    console.info("********** accountName: ", accountName  )
    console.info("********** coaCode: ", coaCode  )
    console.info("********** coaCategory: ", coaCategory)

    if (walletSigner && walletClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

        const vc = await VerifiableCredentialsService.createAccountVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, coaCode, coaCategory);
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof

        if (fullVc && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {
        
          const delegationJsonStr = ""

          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: AccountAttestation = {
              name: accountName,
              coaCode: coaCode,
              coaCategory: coaCategory,
              attester: orgDid,
              class: "organization",
              category: "wallet",
              entityId: entityId,
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              proof: proof
          };

          const uid = await AttestationService.addAccountAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
        }
    }




    console.info("*********** ADD ORG ACCOUNT ATTESTATION ****************")
    entityId = "org-account"

    if (walletSigner && walletClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

        const delegationJsonStr = ""

        const vc = await VerifiableCredentialsService.createOrgAccountVC(entityId, privateIssuerDid, accountDid, orgDid, accountName, delegationJsonStr);
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof

        console.info("********** fullVc: ", fullVc)
        console.info("********** chain: ", chain)
        console.info("********** indivAccountClient: ", indivAccountClient)
        console.info("********** burnerAccountClient: ", burnerAccountClient)
        console.info("********** orgIssuerDelegation: ", orgIssuerDelegation)
        console.info("********** orgIndivDelegation: ", orgIndivDelegation)
        console.info("********** orgAccountClient: ", orgAccountClient)
        if (fullVc && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {

          // now create attestation
          console.info("********** add org account attestation ****************")
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: OrgAccountAttestation = {
              name: accountName,
              accountDid: accountDid,
              delegation: delegationJsonStr,
              attester: orgDid,
              class: "organization",
              category: "wallet",
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
                <h1 className="modal-title text-lg font-semibold">{('Add Credit Card')}</h1>
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

export default AddCreditCardModal;
 