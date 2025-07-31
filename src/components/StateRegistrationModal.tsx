import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, StateRegistrationAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { TextField, Button, Typography, Box, Paper, MenuItem } from "@mui/material";
import { useAccount } from 'wagmi';
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';

interface StateRegistrationModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const StateRegistrationModal: React.FC<StateRegistrationModalProps> = ({isVisible, onClose}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient, orgDid, orgAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, veramoAgent, signatory, orgName } = useWallectConnectContext();

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [state, setState] = useState("delaware");
  const [isVerifying, setIsVerifying] = useState(false);

  // List of all US states
  const states = [
    { value: "alabama", label: "Alabama" },
    { value: "alaska", label: "Alaska" },
    { value: "arizona", label: "Arizona" },
    { value: "arkansas", label: "Arkansas" },
    { value: "california", label: "California" },
    { value: "colorado", label: "Colorado" },
    { value: "connecticut", label: "Connecticut" },
    { value: "delaware", label: "Delaware" },
    { value: "florida", label: "Florida" },
    { value: "georgia", label: "Georgia" },
    { value: "hawaii", label: "Hawaii" },
    { value: "idaho", label: "Idaho" },
    { value: "illinois", label: "Illinois" },
    { value: "indiana", label: "Indiana" },
    { value: "iowa", label: "Iowa" },
    { value: "kansas", label: "Kansas" },
    { value: "kentucky", label: "Kentucky" },
    { value: "louisiana", label: "Louisiana" },
    { value: "maine", label: "Maine" },
    { value: "maryland", label: "Maryland" },
    { value: "massachusetts", label: "Massachusetts" },
    { value: "michigan", label: "Michigan" },
    { value: "minnesota", label: "Minnesota" },
    { value: "mississippi", label: "Mississippi" },
    { value: "missouri", label: "Missouri" },
    { value: "montana", label: "Montana" },
    { value: "nebraska", label: "Nebraska" },
    { value: "nevada", label: "Nevada" },
    { value: "new-hampshire", label: "New Hampshire" },
    { value: "new-jersey", label: "New Jersey" },
    { value: "new-mexico", label: "New Mexico" },
    { value: "new-york", label: "New York" },
    { value: "north-carolina", label: "North Carolina" },
    { value: "north-dakota", label: "North Dakota" },
    { value: "ohio", label: "Ohio" },
    { value: "oklahoma", label: "Oklahoma" },
    { value: "oregon", label: "Oregon" },
    { value: "pennsylvania", label: "Pennsylvania" },
    { value: "rhode-island", label: "Rhode Island" },
    { value: "south-carolina", label: "South Carolina" },
    { value: "south-dakota", label: "South Dakota" },
    { value: "tennessee", label: "Tennessee" },
    { value: "texas", label: "Texas" },
    { value: "utah", label: "Utah" },
    { value: "vermont", label: "Vermont" },
    { value: "virginia", label: "Virginia" },
    { value: "washington", label: "Washington" },
    { value: "west-virginia", label: "West Virginia" },
    { value: "wisconsin", label: "Wisconsin" },
    { value: "wyoming", label: "Wyoming" }
  ];

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    setIsVerifying(true);

    try {
      console.info("Verifying company with LangChain...");

      // Send to LangChain for verification
      const BASE_URL = import.meta.env.VITE_ORGSERVICE_API_URL || 'http://localhost:8501';
      const response = await fetch(
        `${BASE_URL}/creds/good-standing/company?company=${encodeURIComponent(orgName || "verified")}&state=${state}`
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("LangChain verification failed:", response.status, text);
        throw new Error(`Verification failed: ${response.status} - ${text}`);
      }

      const verificationData = await response.json();
      console.info("LangChain verification successful:", verificationData);

            if (!orgDid || !privateIssuerDid || !credentialManager || !privateIssuerAccount || !burnerAccountClient || !orgBurnerDelegation || !orgIndivDelegation || !veramoAgent || !signatory) {
        throw new Error("Missing required context for attestation creation");
      }

              // Create verifiable credential for state registration
        const vc = await VerifiableCredentialsService.createStateRegistrationVC(
          "state-registration(org)",
          orgDid,
          privateIssuerDid,
          verificationData.id || "verified",
          orgName || "verified",
          verificationData.status || "active",
          verificationData.formationDate || new Date().toISOString().split('T')[0],
          state,
          verificationData.address || "verified address"
        );

      const result = await VerifiableCredentialsService.createCredential(
        vc,
        "state-registration(org)",
        "state-registration",
        orgDid,
        credentialManager,
        privateIssuerAccount,
        burnerAccountClient,
        veramoAgent
      );

      const fullVc = result.vc;
      const proof = result.proof;
      const vcId = result.vcId;

      if (fullVc && vcId && chain && orgAccountClient) {
        // Create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: StateRegistrationAttestation = {
          attester: orgDid,
          entityId: "state-registration(org)",
          class: "organization",
          category: "identity",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          vcid: vcId,
          proof: proof,
          name: orgName || "verified",
          idnumber: verificationData.id || "verified",
          status: verificationData.status || "active",
          formationdate: new Date(verificationData.formationDate || new Date()).getTime() / 1000,
          locationaddress: verificationData.address || "verified address",
          displayName: "state-registration"
        };

        const walletSigner = signatory.signer;
        const uid = await AttestationService.addStateRegistrationAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient);

        console.info("State Registration attestation created successfully: ", uid);

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
                content: `I've verified your organization with LangChain and updated your wallet with a verifiable credential and published your State Registration attestation.`,
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
      console.error("Error creating State Registration attestation:", error);
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
              role: Role.Developer,
              messageType: MessageType.Normal,
              content: `Failed to verify ${name} with LangChain. Please check the company name and try again.`,
            };

            const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg];
            const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]];

            console.info("Updating conversation with error message");
            ConversationService.updateConversation(conversation, msgs2);
          }
        });
      }
    } finally {
      setIsVerifying(false);
    }
  }

  useEffect(() => {
    if (isVisible) {
      // get state registration attestation
      if (indivDid && chain) {
        AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.StateRegistrationSchemaUID, "stateRegistration(org)", "").then((att) => {
          if (att) {
            setAttestation(att)
          }

          let stateRegAtt = att as StateRegistrationAttestation

          // Company name is now derived from orgName context
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
                State Registration Verification
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

                  {/* Information Section */}
                  <Box sx={{ mb: 3, p: 3, backgroundColor: "#f8f9fa", borderRadius: 2, border: "1px solid #e9ecef" }}>
                    <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                      Why State Registration Verification?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      State registration verification is a crucial step in establishing your organization's legitimacy and trustworthiness. Here's why it matters:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Legal Compliance:</strong> Confirms your business is properly registered with state authorities
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Trust Building:</strong> Demonstrates to partners and customers that your organization operates legally
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Credibility:</strong> Provides verifiable proof of your business's official status and formation date
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Blockchain Verification:</strong> Creates an immutable attestation that can be verified by anyone
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      This verification will create a permanent, tamper-proof record of your state registration on the blockchain, enhancing your organization's digital identity and reputation.
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3, p: 2, border: "1px solid #ddd", borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                      State
                    </Typography>

                    <TextField
                      select
                      label="State"
                      variant="outlined"
                      fullWidth
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      disabled={isVerifying}
                    >
                      {states.map((stateOption) => (
                        <MenuItem key={stateOption.value} value={stateOption.value}>
                          {stateOption.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleSave}
                    disabled={isVerifying}
                    sx={{ mb: 3, p: 2, py: 1.5 }}
                  >
                    {isVerifying ? "Verifying..." : "Verify & Create Attestation"}
                  </Button>

                  </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default StateRegistrationModal;