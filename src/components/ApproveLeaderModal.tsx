import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage  } from "viem";
import { optimism } from "viem/chains";
import { ethers } from 'ethers';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';


import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from 'wagmi';

import { IndivAttestation } from "../models/Attestation"

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
  Tabs as MuiTabs } from "@mui/material";
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

import { IndivOrgAttestation } from "../models/Attestation"

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"


interface ApproveLeaderModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const ApproveLeaderModal: React.FC<ApproveLeaderModalProps> = ({isVisible, onClose}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { veramoAgent, mascaApi, signatory, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, privateIssuerAccount, burnerAccountClient } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  const [attestations, setAttestations] = useState<IndivAttestation[]>([]);

  const handleClose = () => {
    onClose();
  };



  const handleSelectedAttestation = async (att: IndivAttestation) => {

    // if this user has been granted permissions through orgIndivDelegation
    console.info("need these values: ", orgIndivDelegation, orgDid, privateIssuerDid, walletClient)
    if (orgIndivDelegation && orgDid && privateIssuerDid && walletClient && orgAccountClient && privateIssuerAccount) {

      console.info("approve it: ", att)

      console.info("************************   CREATE DELEGATION FOR: ", att.name)
      const leaderIndivAddress = att.attester.replace('did:pkh:eip155:10:', '') as `0x${string}`
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


      const vc = await VerifiableCredentialsService.createIndivOrgVC("indiv-org", orgDid, privateIssuerDid, leaderIndivDid, att.name);
      const result = await VerifiableCredentialsService.createCredential(vc, "indiv-org", orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)

      console.info("result of create credential: ", result)
      const fullVc = result.vc
      const proof = result.proof

      if (proof && fullVc && orgIssuerDelegation && orgIndivDelegation && burnerAccountClient) {

        console.info("&&&&&&&&&&&&&&&&&&&&&&& AttestationService add indiv attestation")

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: IndivOrgAttestation = {
          indivDid: leaderIndivDid,
          name: att.name,
          rolecid: JSON.stringify(leaderOrgIndivDel),
          attester: orgDid,
          class: "organization",
          category: "leaders",
          entityId: "indiv-org",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          proof: proof
        };

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()
        
        const uid = await AttestationService.addIndivOrgAttestation(attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
      }
    }
    else {
      console.info(">>>>>>>>>>  YOU DO NOT HAVE PERMISSIONS TO ADD FOLKS >>>>>>>>>>")
    }

    
  }

  useEffect(() => {
    //console.info("populate indiv atts")
    if (orgDid) {
      //console.info("got did")
      AttestationService.getIndivsNotApprovedAttestations(orgDid).then((atts) => {
        if (atts) {
          setAttestations(atts)
        }
      })
    }
    
  }, [orgDid]);
  

  return (
      <Transition show={isVisible} as={React.Fragment}>
        <div  className="modal-overlay fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50 px-4">
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
                 className="flex flex-col bg-white  rounded-lg w-full max-w-md mx-auto overflow-hidden"
                 style={{ zIndex: 100000000, maxHeight: "90vh", minWidth: "43em", overflowY: "auto" }}>
              <div id='modal-header'
                   className="flex justify-between items-center border-b border-gray-200 p-4">
                <h1 className="modal-title text-lg font-semibold">{('Approve Leaders')}</h1>
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
                      minHeight="100vh"
                      width="100%"
                    >
                      
                      <Grid container spacing={2}>
                        {attestations.map(att => (
                          <Grid
                            key={att.entityId}
                          >
                            <AttestationCard
                              attestation={att}
                              selected={false}
                              onSelect={() => {
                                handleSelectedAttestation(att);
                              }}
                              hoverable
                            />
                          </Grid>
                        ))}
                      </Grid>
              
                                
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
