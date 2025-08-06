import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, WebsiteAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface WebsiteModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const WebsiteModal: React.FC<WebsiteModalProps> = ({isVisible, onClose}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [url, setUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        setIsCreating(true);
        setProgressMessage("Creating verifiable credential...");
        console.info("Creating website attestation...");

        // Validate URL
        if (!url.trim()) {
          console.error("Website URL is required");
          return;
        }

        // Create verifiable credential for website ownership
        setProgressMessage("Creating verifiable credential...");
        const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC("website(org)", orgDid, privateIssuerDid, "public", url);
        setProgressMessage("Saving credential to blockchain...");
        const result = await VerifiableCredentialsService.createCredential(vc, "website(org)", url, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (fullVc && vcId && chain && orgAccountClient) {
          // Create attestation
          setProgressMessage("Creating attestation on blockchain...");
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: WebsiteAttestation = {
            type: "public",
            url: url,
            attester: orgDid,
            entityId: "website(org)",
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
          setProgressMessage("Publishing attestation to blockchain...");
          const uid = await AttestationService.addWebsiteAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

          console.info("Website attestation created successfully: ", uid);

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
                  content: "I've updated your wallet with a verifiable credential and published your website attestation.",
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
        console.error("Error creating website attestation:", error);
      } finally {
        setIsCreating(false);
        setProgressMessage("");
      }
    } else {
      console.error("Missing required context for attestation creation");
    }
  };

  useEffect(() => {
    if (isVisible) {
      // get website attestation
      if (orgDid && chain) {
        AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.WebsiteSchemaUID, "website(org)", "").then((att) => {
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
                Website Verification
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
                <Typography variant="h6" gutterBottom>
                  Verify Your Organization's Website
                </Typography>

                {/* Why Website Verification is Important Section */}
                <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                  <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                    Why Website Verification Matters
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Website verification helps establish your organization's digital presence and online credibility:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Digital Identity:</strong> Verifies your organization's official website and online presence
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Online Credibility:</strong> Builds trust with customers, partners, and stakeholders
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Brand Protection:</strong> Establishes ownership of your organization's digital domain
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Professional Presence:</strong> Demonstrates your organization's commitment to digital infrastructure
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your website ownership
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    This verification creates a tamper-proof credential that can be shared with customers, partners, and stakeholders to establish trust and credibility for your organization's digital presence.
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  label="Website URL"
                  variant="outlined"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  sx={{ mb: 3 }}
                  disabled={isCreating}
                />

                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleSave}
                  disabled={isCreating || !url.trim()}
                  sx={{ mb: 2, p: 2, py: 1.5 }}
                >
                  {isCreating ? progressMessage || "Creating Website Attestation..." : "Create Website Attestation"}
                </Button>
              </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default WebsiteModal;