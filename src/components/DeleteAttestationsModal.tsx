import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage  } from "viem";
import { ethers } from 'ethers';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';


import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useAccount } from 'wagmi';

import { Button, Paper } from "@mui/material";
import { RPC_URL, } from "../config";


import {
  Implementation,
  toMetaMaskSmartAccount,
  createDelegation,
} from "@metamask/delegation-toolkit";

import { OrgIndivAttestation } from "../models/Attestation"

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"


interface DeleteAttestationsModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const DeleteAttestationsModal: React.FC<DeleteAttestationsModalProps> = ({isVisible, onClose}) => {


  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, veramoAgent, mascaApi, signatory, privateIssuerAccount, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, burnerAccountClient } = useWallectConnectContext();



  const handleClose = () => {
    onClose();
  };



  const handleDeleteOrgAttestations = async () => {
    console.info("delete attestations")
    if (orgDid && chain && orgIndivDelegation && orgIssuerDelegation && indivIssuerDelegation && burnerAccountClient) {
      console.info("delete org attestations")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly(chain,orgDid, "")
      if (attestations && attestations.length > 0) {

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()

        const rslt = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [orgIssuerDelegation, orgIndivDelegation], burnerAccountClient)
        console.info("delete organization attestations is done ")
      }


    }
  }

  const handleDeleteIndivAttestations = async () => {
    if (chain && indivDid && indivIssuerDelegation && burnerAccountClient) {
      console.info("delete indiv attestations")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly(chain,"", indivDid)
      if (attestations && attestations.length > 0) {

        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner()

        const rsl = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [indivIssuerDelegation], burnerAccountClient)
        console.info("delete all individual attestations is done ")

      }



    }
  }

  const handleAddSamCFO = async (event: React.MouseEvent<HTMLButtonElement>) => {

    if (signatory && orgDid && privateIssuerDid && indivIssuerDelegation && chain) {

      const walletClient = signatory.walletClient

      const publicClient = createPublicClient({
                chain: chain,
                transport: http(RPC_URL),
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

      const samIndivDid = 'did:pkh:eip155:' + chain?.id + ':' + samIndivAccountClient.address

      //let samOrgIndivDel = null
      //try {
      //  samOrgIndivDel = await DelegationService.getDelegationFromSnap(walletClient, samCFOEOA, orgAccountClient.address, samIndivAccountClient.address)
      //}
      //catch (error) {
      //}

      
      const samIndivAttestation = await AttestationService.getOrgIndivAttestation(chain, samIndivDid, AttestationService.OrgIndivSchemaUID, "org-indiv(org)");

      let samOrgIndivDel : any | undefined
      let samDelegationOrgAddress : `0x${string}` | undefined
      if (samIndivAttestation) {
        samOrgIndivDel = JSON.parse((samIndivAttestation as OrgIndivAttestation).delegation)
        if (samIndivAccountClient.address == samOrgIndivDel.delegate) {
          console.info("*********** valid individual attestation so lets use this org address")
          // need to validate signature at some point
          samDelegationOrgAddress = samOrgIndivDel.delegator
        }
      }

      if (!samOrgIndivDel && orgAccountClient && privateIssuerAccount) {

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

        const delegationJsonStr = JSON.stringify(samOrgIndivDel)

        //  create delegation to sam attestation

        const samIndivName = ""

        const vc = await VerifiableCredentialsService.createOrgIndivVC("org-indiv", orgDid, samIndivDid, samIndivName, delegationJsonStr, privateIssuerDid);
        const result = await VerifiableCredentialsService.createCredential(vc, "org-indiv", samIndivName, orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)

        console.info("result of create credential: ", result)
        const fullVc = result.vc
        const proof = result.proof

        if (fullVc && proof && chain && orgIssuerDelegation && orgIndivDelegation && burnerAccountClient) {

          console.info("&&&&&&&&&&&&&&&&&&&&&&& AttestationService add indiv attestation")

          const indivName = "indiv name"
        
          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: OrgIndivAttestation = {
            indivDid: samIndivDid,
            name: indivName,
            delegation: JSON.stringify(samOrgIndivDel),
            attester: orgDid,
            class: "organization",
            category: "leadership",
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
        }


      }
      else {
        console.info("************************   SAM's Delegation ************")
        console.info("samCFOEOA: ", samCFOEOA)
        console.info("to: ", samIndivAccountClient.address)
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

export default DeleteAttestationsModal;
