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
  onProgressUpdate?: (step: number, message: string, status?: string) => void;
  onVerificationComplete?: () => void;
}


const LinkedinModal: React.FC<LinkedinModalProps> = ({isVisible, onClose, onOAuthTrigger, onProgressUpdate, onVerificationComplete}) => {

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { chain, indivDid, indivAccountClient, privateIssuerDid, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, veramoAgent, signatory } = useWallectConnectContext();


  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isUrlVerifying, setIsUrlVerifying] = useState(false);

  // Function to update progress from external components
  const updateProgress = (step: number, message: string, status?: string) => {
    setCurrentStep(step);
    setProgressMessage(message);
    if (status) {
      setVerificationStatus(status);
    }
    // Call external progress update callback if provided
    if (onProgressUpdate) {
      onProgressUpdate(step, message, status);
    }
  };

  // Function to complete the verification process
  const completeVerification = () => {
    setCurrentStep(totalSteps);
    setProgressMessage("LinkedIn verification completed successfully!");
    setVerificationStatus("Your LinkedIn attestation has been created and added to your wallet.");
    // Call external completion callback if provided
    if (onVerificationComplete) {
      onVerificationComplete();
    }
    setTimeout(() => {
      setIsVerifying(false);
      onClose();
    }, 2000);
  };


  const handleClose = () => {
    onClose();
  };

  const handleOAuthTrigger = async () => {
    try {
      setIsVerifying(true);
      setCurrentStep(1);
      setProgressMessage("Initiating LinkedIn OAuth process...");

      // Call the OAuth trigger immediately
      if (onOAuthTrigger) {
        setCurrentStep(2);
        setProgressMessage("Opening LinkedIn authentication popup...");
        onOAuthTrigger();
      }

      // Note: The actual OAuth flow and attestation creation will be handled
      // by the LinkedInAuth component, which should update the progress
      setCurrentStep(3);
      setProgressMessage("Waiting for LinkedIn authentication...");

    } catch (error) {
      console.error("Error triggering LinkedIn OAuth:", error);
      setProgressMessage("Error: " + (error as Error).message);
      setIsVerifying(false);
    }
  };

  const handleUrlVerification = async () => {
    if (!linkedinUrl.trim()) {
      setVerificationStatus("Please enter a LinkedIn URL");
      return;
    }

    if (indivAccountClient && chain && indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && indivBurnerDelegation && veramoAgent && signatory) {
      try {
        setIsUrlVerifying(true);
        setVerificationStatus("Creating LinkedIn attestation with provided URL...");

        console.info("Creating LinkedIn attestation with URL:", linkedinUrl);

        // Create verifiable credential with the provided URL
        const vc = await VerifiableCredentialsService.createSocialVC("linkedin(indiv)", indivDid, privateIssuerDid, "LinkedIn Profile", linkedinUrl);
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
            name: "LinkedIn Profile",
            url: linkedinUrl,
            displayName: "linkedin"
          };

          const walletSigner = signatory.signer;
          const uid = await AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          console.info("LinkedIn attestation created successfully: ", uid);

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

          setVerificationStatus("LinkedIn attestation created successfully!");
          setTimeout(() => {
            setIsUrlVerifying(false);
            onClose();
          }, 2000);
        } else {
          console.error("Missing required data for attestation creation");
          setVerificationStatus("Error: Missing required data for attestation creation");
          setIsUrlVerifying(false);
        }
      } catch (error) {
        console.error("Error creating LinkedIn attestation:", error);
        setVerificationStatus("Error: " + (error as Error).message);
        setIsUrlVerifying(false);
      }
    } else {
      console.error("Missing required context for attestation creation");
      setVerificationStatus("Error: Missing required context for attestation creation");
      setIsUrlVerifying(false);
    }
  };

  const handleSave = async () => {
    if (indivAccountClient && chain && indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && burnerAccountClient && indivBurnerDelegation && veramoAgent && signatory) {
      try {
        console.info("Creating LinkedIn attestation with manual data...");

        // Use default values since form fields are removed
        const defaultName = "LinkedIn Profile";
        const defaultUrl = "https://www.linkedin.com/in/profile";

        // Create verifiable credential
        const vc = await VerifiableCredentialsService.createSocialVC("linkedin(indiv)", indivDid, privateIssuerDid, defaultName, defaultUrl);
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

          const walletSigner = signatory.signer;
          const uid = await AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], indivAccountClient, burnerAccountClient);

          console.info("LinkedIn attestation created successfully: ", uid);

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
        }
      } catch (error) {
        console.error("Error creating LinkedIn attestation:", error);
      }
    } else {
      console.error("Missing required context for attestation creation");
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
    // Listen for progress updates from LinkedInAuth
    const handleProgressUpdate = (event: CustomEvent) => {
      const { step, message, status } = event.detail;
      updateProgress(step, message, status);
    };

    const handleVerificationComplete = () => {
      completeVerification();
    };

    window.addEventListener('linkedin-progress-update', handleProgressUpdate as EventListener);
    window.addEventListener('linkedin-verification-complete', handleVerificationComplete);

    return () => {
      window.removeEventListener('linkedin-progress-update', handleProgressUpdate as EventListener);
      window.removeEventListener('linkedin-verification-complete', handleVerificationComplete);
    };
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

                  {/* Why LinkedIn Verification is Important Section */}
                  <Box sx={{ mb: 3, p: 3, backgroundColor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                    <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
                      Why LinkedIn Verification Matters
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      LinkedIn verification helps establish your professional identity and credibility in the digital world:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Professional Identity:</strong> Verifies your professional profile and work history
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Network Trust:</strong> Builds credibility with your professional network and connections
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Career Opportunities:</strong> Enhances your profile for job searches and business opportunities
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Business Relationships:</strong> Establishes trust with potential clients, partners, and collaborators
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary">
                        <strong>Digital Credentials:</strong> Creates a verifiable, blockchain-based proof of your professional identity
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      This verification creates a tamper-proof credential that can be shared with your professional network, potential employers, and business partners to establish trust and credibility.
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleOAuthTrigger}
                    disabled={isVerifying}
                    sx={{ mb: 2, p: 2, py: 1.5 }}
                  >
                    {isVerifying ? "Verifying..." : "Create LinkedIn Attestation"}
                  </Button>

                  {/* LinkedIn URL Verification Section */}
                  <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 'medium' }}>
                      Verify this LinkedIn URL Instead
                    </Typography>
                    <TextField
                      fullWidth
                      label="LinkedIn URL"
                      variant="outlined"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/in/your-profile"
                      sx={{ mb: 2 }}
                      disabled={isUrlVerifying}
                    />
                    <Button
                      variant="outlined"
                      color="primary"
                      size="medium"
                      fullWidth
                      onClick={handleUrlVerification}
                      disabled={isUrlVerifying || !linkedinUrl.trim()}
                      sx={{ py: 1 }}
                    >
                      {isUrlVerifying ? "Creating Attestation..." : "Create LinkedIn Attestation"}
                    </Button>
                    {verificationStatus && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {verificationStatus}
                      </Typography>
                    )}
                  </Box>

                  {isVerifying && (
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#e0f2f7', borderRadius: 1, border: '1px solid #b6effb' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Step {currentStep} of {totalSteps}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                        {progressMessage}
                      </Typography>
                      {verificationStatus && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                          {verificationStatus}
                        </Typography>
                      )}
                    </Box>
                  )}

                  </Paper>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default LinkedinModal;
