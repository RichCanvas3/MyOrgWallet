import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from 'wagmi';

import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import EditableTextBox from "./EditableTextBox";
import { TripOriginRounded } from '@mui/icons-material';

interface DeleteAttestationsModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const DeleteAttestationsModal: React.FC<DeleteAttestationsModalProps> = ({isVisible, onClose}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { signer, orgDid, indivDid, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, issuerAccountClient } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();


  const handleClose = () => {
    onClose();
  };



  const handleDeleteOrgAttestations = () => {
    console.info("delete attestations")
    if (signer && orgDid && orgIssuerDelegation && indivIssuerDelegation) {
      console.info("delete org attestations")
      AttestationService.loadRecentAttestationsTitleOnly(orgDid, "").then((attestations) => {
        if (attestations && attestations.length > 0) {
          AttestationService.deleteAttestations(attestations, signer, orgIssuerDelegation, orgAccountClient, issuerAccountClient).then((rsl) => {
            console.info("delete all attestations is done ")
          })
        }
      })
      onClose()
    }
  }

  const handleDeleteIndivAttestations = () => {
    if (signer && indivDid && indivIssuerDelegation) {
      console.info("delete indiv attestations")
      AttestationService.loadRecentAttestationsTitleOnly("", indivDid).then((attestations) => {
        if (attestations && attestations.length > 0) {
          AttestationService.deleteAttestations(attestations, signer, indivIssuerDelegation, indivAccountClient, issuerAccountClient).then((rsl) => {
            console.info("delete all attestations is done ")
          })
        }
      })

      onClose()
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
