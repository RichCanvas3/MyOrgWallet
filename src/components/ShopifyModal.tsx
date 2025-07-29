import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, WebsiteAttestation, SocialAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface ShopifyModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOAuthTrigger?: () => void;
}

const ShopifyModal: React.FC<ShopifyModalProps> = ({isVisible, onClose, onOAuthTrigger}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        console.info("Creating Shopify attestation with manual data...");

        // Use default values since form fields are removed
        const defaultName = "Shopify Store";
        const defaultUrl = "https://store.myshopify.com";

        // Create verifiable credential for website ownership
        const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC("shopify(org)", orgDid, privateIssuerDid, "commerce", defaultUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, "shopify(org)", defaultUrl, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (fullVc && vcId && chain && orgAccountClient) {
          // Create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: WebsiteAttestation = {
            type: "commerce",
            url: defaultUrl,
            attester: orgDid,
            entityId: "shopify(org)",
            class: "organization",
            category: "identity",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
            proof: proof
          };

          const walletSigner = signatory.signer;
          const uid = await AttestationService.addWebsiteAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

          console.info("Shopify attestation created successfully: ", uid);

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
                  content: "I've updated your wallet with a verifiable credential and published your Shopify attestation.",
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
        console.error("Error creating Shopify attestation:", error);
      }
    } else {
      console.error("Missing required context for attestation creation");
    }
  }

  useEffect(() => {
    if (isVisible) {
      // get shopify attestation
      if (orgDid && chain) {
        AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.WebsiteSchemaUID, "shopify(org)", "").then((att) => {
          if (att) {
            setAttestation(att)
          }

          let websiteAtt = att as WebsiteAttestation

          if (websiteAtt?.url) {
            setUrl(websiteAtt?.url)
          }
        })
      }
    }
  }, [isVisible]);

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
                Shopify Verification
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
                    Create Shopify Attestation
                  </Button>

                  </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default ShopifyModal;