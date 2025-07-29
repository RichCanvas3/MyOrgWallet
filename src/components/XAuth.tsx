
import axios from 'axios';
import { useImperativeHandle, forwardRef, useEffect  } from 'react';
import { ethers } from 'ethers';

import { useWallectConnectContext } from "../context/walletConnectContext";

import { keccak256, toUtf8Bytes } from 'ethers';
import ConversationService from "../service/ConversationService"
import {ChatMessage, MessageType, Role} from "../models/ChatCompletion";

import AttestationService from '../service/AttestationService';
import { SocialAttestation } from '../models/Attestation'

import VerifiableCredentialsService from '../service/VerifiableCredentialsService'
import {X_CLIENT_ID} from "../config";
import { chainConfig } from 'viem/zksync';
import { SigningApiFactory } from '@circle-fin/developer-controlled-wallets/dist/types/clients/developer-controlled-wallets';

interface XProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}



// const REDIRECT_URI = 'http://localhost:5173/xcallback';

// const CALLBACK_URI = 'http://localhost:4000/x-callback'
const REDIRECT_URI = import.meta.env.VITE_X_REDIRECT_URI || 'http://localhost:5173/xcallback';
const CALLBACK_URI = `${import.meta.env.VITE_API_URL}/x-callback` || 'http://localhost:4000/x-callback';

interface XAuthProps {
}

export interface XAuthRef {
  openXPopup: () => void;
}

const entityId = "x(indiv)"
const XAuth = forwardRef<XAuthRef, XAuthProps>((props, ref) => {


  const { } = props;
  const { chain, signatory, veramoAgent, credentialManager, privateIssuerAccount, burnerAccountClient, indivBurnerDelegation, orgAccountClient, orgDid, privateIssuerDid } = useWallectConnectContext();



  function generateRandomString(length: number) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
      .slice(0, length);
  }

  const codeVerifier = generateRandomString(50); // 43-128 characters


  const openXPopup = () => {


    const codeChallenge = codeVerifier; // For plain method, they’re the same


    const authUrl = 'https://x.com/i/oauth2/authorize?response_type=code&client_id=' + X_CLIENT_ID + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&scope=tweet.read%20users.read%20follows.read%20offline.access&state=state&code_challenge=' + codeChallenge + '&code_challenge_method=plain'
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
                content: "Closing X verification popup...",
              };

              const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg];
              const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]];

              console.info("Adding X popup close message");
              ConversationService.updateConversation(conversation, msgs2);
            }
          });
        }
      }
    }, 1000); // Check every second

    const handleEvent = async (event: MessageEvent) => {

      if (event.data.type != "x_auth") {
        console.info("Skipping message: ", event.data.type)
        return; // Skip this message
      }

      window.removeEventListener('message', handleEvent)
      clearInterval(checkPopupClosed); // Clean up the interval since OAuth completed

      const res = await axios.get(CALLBACK_URI + '?code='+ event.data.code + '&verifier=' + codeVerifier);


      let name = res["data"]["data"]["name"]
      let url = "https://x.com/" + res["data"]["data"]["username"]


      if (orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient) {

        const vc = await VerifiableCredentialsService.createSocialVC(entityId, orgDid, privateIssuerDid, name, url);
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, entityId, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof
        const vcId = result.vcId

        if (proof && fullVc && vcId && chain && orgAccountClient && indivIssuerDelegation) {
          // add attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: SocialAttestation = {
            attester: orgDid,
            entityId: entityId,
            class: "individual",
            category: "identity",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
            proof: proof,
            name: name,
            url: url
          };

          const walletSigner = signatory.signer

          const uid = AttestationService.addSocialAttestation(chain, attestation, walletSigner, [indivBurnerDelegation], orgAccountClient, burnerAccountClient)
          console.info("add social attestation complete")

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
                  content: "I've updated your wallet with a verifiable credential and published your x attestation.",
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
    openXPopup,
  }));



  return (
    <div>
    </div>
  );


});

export default XAuth;