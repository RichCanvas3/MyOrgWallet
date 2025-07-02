import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import { Transition } from '@headlessui/react';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from 'wagmi';
import { IndivAttestation, AccountIndivDelAttestation, AccountOrgDelAttestation } from "../models/Attestation";
import { Account } from "../models/Account";
import { AttestationCard } from "./AttestationCard";
import {
  Button,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel
} from "@mui/material";

import {
    createDelegation,
    getDelegationHashOffchain,
  } from "@metamask/delegation-toolkit";

import { useCrossChainAccount } from "../hooks/useCrossChainTools";

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"

const steps = ['Select Account', 'Select Individual', 'Confirm'];

interface ApproveAccountAccessModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const ApproveAccountAccessModal: React.FC<ApproveAccountAccessModalProps> = ({ isVisible, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, orgAccountClient, privateIssuerAccount, burnerAccountClient, mascaApi, veramoAgent, indivDid } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [individuals, setIndividuals] = useState<IndivAttestation[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedIndividual, setSelectedIndividual] = useState<IndivAttestation | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && orgDid && chain) {
      console.info("Loading org accounts for orgDid:", orgDid, "chain:", chain);
      // Try to load accounts from different categories
      Promise.all([
        AttestationService.loadOrgAccounts(chain, orgDid, "1110"), // Cash & Bank
        AttestationService.loadOrgAccounts(chain, orgDid, "1200"), // Credit Cards
        AttestationService.loadOrgAccounts(chain, orgDid, "1300"), // Other assets
      ]).then(([cashAccounts, creditAccounts, otherAccounts]) => {
        const allAccounts = [...cashAccounts, ...creditAccounts, ...otherAccounts];
        console.info("Loaded all org accounts:", allAccounts);
        setAccounts(allAccounts);
      }).catch((error) => {
        console.error("Error loading accounts:", error);
        setAccounts([]);
      });
      
      AttestationService.getIndivsNotApprovedAttestations(chain, orgDid).then((atts) => {
        if (atts) setIndividuals(atts);
      });
    }
  }, [isVisible, orgDid, chain]);

  const handleClose = () => {
    setActiveStep(0);
    setSelectedAccount(null);
    setSelectedIndividual(null);
    onClose();
  };

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleAccountSelect = (account: Account) => {
    setSelectedAccount(account);
    handleNext();
  };

  const handleIndividualSelect = (indiv: IndivAttestation) => {
    setSelectedIndividual(indiv);
    handleNext();
  };

  const handleConfirm = async () => {
    if (!selectedAccount || !selectedIndividual) return;
    setLoading(true);
    try {

      console.info("***********  approve account access handleConfirm ****************");

      // Prepare delegation and attestation
      if (orgIndivDelegation && chain && orgDid && privateIssuerDid && walletClient && orgAccountClient && privateIssuerAccount && burnerAccountClient) {
        

        console.info("***********  orgIndivDelegation ****************", orgIndivDelegation);
        console.info("***********  chain ****************", chain);
        console.info("***********  orgDid ****************", orgDid);
        console.info("***********  privateIssuerDid ****************", privateIssuerDid);
        console.info("***********  walletClient ****************", walletClient);
        console.info("***********  orgAccountClient ****************", orgAccountClient);
        console.info("***********  privateIssuerAccount ****************", privateIssuerAccount); 

        const accountDid = selectedAccount.attestation?.accountDid || ""

        const leaderIndivAddress = selectedIndividual.attester.replace('did:pkh:eip155:' + chain?.id + ':', '') as `0x${string}`;
        const leaderIndivDid = selectedIndividual.attester;
        const leaderIndivName = selectedIndividual.name;

        

        if (accountDid == "") {
          return
        }
        if (leaderIndivDid == "") {
          return
        }


        console.info("***********  selectedAccount.attestation?.delegation ****************");
        console.info("***********  selectedAccount.attestation?.delegation ****************", selectedAccount);
        const parentDelegationHash = getDelegationHashOffchain(JSON.parse(selectedAccount.attestation?.delegation || ""));
        let indivDel = createDelegation({
          to: leaderIndivAddress,
          from: orgAccountClient.address,
          parentDelegation: parentDelegationHash,
          caveats: []
        });


        const indivDelSignature = await orgAccountClient.signDelegation({
          delegation: indivDel,
        });

        console.info("***********  indivDelSignature ****************", indivDelSignature);

        indivDel = {
          ...indivDel,
          signature: indivDelSignature,
        }

        console.info("***********  indivDel ****************", indivDel);

        const indivDelegationJsonStr = JSON.stringify(indivDel)
        console.info("***********  indivDelegationJsonStr ****************", indivDelegationJsonStr);

        const name = selectedAccount.attestation?.accountName + " - " + leaderIndivName
          

        const entityId = "account-indiv(org)"
        const vc = await VerifiableCredentialsService.createAccountIndivDelVC(
          entityId, 
          privateIssuerDid, 
          accountDid || "", 
          leaderIndivDid,
          name, 
          selectedAccount.attestation?.coaCode || "",
          selectedAccount.attestation?.coaCategory || "",
          selectedAccount.attestation?.delegation || "",
          indivDelegationJsonStr
        )           

        const result = await VerifiableCredentialsService.createCredential(vc, entityId, accountDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof

        console.info("***********  fullVc ****************", fullVc);


        if (fullVc && leaderIndivDid && chain && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && orgAccountClient) {

          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: AccountIndivDelAttestation = {
              indivDid: leaderIndivDid,
              accountName: name,
              accountDid: accountDid,
              coaCode: selectedAccount.attestation?.coaCode || "",
              coaCategory: selectedAccount.attestation?.coaCategory || "",
              orgDelegation: selectedAccount.attestation?.delegation || "",
              indivDelegation: indivDelegationJsonStr,
              attester: leaderIndivDid,
              class: "individual",
              category: "financial",
              entityId: entityId,
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              proof: proof
          };
          const provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const walletSigner = await provider.getSigner()

          console.info("***********  attestation ****************", attestation);
          const uid = await AttestationService.addAccountIndivDelAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)

        }


      }
      handleClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <Typography variant="h6" gutterBottom>Select Organization Account</Typography>
            {accounts.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No organization accounts found in category "1110". 
                  Please ensure you have created accounts in the Cash & Bank category.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {accounts.map(account => (
                  <Box key={account.id} sx={{ minWidth: 200 }}>
                    <AttestationCard
                      attestation={account.attestation!}
                      selected={selectedAccount?.id === account.id}
                      onSelect={() => handleAccountSelect(account)}
                      hoverable
                    />
                  </Box>
                ))}
              </Box>
            )}
          </>
        );
      case 1:
        return (
          <>
            <Typography variant="h6" gutterBottom>Select Individual</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {individuals.map(indiv => (
                <Box key={indiv.attester} sx={{ minWidth: 200 }}>
                  <AttestationCard
                    attestation={indiv}
                    selected={selectedIndividual?.attester === indiv.attester}
                    onSelect={() => handleIndividualSelect(indiv)}
                    hoverable
                  />
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
            </Box>
          </>
        );
      case 2:
        return (
          <>
            <Typography variant="h6" gutterBottom>Confirm Access Grant</Typography>
            <Typography variant="body1" paragraph>
              You are about to grant <b>{selectedIndividual?.name}</b> access to account <b>{selectedAccount?.name}</b>.
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button variant="contained" onClick={handleConfirm} color="primary" disabled={loading}>
                {loading ? 'Processing...' : 'Confirm'}
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
              <h1 className="modal-title text-lg font-semibold">Approve Account Access</h1>
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

export default ApproveAccountAccessModal; 