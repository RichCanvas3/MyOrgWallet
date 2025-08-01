

import axios from 'axios';
import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService'
import AttestationService from '../service/AttestationService';
import {SocialAttestation} from '../models/Attestation';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

import { useWallectConnectContext } from "../context/walletConnectContext";
import ConversationService from "../service/ConversationService"
import {ChatMessage, MessageType, Role} from "../models/ChatCompletion";

import { keccak256, toUtf8Bytes } from 'ethers';


interface LinkedInProfile {
  sub: string; // LinkedIn user ID
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

import {LINKEDIN_CLIENT_ID} from "../config";
import { SigningApiFactory } from '@circle-fin/developer-controlled-wallets/dist/types/clients/developer-controlled-wallets';

// const REDIRECT_URI = 'http://localhost:5173/linkedincallback';
// const SCOPES = 'profile email openid';

// const CALLBACK_URI = 'http://localhost:4000/linkedin-callback'

// Use environment variables for redirect URIs
const REDIRECT_URI = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || 'http://localhost:5173/linkedincallback';
const SCOPES = 'profile email openid';
const CALLBACK_URI = `${import.meta.env.VITE_API_URL}/linkedin-callback` || 'http://localhost:4000/linkedin-callback';

interface LinkedInAuthProps {
  onProgressUpdate?: (step: number, message: string, status?: string) => void;
  onVerificationComplete?: () => void;
}

export interface LinkedInAuthRef {
  openLinkedInPopup: () => void;
}

const entityId = "linkedin(indiv)";
const LinkedInAuth = forwardRef<LinkedInAuthRef, LinkedInAuthProps>((props, ref) => {


  const { onProgressUpdate, onVerificationComplete } = props;
  const { chain, signatory, veramoAgent, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, indivAccountClient, indivDid, privateIssuerDid } = useWallectConnectContext();


  const openLinkedInPopup = () => {
    // Update progress to step 2 - Opening popup
    if (onProgressUpdate) {
      onProgressUpdate(2, "Opening LinkedIn authentication popup...");
    }

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "_blank",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
      return;
    }

    // Check if popup is closed and add chat message
    const checkPopupClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopupClosed);

        // Add chat message about closing OAuth popup
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
                content: "Closing LinkedIn verification popup...",
              };

              const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg];
              const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]];

              console.info("Adding LinkedIn popup close message");
              ConversationService.updateConversation(conversation, msgs2);
            }
          });
        }
      }
    }, 1000); // Check every second

    const handleEvent = async (event: MessageEvent) => {

        if (event.data.type != "linkedin_auth") {
          // console.info("Skipping message: ", event.data.type)
          return; // Skip this message
        }

        window.removeEventListener('message', handleEvent)
        clearInterval(checkPopupClosed); // Clean up the interval since OAuth completed

        // Update progress to step 3 - Processing authentication
        if (onProgressUpdate) {
          onProgressUpdate(3, "Processing LinkedIn authentication...");
        }

        const res = await axios.get(CALLBACK_URI + '?code='+ event.data.code);

        console.info("linkedin response: ", res.data)
        console.info(res.data.given_name)
        console.info(res.data.family_name)
        console.info(res.data.email)
        console.info(res.data.picture)

        console.info("indivBurnerDelegation: ", indivBurnerDelegation)
        console.info("add social: ", indivDid,privateIssuerDid,credentialManager,indivAccountClient,burnerAccountClient,indivBurnerDelegation)

        // Update progress to step 4 - Creating attestation
        if (onProgressUpdate) {
          onProgressUpdate(4, "Creating LinkedIn attestation...");
        }

        if (indivDid && privateIssuerDid && credentialManager && privateIssuerAccount && indivAccountClient && burnerAccountClient && indivBurnerDelegation) {
          const vc = await VerifiableCredentialsService.createSocialVC(entityId, indivDid, privateIssuerDid, res.data.sub, "");
                      const result = await VerifiableCredentialsService.createCredential(vc, entityId, "linkedin", indivDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
          const fullVc = result.vc
          const proof = result.proof
          const vcId = result.vcId

          if (proof && fullVc && vcId && chain && indivAccountClient && indivBurnerDelegation) {
            // add attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: SocialAttestation = {
              attester: indivDid,
              entityId: entityId,
              class: "individual",
              category: "identity",
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              vcid: vcId,
              proof: proof,
              name: `${res.data.given_name} ${res.data.family_name}`,
              url: `https://www.linkedin.com/in/${res.data.sub}`,
              displayName: "linkedin"
            };


            const walletSigner = signatory.signer
            const uid = await AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], indivAccountClient, burnerAccountClient)
            console.info(">>>>>>>>>>>>>>>>>  added attestation complete: ", uid)

            // Call completion callback
            if (onVerificationComplete) {
              onVerificationComplete();
            }

            if (location.pathname.startsWith("/chat/c/")) {
              let conversationId = location.pathname.replace("/chat/c/", "")
              let id = parseInt(conversationId)
              ConversationService.getConversationById(id).then((conversation) => {
                if (conversation) {

                  var currentMsgs: ChatMessage[] = JSON.parse(conversation.messages);

                  const newMsg: ChatMessage = {
                    id: currentMsgs.length + 1,
                    args: "",
                    role: Role.Developer,
                    messageType: MessageType.Normal,
                    content: "I've updated your wallet with a verifiable credential and published your linkedin attestation.",
                  };

                  const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg]
                  const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]]

                  console.info("update conversation message ")
                  ConversationService.updateConversation(conversation, msgs2)
                }
              })

            }

          }
        }
    }


    // Listen for message from callback
    window.addEventListener('message', handleEvent)
  };


  // Use useImperativeHandle to expose the method to the parent
  useImperativeHandle(ref, () => ({
    openLinkedInPopup
  }));



  return (
    <div>
    </div>
  );


});

export default LinkedInAuth;