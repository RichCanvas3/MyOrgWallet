import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, InsuranceAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { TextField, Button, Typography, Box, Paper, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface InsuranceModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const InsuranceModal: React.FC<InsuranceModalProps> = ({isVisible, onClose}) => {
  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [policyNumber, setPolicyNumber] = useState("");
  const [insuranceType, setInsuranceType] = useState("ecommerce");
  const [isCreating, setIsCreating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const insuranceTypes = [
    { value: "ecommerce", label: "E-commerce Insurance" },
    { value: "general", label: "General Liability" },
    { value: "professional", label: "Professional Liability" },
    { value: "cyber", label: "Cyber Liability" },
    { value: "property", label: "Property Insurance" },
    { value: "workers", label: "Workers Compensation" }
  ];

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!policyNumber.trim()) {
      return;
    }

    if (orgAccountClient && chain && orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && veramoAgent && signatory) {
      try {
        setIsCreating(true);
        setProgressMessage("Creating verifiable credential...");
        console.info("Creating insurance attestation...");

        const entityId = "insurance(org)";

        // Create verifiable credential
        setProgressMessage("Creating verifiable credential...");
        const vc = await VerifiableCredentialsService.createInsuranceVC(entityId, orgDid, privateIssuerDid, policyNumber);
        setProgressMessage("Creating credential on blockchain...");
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, policyNumber, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {
          // Create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: InsuranceAttestation = {
            policy: policyNumber,
            type: insuranceType,
            attester: orgDid,
            entityId: entityId,
            class: "organization",
            category: "compliance",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
            proof: proof
          };

          setProgressMessage("Creating attestation on blockchain...");
          const walletSigner = signatory.signer;
          const uid = await AttestationService.addInsuranceAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

          console.info("Insurance attestation created successfully: ", uid);

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
                  content: `✅ Insurance attestation created successfully for policy ${policyNumber}!`
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
        console.error("Error creating insurance attestation:", error);

        let errorMessage = `❌ Failed to create insurance attestation for policy ${policyNumber}.`;

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

  useEffect(() => {
    if (isVisible) {
      // get insurance attestation
      if (orgDid && chain) {
        AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.InsuranceSchemaUID, "insurance(org)", "").then((att) => {
          if (att) {
            setAttestation(att)
          }

          let insuranceAtt = att as InsuranceAttestation

          if (insuranceAtt?.policy) {
            setPolicyNumber(insuranceAtt?.policy)
          }
          if (insuranceAtt?.type) {
            setInsuranceType(insuranceAtt?.type)
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
                Insurance Verification
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
                  Verify Your Organization's Insurance
                </Typography>

                {/* Why Insurance Verification is Important Section */}
                <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                  <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                    Why Insurance Verification Matters
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Insurance verification helps establish your organization's compliance and risk management credentials:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Risk Management:</strong> Demonstrates your organization's commitment to protecting stakeholders
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Compliance Credibility:</strong> Shows adherence to industry standards and regulatory requirements
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Business Trust:</strong> Builds confidence with clients, partners, and investors
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Professional Standards:</strong> Establishes your organization as a responsible business entity
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your insurance coverage
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    This verification creates a tamper-proof credential that can be shared with clients, partners, and stakeholders to establish trust and demonstrate your organization's commitment to risk management and compliance.
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  label="Policy Number"
                  variant="outlined"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="POL-123456789"
                  sx={{ mb: 3 }}
                  disabled={isCreating}
                />

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Insurance Type</InputLabel>
                  <Select
                    value={insuranceType}
                    label="Insurance Type"
                    onChange={(e) => setInsuranceType(e.target.value)}
                    disabled={isCreating}
                  >
                    {insuranceTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleSave}
                  disabled={isCreating || !policyNumber.trim()}
                  sx={{ mb: 2, p: 2, py: 1.5 }}
                >
                  {isCreating ? (progressMessage || "Creating Insurance Attestation...") : "Create Insurance Attestation"}
                </Button>
              </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default InsuranceModal;