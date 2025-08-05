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
  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [isUrlVerifying, setIsUrlVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");

  const handleClose = () => {
    onClose();
  };

  const handleUrlVerification = async () => {
    if (indivAccountClient && chain && indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && indivBurnerDelegation && veramoAgent && signatory) {
      try {
        setIsUrlVerifying(true);
        setVerificationStatus("Creating X/Twitter attestation...");

        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createSocialVC("x(indiv)", indivDid, privateIssuerDid, "X Profile", xUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, "x(indiv)", "x", indivDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && indivAccountClient && indivBurnerDelegation && signatory) {
          const socialAttestation: SocialAttestation = {
            entityId: "x(indiv)",
            name: "X Profile",
            url: xUrl,
            class: "individual",
            schemaId: AttestationService.SocialSchemaUID,
            schema: AttestationService.SocialSchema,
            priority: 12,
            introduction: "Verify your X (Twitter) profile to establish your social media presence and build online credibility.",
            instruction: "Connect your X profile to create a verifiable credential that proves your social media identity.",
            attestation: {
              uid: vcId,
              schemaId: AttestationService.SocialSchemaUID,
              attester: indivAccountClient.address,
              hash: keccak256(toUtf8Bytes(fullVc)),
              vc: fullVc,
              proof: proof,
              vcId: vcId,
              entityId: "x(indiv)",
              name: "X Profile",
              url: xUrl,
              class: "individual"
            }
          };

          const attestationUid = await AttestationService.addSocialAttestation(chain, socialAttestation, signatory, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          if (attestationUid) {
            setVerificationStatus("X/Twitter attestation created successfully!");

            // Update conversation if in chat context
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
            setTimeout(() => {
              onClose();
            }, 2000);
          } else {
            setVerificationStatus("Failed to create attestation. Please try again.");
          }
        } else {
          console.error("Missing required data for attestation creation");
          setVerificationStatus("Missing required data for attestation creation");
        }
      } catch (error) {
        console.error("Error creating X/Twitter attestation:", error);
        setVerificationStatus("Error creating attestation. Please try again.");
      } finally {
        setIsUrlVerifying(false);
      }
    } else {
      console.error("Missing required context for attestation creation");
      setVerificationStatus("Missing required context for attestation creation");
    }
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

        if (proof && fullVc && vcId && chain && indivAccountClient && indivBurnerDelegation && signatory) {
          const socialAttestation: SocialAttestation = {
            entityId: "x(indiv)",
            name: defaultName,
            url: defaultUrl,
            class: "individual",
            schemaId: AttestationService.SocialSchemaUID,
            schema: AttestationService.SocialSchema,
            priority: 12,
            introduction: "Verify your X (Twitter) profile to establish your social media presence and build online credibility.",
            instruction: "Connect your X profile to create a verifiable credential that proves your social media identity.",
            attestation: {
              uid: vcId,
              schemaId: AttestationService.SocialSchemaUID,
              attester: indivAccountClient.address,
              hash: keccak256(toUtf8Bytes(fullVc)),
              vc: fullVc,
              proof: proof,
              vcId: vcId,
              entityId: "x(indiv)",
              name: defaultName,
              url: defaultUrl,
              class: "individual"
            }
          };

          const attestationUid = await AttestationService.addSocialAttestation(chain, socialAttestation, signatory, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          if (attestationUid) {
            // Update conversation if in chat context
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

                  {/* Why X/Twitter Verification is Important Section */}
                  <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                    <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                      Why X (Twitter) Verification Matters
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      X (Twitter) verification helps establish your social media identity and online presence:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Social Identity:</strong> Verifies your social media profile and online presence
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Digital Credibility:</strong> Builds trust with your online community and followers
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Online Reputation:</strong> Establishes your digital identity and social media footprint
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Network Building:</strong> Enhances credibility for online networking and collaborations
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary">
                        <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your social media identity
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      This verification creates a tamper-proof credential that can be shared with your online community, potential collaborators, and stakeholders to establish trust and credibility for your digital presence.
                    </Typography>
                  </Box>

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

                  {/* X/Twitter URL Verification Section */}
                  <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 'medium' }}>
                      Verify this X (Twitter) URL Instead
                    </Typography>
                    <TextField
                      fullWidth
                      label="X (Twitter) URL"
                      variant="outlined"
                      value={xUrl}
                      onChange={(e) => setXUrl(e.target.value)}
                      placeholder="https://x.com/your-username"
                      sx={{ mb: 2 }}
                      disabled={isUrlVerifying}
                    />
                    <Button
                      variant="outlined"
                      color="primary"
                      size="medium"
                      fullWidth
                      onClick={handleUrlVerification}
                      disabled={isUrlVerifying || !xUrl.trim()}
                      sx={{ py: 1 }}
                    >
                      {isUrlVerifying ? "Creating Attestation..." : "Create X Attestation"}
                    </Button>
                    {verificationStatus && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {verificationStatus}
                      </Typography>
                    )}
                  </Box>

                  </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default XModal;
