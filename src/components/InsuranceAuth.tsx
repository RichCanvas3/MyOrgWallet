import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'ethers';

import { useWallectConnectContext } from "../context/walletConnectContext";
import { getSignerFromSignatory } from "../signers/SignatoryTypes";
import AttestationService from '../service/AttestationService';
import { InsuranceAttestation } from '../models/Attestation';


import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


interface InsuranceAuthProps {
}

export interface InsuranceAuthRef {
  openInsurancePopup: () => void;
}


const entityId = "insurance(org)"
const InsuranceAuth = forwardRef<InsuranceAuthRef, InsuranceAuthProps>((props, ref) => {

  const { } = props;
  const { chain, veramoAgent, credentialManager, privateIssuerAccount, burnerAccountClient, orgIssuerDelegation, orgIndivDelegation, orgAccountClient, orgDid, privateIssuerDid, signatory } = useWallectConnectContext();



  

  const openInsurancePopup = async () => {

    console.info("############## inside open insurance popup")

      var insuranceNumber = "10"
      if (privateIssuerAccount && orgDid && insuranceNumber && orgAccountClient && burnerAccountClient && privateIssuerDid) {

        const vc = await VerifiableCredentialsService.createInsuranceVC(entityId, orgDid, privateIssuerDid, insuranceNumber);

        console.info("vc: ", JSON.stringify(vc))
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, insuranceNumber, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
        const fullVc = result.vc
        const proof = result.proof
        const vcId = result.vcId
        if (proof && fullVc && vcId && chain && orgAccountClient && orgIssuerDelegation && orgIndivDelegation) {
        
                            // Use the signer directly from signatory
          const walletSigner = signatory.signer;
          
          if (!walletSigner) {
            console.error("Failed to get wallet signer");
            return;
          }

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
            category: "compliance",
            hash: hash,
            vccomm: (fullVc.credentialSubject as any).commitment.toString(),
            vcsig: (fullVc.credentialSubject as any).commitmentSignature,
            vciss: privateIssuerDid,
            vcid: vcId,
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