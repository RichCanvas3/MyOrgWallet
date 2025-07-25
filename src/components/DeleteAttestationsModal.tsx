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
  const { chain, veramoAgent, credentialManager, signatory, privateIssuerAccount, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, burnerAccountClient } = useWallectConnectContext();



  const handleClose = () => {
    onClose();
  };



  const handleDeleteOrgAttestations = async () => {
    console.info("inside delete attestations 1")
    console.info("orgDid: ", orgDid)
    console.info("chain: ", chain)
    console.info("orgIndivDelegation 2: ", orgIndivDelegation)
    console.info("orgIssuerDelegation 2: ", orgIssuerDelegation)
    console.info("indivIssuerDelegation 2: ", indivIssuerDelegation)
    console.info("burnerAccountClient 2: ", burnerAccountClient)

    if (orgDid && chain && orgIndivDelegation && orgIssuerDelegation && indivIssuerDelegation && burnerAccountClient) {
      console.info("delete org attestations 1")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly(chain,orgDid, "")
      if (attestations && attestations.length > 0) {
        console.info("signer a: ", signatory)
        const walletSigner = signatory.signer
        const rslt = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [orgIssuerDelegation, orgIndivDelegation], burnerAccountClient)
        console.info("delete organization attestations is done ", rslt)
      }
    }
  }

  const handleDeleteIndivAttestations = async () => {
    console.info("inside delete attestations 2")
    console.info("indivDid: ", indivDid)
    console.info("chain: ", chain)
    console.info("indivIssuerDelegation 4: ", indivIssuerDelegation)
    console.info("burnerAccountClient 4: ", burnerAccountClient)

    if (chain && indivDid && indivIssuerDelegation && burnerAccountClient) {
      console.info("delete indiv attestations 4")
      const attestations = await AttestationService.loadRecentAttestationsTitleOnly(chain,"", indivDid)
      if (attestations && attestations.length > 0) {
        console.info("signer b: ", signatory)
        const walletSigner = signatory.signer

        const rsl = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [indivIssuerDelegation], burnerAccountClient)
        console.info("delete all individual attestations is done ")

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
