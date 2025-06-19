import {useEffect, useRef, useState} from 'react';
import * as React from 'react';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, SocialAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from "wagmi"
import { TextField, Button, Typography, Box, Paper } from "@mui/material";



interface LinkedinModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const LinkedinModal: React.FC<LinkedinModalProps> = ({isVisible, onClose}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient } = useWallectConnectContext();
  const { data: walletClient }= useWalletClient()

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");


  const handleClose = () => {
    onClose();
  };



  const handleSave = () => {
    if (indivAccountClient && walletClient) {

      let att = attestation as SocialAttestation
      att.name = name
      att.url = url

      console.info("update social attestation: ", att)
      //AttestationService.updateSocialAttestation(att, signer, indivAccountClient, walletClient).then((rsl) => {
      //})

    };

    onClose()
  }


  useEffect(() => {

    if (isVisible) {
      // get linkedin attestation
      if (indivDid && chain && indivAccountClient) {
        AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.SocialSchemaUID, "linkedin(indiv)").then((att) => {
          if (att) {
            setAttestation(att)
          }
          
          let socialAtt = att as SocialAttestation

          if (socialAtt?.name) {
            setName(socialAtt?.name)
          }
          if (socialAtt?.url) {
            setUrl(socialAtt?.url)
          }

        })

      }
    }
    


  }, [isVisible]);




  useEffect(() => {
    
  }, []);



  return (
      <Transition show={isVisible} as={React.Fragment}>
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50 px-4">
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
                 className="modal-overlay flex flex-col bg-white rounded-lg w-full max-w-md mx-auto overflow-hidden"
                 style={{minHeight: "640px", minWidth: "43em"}}>
              <div id='user-settings-header'
                   className="flex justify-between items-center border-b border-gray-200 p-4">
                <h1 className="text-lg font-semibold">{('Linkedin')}</h1>
                <button onClick={handleClose}
                        className="text-gray-700 hover:text-gray-900">
                  <XMarkIcon className="h-8 w-8" aria-hidden="true"/>
                </button>
              </div>
              <div id='linkedin-content' className="flex flex-1">
                <div className="flex flex-col flex-1">

                <Paper
                  elevation={4}
                  sx={{
                    width: "100%",
                    height: "100%",
                    p: 4,
                  }}
                >
                  <Box sx={{ mb: 3, p: 2, border: "1px solid #ddd", borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                      company name
                    </Typography>

                    <TextField
                      label="name"
                      variant="outlined"
                      fullWidth
                      value={name}
                      placeholder="richcanvas"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Box>
                  <Box sx={{ mb: 3, p: 2, border: "1px solid #ddd", borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                      company url
                    </Typography>
                    <TextField
                      label="url"
                      variant="outlined"
                      fullWidth
                      value={url}
                      placeholder="https://www.linkedin.com/company/richcanvas"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} 
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleSave}
                    sx={{ mb: 3, p: 2, py: 1.5 }}
                  >
                    Save
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

export default LinkedinModal;
