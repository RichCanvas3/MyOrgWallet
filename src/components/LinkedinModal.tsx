import {useEffect, useRef, useState} from 'react';
import * as React from 'react';

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import {Attestation, SocialAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from "wagmi"
import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import { keccak256, toUtf8Bytes } from 'ethers';
import VerifiableCredentialsService from '../service/VerifiableCredentialsService';
import ConversationService from '../service/ConversationService';
import { ChatMessage, Role, MessageType } from '../models/ChatCompletion';



interface LinkedinModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOAuthTrigger?: () => void;
}


const LinkedinModal: React.FC<LinkedinModalProps> = ({isVisible, onClose, onOAuthTrigger}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, veramoAgent, signatory } = useWallectConnectContext();


  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");


  const handleClose = () => {
    onClose();
  };



  const handleSave = async () => {
    if (indivAccountClient && chain && indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && indivBurnerDelegation && veramoAgent && signatory) {
      try {
        setIsVerifying(true);
        setVerificationStatus("Initializing LinkedIn verification...");
        console.info("Creating LinkedIn attestation with manual data...");

        // Use default values since form fields are removed
        const defaultName = "LinkedIn Profile";
        const defaultUrl = "https://www.linkedin.com/in/profile";

        setVerificationStatus("Creating verifiable credential...");
        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createSocialVC("linkedin(indiv)", indivDid, privateIssuerDid, defaultName, defaultUrl);
        setVerificationStatus("Generating credential proof...");
        const result = await VerifiableCredentialsService.createCredential(vc, "linkedin(indiv)", "linkedin", indivDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent);

        const fullVc = result.vc;
        const proof = result.proof;
        const vcId = result.vcId;

        if (proof && fullVc && vcId && chain && indivAccountClient && indivBurnerDelegation) {
          // Create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: SocialAttestation = {
            attester: indivDid,
            entityId: "linkedin(indiv)",
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
            displayName: "linkedin"
          };

          setVerificationStatus("Publishing attestation to blockchain...");
          const walletSigner = signatory.signer;
          const uid = await AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          console.info("LinkedIn attestation created successfully: ", uid);
          setVerificationStatus("LinkedIn verification completed successfully!");

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
                  content: "I've updated your wallet with a verifiable credential and published your LinkedIn attestation.",
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
          setVerificationStatus("Error: Missing required data for attestation creation");
        }
      } catch (error) {
        console.error("Error creating LinkedIn attestation:", error);
        setVerificationStatus("Error: Failed to create LinkedIn attestation");
      } finally {
        setIsVerifying(false);
      }
    } else {
      console.error("Missing required context for attestation creation");
      setVerificationStatus("Error: Missing required context for attestation creation");
      setIsVerifying(false);
    }
  }


  useEffect(() => {

    if (isVisible) {
      // get linkedin attestation
      if (indivDid && chain && indivAccountClient) {
        AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.SocialSchemaUID, "linkedin(indiv)", "").then((att) => {
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
                LinkedIn Verification
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
                      Why LinkedIn Verification?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      LinkedIn verification is a powerful way to establish your professional identity and credibility in the digital world. Here's why it matters:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Professional Identity:</strong> Validates your professional background and work experience
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Network Trust:</strong> Demonstrates your connections and professional relationships
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Credibility:</strong> Provides verifiable proof of your professional qualifications and endorsements
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Digital Reputation:</strong> Creates an immutable record of your professional achievements
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      This verification will create a permanent, tamper-proof record of your LinkedIn profile on the blockchain, enhancing your digital identity and professional reputation.
                    </Typography>
                  </Box>

                  {verificationStatus && (
                    <Box sx={{ mb: 2, p: 2, backgroundColor: isVerifying ? "#e3f2fd" : "#f3e5f5", borderRadius: 2, border: "1px solid #e0e0e0" }}>
                      <Typography variant="body2" color="text.secondary" align="center">
                        {verificationStatus}
                      </Typography>
                    </Box>
                  )}

                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={onOAuthTrigger}
                    disabled={isVerifying}
                    sx={{ mb: 2, p: 2, py: 1.5 }}
                  >
                    {isVerifying ? "Verifying..." : "Create LinkedIn Attestation"}
                  </Button>

                  </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default LinkedinModal;
