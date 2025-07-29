import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { hashMessage  } from "viem";


import { ethers } from 'ethers';
import { recoverPublicKey } from "@ethersproject/signing-key";

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';


import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";


import { IndivAttestation, RegisteredDomainAttestation } from "../models/Attestation"

import {AttestationCard } from "./AttestationCard"

import { 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Paper,

  Tabs as MuiTabs } from "@mui/material";



interface CreateWebDidModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const CreateWebDidModal: React.FC<CreateWebDidModalProps> = ({isVisible, onClose}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, veramoAgent, signatory, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgBurnerDelegation, indivBurnerDelegation, orgAccountClient, indivAccountClient, privateIssuerAccount, burnerAccountClient } = useWallectConnectContext();


  const [attestations, setAttestations] = useState<IndivAttestation[]>([]);
  const [webDidJson, setWebDidJson] = useState<any>();

  const handleClose = () => {
    onClose();
  };




  useEffect(() => {

    async function createWebDidJson() {

      // test with https://resolver.identity.foundation/
      if (chain && orgDid) {
        const displayName = ""
        const attestation = await AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.RegisteredDomainSchemaUID, "domain(org)", displayName)
        if (attestation) {

          const domainAttestation = attestation as RegisteredDomainAttestation

          const signer = signatory.signer
          console.info("...........signer: ", signer)


          // Use ethers to sign a message and recover the public key
          const message = "get_public_key";
          const signature = await signer.signMessage(message);
          const recoveredPubKey = recoverPublicKey(
            hashMessage(message),
            signature
          );
          const pubKeyNoPrefix = recoveredPubKey.slice(2); // Remove '0x04'

          /*
          const x = pubKeyNoPrefix.slice(0, 64); // First 32 bytes (64 hex chars)
          const y = pubKeyNoPrefix.slice(64); // Last 32 bytes (64 hex chars)

          // Convert to base64url
          const toBase64url = (hex: any) => {
            const buffer = Buffer.from(hex, 'hex');
            return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          };

          const xBase64url = toBase64url(x);
          const yBase64url = toBase64url(y);
          */

          const domain = domainAttestation.domain
          const webDidJson = {
            "@context": "https://www.w3.org/ns/did/v1, https://w3id.org/security/suites/jws-2020/v1",
            "id": "did:web:" + domain,
            "verificationMethod": [{
              "id": "did:web:" + domain + "#owner",
              "type": "JsonWebKey2020",
              "controller": "did:web:" + domain,
              "publicKeyHex": pubKeyNoPrefix
            }],
            "authentication": [
              "did:web:" + domain + "#owner"
            ]
          }

          setWebDidJson(webDidJson)

        }
      }

    }
    //console.info("populate indiv atts")
    if (orgDid && isVisible) {
      createWebDidJson().then(() => {
        console.info("web did json updated")
      })
    }
    
  }, [orgDid, isVisible]);
  

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
                <h1 className="modal-title text-lg font-semibold">{('Create Web DID json')}</h1>
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
                      
                      <div className="tab-panel" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(webDidJson, null, 2)}
                        </div>
                      </div>
              
                                
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

export default CreateWebDidModal;
