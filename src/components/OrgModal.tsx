import {useEffect, useRef, useState} from 'react';
import * as React from 'react';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {OrgAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService'
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from "wagmi"
import { TextField, Button, Typography, Box, Paper } from "@mui/material";

import { keccak256, toUtf8Bytes } from 'ethers';
import ConversationService from "../service/ConversationService"
import {ChatMessage, MessageType, Role} from "../models/ChatCompletion";
import { ethers } from 'ethers';

interface OrgModalProps {
  orgName: string
  isVisible: boolean;
  onClose: () => void;
}


const OrgModal: React.FC<OrgModalProps> = ({orgName, isVisible, onClose}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { veramoAgent, mascaApi, privateIssuerAccount, issuerAccountClient, signatory, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid, setOrgNameValue } = useWallectConnectContext();
  const { data: walletClient }= useWalletClient()

  const [name, setName] = useState("");


  const handleClose = () => {
    onClose();
  };


  async function addOrgAttestation(orgName: string) {

    console.info("*********** ADD ORG ATTESTATION ****************")

    const entityId = "org"

    //console.info("fields: ", orgDid, privateIssuerDid, walletClient, signatory, orgAccountClient, issuerAccountClient, orgIssuerDelegation, orgIndivDelegation, walletClient)
    console.info("fields: ", orgIssuerDelegation, orgIndivDelegation)
    if (orgDid && privateIssuerDid && mascaApi && walletClient && privateIssuerAccount && signatory && orgAccountClient && issuerAccountClient && orgIssuerDelegation && orgIndivDelegation && walletClient) {

      // set the org name locally and in profile
      //console.info("set org name: ", orgName)
      //setOrgName(orgName)

      const vc = await VerifiableCredentialsService.createOrgVC(entityId, orgDid, privateIssuerDid, orgName);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, mascaApi, privateIssuerAccount, issuerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof
      if (fullVc && signatory && orgAccountClient && walletClient) {
      
        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: OrgAttestation = {
          name: orgName,
          attester: orgDid,
          class: "organization",
          category: "wallet",
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

        console.info("AttestationService add org attestation")
        const uid = await AttestationService.addOrgAttestation(attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, issuerAccountClient)
        setOrgNameValue(orgName)

        if (location.pathname.startsWith("/chat/c/")) {
          let conversationId = location.pathname.replace("/chat/c/", "")
          let id = parseInt(conversationId)
          const conversation = await ConversationService.getConversationById(id)
          if (conversation) {

            var currentMsgs: ChatMessage[] = JSON.parse(conversation.messages);

            const newMsg: ChatMessage = {
              id: currentMsgs.length + 1,
              args: "",
              role: Role.Developer,
              messageType: MessageType.Normal,
              content: "I've updated your wallet with a verifiable credential and published your organization attestation.",
            };

            const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg]
            const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]]

            console.info("update conversation message ")
          
            ConversationService.updateConversation(conversation, msgs2)
          }
        }
        

      }


      return "org attestation"


    }
    
  }


  const handleSave = () => {
    if (signatory && orgAccountClient && walletClient) {
      addOrgAttestation(name)
    };
    onClose()
  }


  useEffect(() => {
      setName(orgName)
  }, [isVisible]);

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
                 style={{minHeight: "640px", minWidth: "43em"}}>
              <div id='modal-header'
                   className="modal-header flex justify-between items-center border-b border-gray-200 p-4">
                <h1 className="modal-title text-lg font-semibold">Post Organization Attestation</h1>
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
                    <TextField
                      label="Organization Name"
                      variant="outlined"
                      fullWidth
                      value={name}
                      placeholder="organization name"
                      onChange={(e) => setName(e.target.value)}
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
                    Create and Post Attestation
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

export default OrgModal;
