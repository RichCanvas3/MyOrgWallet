import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import axios from 'axios';


import { keccak256, toUtf8Bytes } from 'ethers';


import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { WebsiteAttestation } from '../models/Attestation';
import { useWalletClient } from 'wagmi';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


const SHOP_NAME = "richcanvas"
const CLIENT_ID = '6fba28568597ea67cce09b4ff35f2a8e'; // Replace with your LinkedIn Client ID
const REDIRECT_URI = 'http://localhost:5173/shopifycallback';
const CALLBACK_URI = 'http://localhost:4000/shopify-callback'


interface ShopifyAuthProps {
}

export interface ShopifyAuthRef {
  openShopifyPopup: () => void;
}

const entityId = "shopify"
const ShopifyAuth = forwardRef<ShopifyAuthRef, ShopifyAuthProps>((props, ref) => {

  const { } = props;
  const { issuerAccountClient, signer, delegation, orgAccountClient, orgDelegateClient, session, orgDid } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  const openShopifyPopup = () => {

    const authUrl = "https://" + SHOP_NAME + ".myshopify.com" + "/admin/oauth/authorize?response_type=code&client_id=" + CLIENT_ID + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) + "&scope=&state=state"
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

      if (orgDid && shopifyUrl && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

        const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC(entityId, orgDid, websiteType, shopifyUrl);
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
        const fullVc = result.vc
        const proofUrl = result.proofUrl
        if (fullVc && signer && orgAccountClient && walletClient) {
        
          // now create attestation
          const hash = keccak256(toUtf8Bytes("hash value"));
          const attestation: WebsiteAttestation = {
            type: websiteType,
            url: res.data.shop.domain,
            attester: orgDid,
            entityId: entityId,
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: VerifiableCredentialsService.issuerDid,
            proof: proofUrl
          };

          const uid = await AttestationService.addWebsiteAttestation(attestation, signer, delegation, orgAccountClient, orgDelegateClient)
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