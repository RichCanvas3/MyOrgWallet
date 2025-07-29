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
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

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

    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgIssuerDelegation && orgIndivDelegation && veramoAgent && signatory) {
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

        if (proof && fullVc && vcId && chain && orgAccountClient && orgIssuerDelegation && orgIndivDelegation) {
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
          const uid = await AttestationService.addEmailAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

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
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold leading-6 text-gray-900">
                        Organization Email Verification
                      </h3>
                      <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    <div className="mt-4">
                      <Box sx={{ mb: 3, p: 2, border: "1px solid #ddd", borderRadius: 2 }}>
                        <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                          Organization Email
                        </Typography>

                        <TextField
                          label="Organization Email"
                          variant="outlined"
                          fullWidth
                          value={email}
                          placeholder="info@company.com"
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isCreating}
                          type="email"
                        />
                      </Box>

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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </div>
    </Transition>
  );
};

export default EmailVerificationModal;