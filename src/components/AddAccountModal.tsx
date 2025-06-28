import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers, AbiCoder } from 'ethers';
import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage, signatureToCompactSignature  } from "viem";

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
  Autocomplete,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Transition } from '@headlessui/react';
import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { AccountOrgDelAttestation, OrgAccountAttestation } from '../models/Attestation';
import { COA_OPTIONS } from '../constants/chartOfAccounts';

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

import InfoIcon from '@mui/icons-material/Info';

interface AddSavingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const AddSavingsModal: React.FC<AddSavingsModalProps> = ({ isVisible, onClose }) => {
  const [accountName, setAccountName] = useState('');
  const [coaCode, setCoaCode] = useState('');
  const [coaCategory, setCoaCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug logging for COA_OPTIONS
  console.log('COA_OPTIONS loaded:', COA_OPTIONS.length, 'options');
  console.log('First few COA_OPTIONS:', COA_OPTIONS.slice(0, 3));

  const BASE_URL_PROVER = import.meta.env.VITE_PROVER_API_URL  || 'http://localhost:3051';

  const { chain, veramoAgent, mascaApi, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid, signatory, indivDid, indivName, indivAccountClient } = useWallectConnectContext();

  const { isConnected, address } = useAccount();

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
        deploySalt: toHex(startSeed+i),
      });
      return accountClient

      // check if account already exists
      const isDeployed = await accountClient.isDeployed()
      if (isDeployed == false) {
        return accountClient
      }

    }
    return undefined
  }

  const handleSave = async () => {
    if (!address || !accountName || !coaCode || !coaCategory) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);

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

    const accountClient = await findValidOrgAccount(address, signatory, publicClient)
    let isDeployed = await accountClient?.isDeployed()
    console.info("is indivAccountClient deployed: ", isDeployed)

    if (isDeployed == false) {
      // deploy account AA

      const pimlicoClient = createPimlicoClient({
        transport: http(BUNDLER_URL),
      });

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



    if (walletSigner && walletClient && accountClient &&  orgAccountClient && privateIssuerAccount && orgDid && mascaApi && privateIssuerDid) {

      console.info("*********** ADD ORG ACCOUNT DELEGATION ATTESTATION ****************")
      entityId = "account-org(org)"

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

    setAccountName('');
    setCoaCode('');
    setCoaCategory('');
    setError(null);
    onClose();
  }

  const handleClose = () => {
    setAccountName('');
    setCoaCode('');
    setCoaCategory('');
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

            <div className="flex flex-col p-4" style={{ height: "calc(80vh - 70px)" }}>
              {!isConnected ? (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={4}>
                  <Typography variant="h6">Connect your MetaMask wallet</Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={3} p={2}>
                  <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
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
                        if (e.key === 'Enter' && accountName && coaCode && coaCategory && !isLoading) {
                          handleSave();
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
                        if (e.key === 'Enter' && accountName && coaCode && coaCategory && !isLoading) {
                          handleSave();
                        }
                      }}
                    />
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <Autocomplete
                      fullWidth
                      options={COA_OPTIONS}
                      getOptionLabel={(option) => option.displayName}
                      value={COA_OPTIONS.find(option => option.displayName === coaCategory) || null}
                      onChange={(event, newValue) => {
                        setCoaCategory(newValue ? newValue.displayName : '');
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="CoA Category" 
                          placeholder="Search or select a category..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && accountName && coaCode && coaCategory && !isLoading) {
                              handleSave();
                            }
                          }}
                        />
                      )}
                      isOptionEqualToValue={(option, value) => option.displayName === value.displayName}
                      clearOnBlur
                      selectOnFocus
                      handleHomeEndKeys
                      sx={{ minHeight: '56px' }}
                    />
                  </Box>

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
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default AddSavingsModal;
 