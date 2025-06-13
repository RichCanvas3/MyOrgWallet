import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';

import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { InsuranceAttestation } from '../models/Attestation';
import { useWalletClient, useAccount } from 'wagmi';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


interface InsuranceAuthProps {
}

export interface InsuranceAuthRef {
  openInsurancePopup: () => void;
}


const entityId = "insurance"
const InsuranceAuth = forwardRef<InsuranceAuthRef, InsuranceAuthProps>((props, ref) => {

  const { } = props;
  const { chain, veramoAgent, mascaApi, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();


  

  const openInsurancePopup = async () => {

    console.info("############## inside open insurance popup")

      var insuranceNumber = "10"
      if (privateIssuerAccount && orgDid && insuranceNumber && walletClient && orgAccountClient && burnerAccountClient && privateIssuerDid) {

        const vc = await VerifiableCredentialsService.createInsuranceVC(orgDid, privateIssuerDid, insuranceNumber);

        console.info("vc: ", JSON.stringify(vc))
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof
        if (proof && fullVc && chain && orgAccountClient && orgIssuerDelegation && orgIndivDelegation && walletClient) {
        
          const provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const walletSigner = await provider.getSigner()

          // now create attestation
          console.info("create attestation")
          const hash = keccak256(toUtf8Bytes("hash value"));
          const timestamp = Date.now();
          const attestation: InsuranceAttestation = {
            policy: insuranceNumber,
            type: "ecommerce",
            attester: orgDid,
            entityId: entityId,
            class: "organization",
            category: "certificate",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            proof: proof
          };

          const uid = await AttestationService.addInsuranceAttestation(chain, attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
          console.info("add insurance attestation complete")


        }

      }


    }





  // Use useImperativeHandle to expose the method to the parent
  useImperativeHandle(ref, () => ({
    openInsurancePopup,
  }));



  return (
    <div>
    </div>
  );


});

export default InsuranceAuth;