import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import axios from 'axios';


import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';

import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { WebsiteAttestation } from '../models/Attestation';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService';

import {SHOPIFY_CLIENT_ID} from "../config";
import { SigningApiFactory } from '@circle-fin/developer-controlled-wallets/dist/types/clients/developer-controlled-wallets';

const SHOP_NAME = "richcanvas"

// const REDIRECT_URI = 'http://localhost:5173/shopifycallback';
// const CALLBACK_URI = 'http://localhost:4000/shopify-callback'
const REDIRECT_URI = import.meta.env.VITE_SHOPIFY_REDIRECT_URI || 'http://localhost:5173/shopifycallback';
const CALLBACK_URI = `${import.meta.env.VITE_API_URL}/shopify-callback` || 'http://localhost:4000/shopify-callback';

interface ShopifyAuthProps {
}

export interface ShopifyAuthRef {
  openShopifyPopup: () => void;
}

const entityId = "shopify(org)"
const ShopifyAuth = forwardRef<ShopifyAuthRef, ShopifyAuthProps>((props, ref) => {

  const { } = props;
  const { chain, signatory, veramoAgent, credentialManager, privateIssuerAccount, burnerAccountClient, orgBurnerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid } = useWallectConnectContext();



  const openShopifyPopup = () => {

    const authUrl = "https://" + SHOP_NAME + ".myshopify.com" + "/admin/oauth/authorize?response_type=code&client_id=" + SHOPIFY_CLIENT_ID + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) + "&scope=&state=state"
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

      if (event.data.type != "shopify_auth") {
          console.info("skip this message: ", event.data.type)
          return; // Skip this message
      }

      window.removeEventListener('message', handleEvent)


      // get shopify data from server given code
      const res = await axios.get(CALLBACK_URI + '?code='+ event.data.code);
      var shopifyUrl = res.data.shop.domain
      var websiteType = "commerce"

              if (orgDid && chain && shopifyUrl && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient && orgBurnerDelegation && orgIndivDelegation && privateIssuerDid) {

        const walletSigner = signatory.signer

        const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC(entityId, orgDid, privateIssuerDid, websiteType, shopifyUrl);
                  const result = await VerifiableCredentialsService.createCredential(vc, entityId, shopifyUrl, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof
        const vcId = result.vcId

        if (fullVc && vcId && walletSigner && orgAccountClient) {
        
          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: WebsiteAttestation = {
            type: websiteType,
            url: res.data.shop.domain,
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

          const uid = await AttestationService.addWebsiteAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
          console.info("add shopify attestation complete")

        }
      }
    }



    // Listen for message from callback
    window.addEventListener('message', handleEvent)

  };

  // Use useImperativeHandle to expose the method to the parent
  useImperativeHandle(ref, () => ({
    openShopifyPopup
  }));


  return (
    <div>
    </div>
  );


});

export default ShopifyAuth;