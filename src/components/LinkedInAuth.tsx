

import axios from 'axios';
import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService'
import AttestationService from '../service/AttestationService';
import {SocialAttestation} from '../models/Attestation';
import { useWalletClient } from 'wagmi';

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


const CLIENT_ID = '86qujvwkyvmcpv'; // Replace with your LinkedIn Client ID
const REDIRECT_URI = 'http://localhost:5173/linkedincallback';
const SCOPES = 'profile email openid';

const CALLBACK_URI = 'http://localhost:4000/linkedin-callback'



interface LinkedInAuthProps {
}

export interface LinkedInAuthRef {
  openLinkedInPopup: () => void;
}

const entityId = "linkedin";
const LinkedInAuth = forwardRef<LinkedInAuthRef, LinkedInAuthProps>((props, ref) => {

  
  const { } = props;
  const { issuerAccountClient, signer, indivIssuerDelegation, indivAccountClient, session, indivDid, issuerDid } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();


  const openLinkedInPopup = () => {

  
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
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

    const handleEvent = async (event: MessageEvent) => {
        
        if (event.data.type != "linkedin_auth") {
          console.info("skip this message: ", event.data.type)
          return; // Skip this message
        }

        window.removeEventListener('message', handleEvent)

        const res = await axios.get(CALLBACK_URI + '?code='+ event.data.code);

        console.info("linkedin response ...........")
        console.info(res.data.given_name)
        console.info(res.data.family_name)
        console.info(res.data.email)
        console.info(res.data.picture)

        if (indivDid && issuerDid && walletClient && indivAccountClient && issuerAccountClient && indivIssuerDelegation && session && signer) {
  
          const vc = await VerifiableCredentialsService.createSocialVC(entityId, indivDid, issuerDid, res.data.sub, "");
          const result = await VerifiableCredentialsService.createCredential(vc, entityId, indivDid, walletClient, issuerAccountClient, session)
          const fullVc = result.vc
          const proofUrl = result.proofUrl

          if (fullVc && signer && indivAccountClient && indivIssuerDelegation) {
          
            // add attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: SocialAttestation = {
              attester: indivDid,
              entityId: entityId,
              class: "individual", 
              category: "social",
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: issuerDid,
              proof: proofUrl,
              name: "",
              url: ""
            };
  
            console.info("proof url: ", proofUrl)
            const uid = await AttestationService.addSocialAttestation(attestation, signer, indivIssuerDelegation, indivAccountClient, issuerAccountClient)
          
            console.info(">>>>>>>>>>>>>>>>>  added attestation complete: ", uid)

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