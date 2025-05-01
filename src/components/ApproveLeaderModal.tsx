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

import { TextField, Button, Typography, Box, Paper } from "@mui/material";
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
  const { signatory, orgDid, indivDid, issuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, issuerAccountClient } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();


  const handleClose = () => {
    onClose();
  };



  const handleDeleteOrgAttestations = async () => {
    console.info("delete attestations")
    if (orgDid && orgIndivDelegation && orgIssuerDelegation && indivIssuerDelegation) {
      console.info("delete org attestations")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly(orgDid, "")
      if (attestations && attestations.length > 0) {

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()

        const rslt = await AttestationService.deleteAttestations(attestations, walletSigner, [orgIssuerDelegation, orgIndivDelegation], issuerAccountClient)
        console.info("delete organization attestations is done ")
      }


    }
  }

  const handleDeleteIndivAttestations = async () => {
    if (indivDid && indivIssuerDelegation) {
      console.info("delete indiv attestations")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly("", indivDid)
      if (attestations && attestations.length > 0) {

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()

        const rsl = await AttestationService.deleteAttestations(attestations, walletSigner, [indivIssuerDelegation], issuerAccountClient)
        console.info("delete all individual attestations is done ")

      }



    }
  }

  const handleAddSamCFO = async (event: React.MouseEvent<HTMLButtonElement>) => {

    if (signatory && orgDid && issuerDid && indivIssuerDelegation) {

      const walletClient = signatory.walletClient

      const publicClient = createPublicClient({
                chain: optimism,
                transport: http(),
              });
      

      console.info("add sam and send invitation")

      // setup org-individual delegation for sam the CFO

      const samCFOEOA = "0x8272226863aacd003975b5c497e366c14d009605"
      const samIndivAccountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [samCFOEOA, [], [], []],
        signatory: signatory,
        deploySalt: toHex(1),
      });
      console.info("%%%%%%%%% other individual EOA address: ", samCFOEOA)
      console.info("%%%%%%%%% other individual AA address: ", samIndivAccountClient.address)

      const samIndivDid = 'did:pkh:eip155:10:' + samIndivAccountClient.address

      //let samOrgIndivDel = null
      //try {
      //  samOrgIndivDel = await DelegationService.getDelegationFromSnap(walletClient, samCFOEOA, orgAccountClient.address, samIndivAccountClient.address)
      //}
      //catch (error) {
      //}

      
      const samIndivAttestation = await AttestationService.getIndivOrgAttestation(samIndivDid, AttestationService.IndivOrgSchemaUID, "indiv-org");

      let samOrgIndivDel : any | undefined
      let samDelegationOrgAddress : `0x${string}` | undefined
      if (samIndivAttestation) {
        samOrgIndivDel = JSON.parse((samIndivAttestation as IndivOrgAttestation).rolecid)
        if (samIndivAccountClient.address == samOrgIndivDel.delegate) {
          console.info("*********** valid individual attestation so lets use this org address")
          // need to validate signature at some point
          samDelegationOrgAddress = samOrgIndivDel.delegator
        }
      }

      if (!samOrgIndivDel) {

        console.info("************************   CREATE DELEGATION FOR SAM ************")
        console.info("samCFOEOA: ", samCFOEOA)
        console.info("to: ", samIndivAccountClient.address)
        console.info("from: ", orgAccountClient.address)

        samOrgIndivDel = createDelegation({
          to: samIndivAccountClient.address,
          from: orgAccountClient.address,
          caveats: [] }
        );

        const signature = await orgAccountClient.signDelegation({
          delegation: samOrgIndivDel,
        });


        samOrgIndivDel = {
          ...samOrgIndivDel,
          signature,
        }



        //  create delegation to sam attestation

        const samIndivName = ""

        const vc = await VerifiableCredentialsService.createIndivOrgVC("indiv-org", orgDid, issuerDid, samIndivDid, samIndivName);
        const result = await VerifiableCredentialsService.createCredential(vc, "indiv-org", orgDid, walletClient, issuerAccountClient)

        console.info("result of create credential: ", result)
        const fullVc = result.vc
        const proofUrl = result.proofUrl

        console.info("&&&&&&&&&&&&&&&&&&&&&&& orgIssuerDel && orgIndivDel: ", fullVc, orgIssuerDelegation, orgIndivDelegation)
        if (fullVc && signer && orgIssuerDelegation && orgIndivDelegation) {

          console.info("&&&&&&&&&&&&&&&&&&&&&&& AttestationService add indiv attestation")

          const indivName = "indiv name"
        
          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: IndivOrgAttestation = {
            indivDid: samIndivDid,
            name: indivName,
            rolecid: JSON.stringify(samOrgIndivDel),
            attester: orgDid,
            class: "organization",
            category: "leaders",
            entityId: "indiv-org",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: issuerDid,
            proof: proofUrl
          };

          const provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const walletSigner = await provider.getSigner()
          
          const uid = await AttestationService.addIndivOrgAttestation(attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, issuerAccountClient)
        }


      }
      else {
        console.info("************************   SAM's Delegation ************")
        console.info("samCFOEOA: ", samCFOEOA)
        console.info("to: ", samIndivAccountClient.address)
        console.info("from: ", orgAccountClient.address)
        console.info(" del: ", samOrgIndivDel)
      }



    }
  }
  

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
                 style={{zIndex: 100000000, minHeight: "640px", minWidth: "43em"}}>
              <div id='modal-header'
                   className="flex justify-between items-center border-b border-gray-200 p-4">
                <h1 className="modal-title text-lg font-semibold">{('Delete Attestations')}</h1>
                <button onClick={handleClose}
                        className="text-gray-700 hover:text-gray-900">
                  <XMarkIcon className="h-8 w-8" aria-hidden="true"/>
                </button>
              </div>
              <div id='delete-content' className="flex flex-1">
                <div className="flex flex-col flex-1">

                <Paper
                  elevation={4}
                  sx={{
                    width: "100%",
                    height: "100%",
                    p: 4,
                  }}
                >
                  
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleDeleteOrgAttestations}
                    sx={{ mb: 3, p: 2, py: 1.5 }}
                  >
                    Delete Organizations Attestations
                  </Button>

                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleDeleteIndivAttestations}
                    sx={{ mb: 3, p: 2, py: 1.5 }}
                  >
                    Delete Individuals Attestations
                  </Button>

                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleAddSamCFO}
                    sx={{ mb: 3, p: 2, py: 1.5 }}
                  >
                    Add Sam CFO and send invitation
                  </Button>
      
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
