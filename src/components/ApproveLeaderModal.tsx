import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';


import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient, useAccount } from 'wagmi';

import { IndivAttestation, AccountIndivDelAttestation } from "../models/Attestation"
import { Account } from "../models/Account";

import {AttestationCard } from "./AttestationCard"


import { 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Paper,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Tab, 
  Tabs as MuiTabs,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stepper,
  Step,
  StepLabel } from "@mui/material";
import EditableTextBox from "./EditableTextBox";
import { TripOriginRounded } from '@mui/icons-material';


import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  createDelegation,
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
import { http } from "viem";

import { BUNDLER_URL, PAYMASTER_URL } from "../config";


import { OrgIndivAttestation } from "../models/Attestation"

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"


interface ApproveLeaderModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const steps = ['Select Leader', 'Select Accounts', 'Confirm'];

const ApproveLeaderModal: React.FC<ApproveLeaderModalProps> = ({isVisible, onClose}) => {

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, veramoAgent, mascaApi, signatory, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, privateIssuerAccount, burnerAccountClient } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  const [attestations, setAttestations] = useState<IndivAttestation[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedAttestation, setSelectedAttestation] = useState<IndivAttestation | null>(null);

  const handleClose = () => {
    setActiveStep(0);
    setSelectedAttestation(null);
    setSelectedAccounts([]);
    onClose();
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccounts(prev => {
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

  const handleAttestationSelect = (att: IndivAttestation) => {
    setSelectedAttestation(att);
    handleNext();
  };

  const handleConfirm = async () => {
    if (!selectedAttestation) return;
    await processSelectedAttestation(selectedAttestation);
    handleClose();
  };

  const processSelectedAttestation = async (att: IndivAttestation) => {
    // if this user has been granted permissions through orgIndivDelegation
    console.info("need these values: ", orgIndivDelegation, orgDid, privateIssuerDid, walletClient)
    if (orgIndivDelegation && chain && orgDid && privateIssuerDid && walletClient && orgAccountClient && privateIssuerAccount) {

      console.info("************************   CREATE DELEGATION FOR: ", att.name)
      const leaderIndivAddress = att.attester.replace('did:pkh:eip155:' + chain?.id + ':', '') as `0x${string}`
      const leaderIndivDid = att.attester

      console.info("Selected Person to add: ", att.name)
      console.info("to: ", leaderIndivAddress)
      console.info("from: ", orgAccountClient.address)



      let leaderOrgIndivDel = createDelegation({
        to: leaderIndivAddress,
        from: orgAccountClient.address,
        caveats: [] }
      );

      const signature = await orgAccountClient.signDelegation({
        delegation: leaderOrgIndivDel,
      });

      leaderOrgIndivDel = {
        ...leaderOrgIndivDel,
        signature,
      }

      const delegationJsonStr = JSON.stringify(leaderOrgIndivDel)

      const vc = await VerifiableCredentialsService.createOrgIndivVC("org-indiv", orgDid, leaderIndivDid, delegationJsonStr, att.name, privateIssuerDid);
      const result = await VerifiableCredentialsService.createCredential(vc, "org-indiv", orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)

      console.info("result of create credential: ", result)
      const fullVc = result.vc
      const proof = result.proof

      if (proof && fullVc && chain && orgIssuerDelegation && orgIndivDelegation && burnerAccountClient) {

        console.info("&&&&&&&&&&&&&&&&&&&&&&& AttestationService add indiv attestation")

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: OrgIndivAttestation = {
          indivDid: leaderIndivDid,
          name: att.name,
          delegation: delegationJsonStr,
          attester: orgDid,
          class: "organization",
          category: "leaders",
          entityId: "org-indiv(org)",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          proof: proof
        };

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()
        
        const uid = await AttestationService.addOrgIndivAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)

        /*
        // add account to indiv
        for (const accountId of selectedAccounts) {

          const account = savingsAccounts.find(acc => acc.id === accountId);
          if (!account) continue;


          const parentDelegationHash = getDelegationHashOffchain(JSON.parse(account.attestation?.delegation || ""));
          let indivDel = createDelegation({
            to: leaderIndivAddress,
            from: orgAccountClient.address,
            parentDelegation: parentDelegationHash,
            caveats: []
          });


          const indivDelSignature = await orgAccountClient.signDelegation({
            delegation: indivDel,
          });

          indivDel = {
            ...indivDel,
            signature: indivDelSignature,
          }


          const indivDelegationJsonStr = JSON.stringify(indivDel)

          const entityId = "account-indiv(org)"
          const vc = await VerifiableCredentialsService.createAccountIndivDelVC(
            entityId, 
            privateIssuerDid, 
            account.did || "", 
            leaderIndivDid,
            account.attestation?.accountName || "", 
            account.attestation?.coaCode || "",
            account.attestation?.coaCategory || "",
            account.attestation?.delegation || "",
            indivDelegationJsonStr
          )           

          const result = await VerifiableCredentialsService.createCredential(vc, entityId, account.did, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
          const fullVc = result.vc
          const proof = result.proof


          if (fullVc && indivDid && chain && indivAccountClient && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {

            // now create attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: AccountIndivDelAttestation = {
                indivDid: leaderIndivDid,
                accountName: account.attestation?.accountName || "",
                accountDid: account.did,
                coaCode: account.attestation?.coaCode || "",
                coaCategory: account.attestation?.coaCategory || "",
                orgDelegation: account.attestation?.delegation || "",
                indivDelegation: indivDelegationJsonStr,
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

            const uid = await AttestationService.addAccountIndivDelAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)




          }












          // see if we can move funds based on delegation

          const orgDel = JSON.parse(account.attestation?.delegation);


          console.info("@@@@@@@@@@@@@ orgDel: ", orgDel)  


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


          const delegationChain = [orgDel];
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
        }
        */
      }
    
    }
    else {
      console.info(">>>>>>>>>>  YOU DO NOT HAVE PERMISSIONS TO ADD FOLKS >>>>>>>>>>")
    }
  }

  useEffect(() => {
    if (orgDid && chain) {
      AttestationService.loadOrgAccounts(chain, orgDid, "1150").then((accounts) => {
        setSavingsAccounts(accounts);
      });

      AttestationService.getIndivsNotApprovedAttestations(chain, orgDid).then((atts) => {
        if (atts) {
          setAttestations(atts)
        }
      })
    }
  }, [orgDid]);

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <Typography variant="h6" gutterBottom>
              Select Leader to Approve
            </Typography>
            <Grid container spacing={2}>
              {attestations.map(att => (
                <Grid key={att.entityId}>
                  <AttestationCard
                    attestation={att}
                    selected={selectedAttestation?.entityId === att.entityId}
                    onSelect={() => handleAttestationSelect(att)}
                    hoverable
                  />
                </Grid>
              ))}
            </Grid>
          </>
        );
      case 1:
        return (
          <>
            <Typography variant="h6" gutterBottom>
              Select Savings Accounts for {selectedAttestation?.name}
            </Typography>
            <FormGroup>
              {savingsAccounts.map(account => (
                <FormControlLabel
                  key={account.id}
                  control={
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => handleAccountSelect(account.id)}
                    />
                  }
                  label={`${account.name} (${account.code})`}
                />
              ))}
            </FormGroup>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                disabled={selectedAccounts.length === 0}
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
              Confirm Approval
            </Typography>
            <Typography variant="body1" paragraph>
              You are about to approve {selectedAttestation?.name} as a leader for the following accounts:
            </Typography>
            <Box sx={{ ml: 2, mb: 2 }}>
              {selectedAccounts.map(accountId => {
                const account = savingsAccounts.find(acc => acc.id === accountId);
                return (
                  <Typography key={accountId} variant="body2">
                    • {account?.name} ({account?.code})
                  </Typography>
                );
              })}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button 
                variant="contained" 
                onClick={handleConfirm}
                color="primary"
              >
                Confirm Approval
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
          <div ref={dialogRef}
               className="flex flex-col bg-white rounded-lg w-full max-w-md mx-auto overflow-hidden"
               style={{ zIndex: 100000000, maxHeight: "90vh", minWidth: "43em", overflowY: "auto" }}>
            <div id='modal-header'
                 className="flex justify-between items-center border-b border-gray-200 p-4">
              <h1 className="modal-title text-lg font-semibold">Approve Leaders</h1>
              <button onClick={handleClose}
                      className="text-gray-700 hover:text-gray-900">
                <XMarkIcon className="h-8 w-8" aria-hidden="true"/>
              </button>
            </div>
            <div id='approve-content' className="flex flex-1">
              <div className="flex flex-col flex-1">
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
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default ApproveLeaderModal;
