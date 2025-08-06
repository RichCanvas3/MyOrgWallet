import {useEffect, useRef, useState} from 'react';
import * as React from 'react';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, EmailAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from "wagmi"
import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface EmailVerificationModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({isVisible, onClose}) => {
  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!email.trim()) {
      return;
    }

    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        setIsCreating(true);
        setProgressMessage("Creating verifiable credential...");
        console.info("Creating email attestation...");

        const emailType = "info";
        const entityId = "email(org)";

        // Create verifiable credential
        setProgressMessage("Creating verifiable credential...");
        const vc = await VerifiableCredentialsService.createEmailVC(entityId, orgDid, privateIssuerDid, emailType, email);
        setProgressMessage("Creating credential on blockchain...");
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, email, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {
          // Create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: EmailAttestation = {
            type: emailType,
            email: email,
            attester: orgDid,
            entityId: entityId,
            class: "organization",
            category: "identity",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
            proof: proof
          };

          setProgressMessage("Creating attestation on blockchain...");
          const walletSigner = signatory.signer;
          const uid = await AttestationService.addEmailAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

          console.info("Email attestation created successfully: ", uid);

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
                  role: Role.Assistant,
                  messageType: MessageType.Normal,
                  content: `✅ Email attestation created successfully for ${email}!`
                };

                currentMsgs.push(newMsg);
                conversation.messages = JSON.stringify(currentMsgs);
                ConversationService.updateConversation(conversation);
              }
            });
          }

          setAttestation(attestation);
          onClose();
        }
      } catch (error) {
        console.error("Error creating email attestation:", error);

        let errorMessage = `❌ Failed to create email attestation for ${email}.`;

        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes("user rejected")) {
            errorMessage = `❌ Transaction was rejected by user. Please try again.`;
          } else if (error.message.includes("insufficient funds")) {
            errorMessage = `❌ Insufficient funds for gas fees. Please check your wallet balance.`;
          } else if (error.message.includes("network")) {
            errorMessage = `❌ Network error. Please check your connection and try again.`;
          } else {
            errorMessage = `❌ Error: ${error.message}`;
          }
        }

        // Add error message to conversation
        if (location.pathname.startsWith("/chat/c/")) {
          let conversationId = location.pathname.replace("/chat/c/", "");
          let id = parseInt(conversationId);
          ConversationService.getConversationById(id).then((conversation) => {
            if (conversation) {
              var currentMsgs: ChatMessage[] = JSON.parse(conversation.messages);

              const newMsg: ChatMessage = {
                id: currentMsgs.length + 1,
                args: "",
                role: Role.Assistant,
                messageType: MessageType.Normal,
                content: errorMessage
              };

              currentMsgs.push(newMsg);
              conversation.messages = JSON.stringify(currentMsgs);
              ConversationService.updateConversation(conversation);
            }
          });
        }
      } finally {
        setIsCreating(false);
        setProgressMessage("");
      }
    }
  };

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
                Email Verification
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
                  Verify Your Organization's Email
                </Typography>

                {/* Why Email Verification is Important Section */}
                <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                  <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                    Why Email Verification Matters
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Email verification helps establish your organization's official communication channels and digital identity:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Official Communication:</strong> Verifies your organization's primary email address for business communications
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Digital Identity:</strong> Establishes your organization's official digital contact information
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Professional Credibility:</strong> Builds trust with clients, partners, and stakeholders
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Contact Verification:</strong> Ensures reliable communication channels for business operations
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your email identity
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    This verification creates a tamper-proof credential that can be shared with clients, partners, and stakeholders to establish trust and verify your organization's official communication channels.
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  label="Organization Email"
                  variant="outlined"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@company.com"
                  sx={{ mb: 3 }}
                  disabled={isCreating}
                  type="email"
                />

                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleSave}
                  disabled={isCreating || !email.trim()}
                  sx={{ mb: 2, p: 2, py: 1.5 }}
                >
                  {isCreating ? (progressMessage || "Creating Email Attestation...") : "Create Email Attestation"}
                </Button>
              </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default EmailVerificationModal;