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
  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [isUrlVerifying, setIsUrlVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");

  const handleClose = () => {
    onClose();
  };

  const handleUrlVerification = async () => {
    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        setIsUrlVerifying(true);
        setVerificationStatus("Creating Shopify attestation...");

        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createWebsiteVC("shopify(org)", orgDid, privateIssuerDid, "Shopify Store", shopifyUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, "shopify(org)", "shopify", orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && orgAccountClient && orgBurnerDelegation && orgIndivDelegation && signatory) {
          const websiteAttestation: WebsiteAttestation = {
            entityId: "shopify(org)",
            name: "Shopify Store",
            url: shopifyUrl,
            class: "organization",
            schemaId: AttestationService.WebsiteSchemaUID,
            schema: AttestationService.WebsiteSchema,
            priority: 15,
            introduction: "Verify your Shopify store to establish your e-commerce presence and build customer trust.",
            instruction: "Connect your Shopify store to create a verifiable credential that proves your business operates a legitimate e-commerce platform.",
            attestation: {
              uid: vcId,
              schemaId: AttestationService.WebsiteSchemaUID,
              attester: orgAccountClient.address,
              hash: keccak256(toUtf8Bytes(fullVc)),
              vc: fullVc,
              proof: proof,
              vcId: vcId,
              entityId: "shopify(org)",
              name: "Shopify Store",
              url: shopifyUrl,
              class: "organization"
            }
          };

          const attestationUid = await AttestationService.addWebsiteAttestation(chain, websiteAttestation, signatory, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

          if (attestationUid) {
            setVerificationStatus("Shopify attestation created successfully!");

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
        console.error("Error creating Shopify attestation:", error);
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
    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        console.info("Creating Shopify attestation with manual data...");

        // Use default values since form fields are removed
        const defaultName = "Shopify Store";
        const defaultUrl = "https://your-store.myshopify.com";

        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createWebsiteVC("shopify(org)", orgDid, privateIssuerDid, defaultName, defaultUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, "shopify(org)", "shopify", orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && orgAccountClient && orgBurnerDelegation && orgIndivDelegation && signatory) {
          const websiteAttestation: WebsiteAttestation = {
            entityId: "shopify(org)",
            name: defaultName,
            url: defaultUrl,
            class: "organization",
            schemaId: AttestationService.WebsiteSchemaUID,
            schema: AttestationService.WebsiteSchema,
            priority: 15,
            introduction: "Verify your Shopify store to establish your e-commerce presence and build customer trust.",
            instruction: "Connect your Shopify store to create a verifiable credential that proves your business operates a legitimate e-commerce platform.",
            attestation: {
              uid: vcId,
              schemaId: AttestationService.WebsiteSchemaUID,
              attester: orgAccountClient.address,
              hash: keccak256(toUtf8Bytes(fullVc)),
              vc: fullVc,
              proof: proof,
              vcId: vcId,
              entityId: "shopify(org)",
              name: defaultName,
              url: defaultUrl,
              class: "organization"
            }
          };

          const attestationUid = await AttestationService.addWebsiteAttestation(chain, websiteAttestation, signatory, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

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

                  {/* Why Shopify Verification is Important Section */}
                  <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                    <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                      Why Shopify Verification Matters
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Shopify verification helps establish your e-commerce business credibility and trust:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>E-commerce Credibility:</strong> Verifies your business operates a legitimate online store
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Customer Trust:</strong> Builds confidence with potential customers and partners
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Business Verification:</strong> Establishes your business as a legitimate e-commerce entity
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Partnership Opportunities:</strong> Enhances credibility for business partnerships and collaborations
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary">
                        <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your e-commerce presence
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      This verification creates a tamper-proof credential that can be shared with customers, partners, and stakeholders to establish trust and credibility for your e-commerce business.
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
                    Create Shopify Attestation
                  </Button>

                  {/* Shopify URL Verification Section */}
                  <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 'medium' }}>
                      Verify this Shopify URL Instead
                    </Typography>
                    <TextField
                      fullWidth
                      label="Shopify URL"
                      variant="outlined"
                      value={shopifyUrl}
                      onChange={(e) => setShopifyUrl(e.target.value)}
                      placeholder="https://your-store.myshopify.com"
                      sx={{ mb: 2 }}
                      disabled={isUrlVerifying}
                    />
                    <Button
                      variant="outlined"
                      color="primary"
                      size="medium"
                      fullWidth
                      onClick={handleUrlVerification}
                      disabled={isUrlVerifying || !shopifyUrl.trim()}
                      sx={{ py: 1 }}
                    >
                      {isUrlVerifying ? "Creating Attestation..." : "Create Shopify Attestation"}
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

export default ShopifyModal;