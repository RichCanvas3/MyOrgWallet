import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, SocialAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { addressResolverAbi } from 'viem/_types/constants/abis';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface XModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOAuthTrigger?: () => void;
}


const XModal: React.FC<XModalProps> = ({isVisible, onClose, onOAuthTrigger}) => {


  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");



  const handleClose = () => {
    onClose();
  };



  const handleSave = async () => {
    if (indivAccountClient && chain && indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && indivBurnerDelegation && veramoAgent && signatory) {
      try {
        console.info("Creating X/Twitter attestation with manual data...");

        // Use default values since form fields are removed
        const defaultName = "X Profile";
        const defaultUrl = "https://x.com/profile";

        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createSocialVC("x(indiv)", indivDid, privateIssuerDid, defaultName, defaultUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, "x(indiv)", "x", indivDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && indivAccountClient && indivBurnerDelegation) {
          // Create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: SocialAttestation = {
            attester: indivDid,
            entityId: "x(indiv)",
            class: "individual",
            category: "identity",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
            proof: proof,
            name: defaultName,
            url: defaultUrl,
            displayName: "x"
          };

          const walletSigner = signatory.signer;
          const uid = await AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          console.info("X/Twitter attestation created successfully: ", uid);

          // Add success message to conversation
          if (location.pathname.startsWith("/chat/c/")) {
            let conversationId = location.pathname.replace("/chat/c/", "");
            let id = parseInt(conversationId);
            ConversationService.getConversationById(id).then((conversation) => {
              if (conversation) {
                var currentMsgs: ChatMessage[] = JSON.parse(conversation.messages);

                const newMsg: ChatMessage = {
                  id: currentMsgs.length + 1,
                  args: "",
                  role: Role.Developer,
                  messageType: MessageType.Normal,
                  content: "I've updated your wallet with a verifiable credential and published your X (Twitter) attestation.",
                };

                const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg];
                const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]];

                console.info("Updating conversation with attestation success message");
                ConversationService.updateConversation(conversation, msgs2);
              }
            });
          }

          // Close modal after successful creation
          onClose();
        } else {
          console.error("Missing required data for attestation creation");
        }
      } catch (error) {
        console.error("Error creating X/Twitter attestation:", error);
      }
    } else {
      console.error("Missing required context for attestation creation");
    }
  }


  useEffect(() => {

    if (isVisible) {
      // get x attestation
      if (indivDid && chain) {

        AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.SocialSchemaUID, "x(indiv)", "").then((att) => {
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
      <div className="modal-overlay">
        <Transition.Child
          as={React.Fragment}
          enter="modal-enter"
          enterFrom="modal-enter-from"
          enterTo="modal-enter-to"
          leave="modal-leave"
          leaveFrom="modal-leave-from"
          leaveTo="modal-leave-to"
        >
          <div className="modal-dialog">
            {/* Header */}
            <div className="modal-header">
              <h1 className="modal-title">
                X (Twitter) Verification
              </h1>
              <button onClick={handleClose} className="close-button">
                <XMarkIcon className="close-icon" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="modal-content">

                <Paper
                  elevation={4}
                  sx={{
                    width: "100%",
                    minHeight: "100%",
                    p: 4,
                    overflowY: "auto",
                  }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={onOAuthTrigger}
                    sx={{ mb: 2, p: 2, py: 1.5 }}
                  >
                    Create X Attestation
                  </Button>

                                    </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default XModal;
