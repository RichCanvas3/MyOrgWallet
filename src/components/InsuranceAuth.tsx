import { useImperativeHandle, forwardRef, useEffect  } from 'react';

import { keccak256, toUtf8Bytes } from 'ethers';


import { useWallectConnectContext } from "../context/walletConnectContext";
import AttestationService from '../service/AttestationService';
import { InsuranceAttestation } from '../models/Attestation';
import { useWalletClient } from 'wagmi';

import VerifiableCredentialsService from '../service/VerifiableCredentialsService';


interface InsuranceAuthProps {
}

export interface InsuranceAuthRef {
  openInsurancePopup: () => void;
}


const entityId = "insurance"
const InsuranceAuth = forwardRef<InsuranceAuthRef, InsuranceAuthProps>((props, ref) => {

  const { } = props;
  const { issuerAccountClient, signer, orgIssuerDelegation, orgAccountClient, session, orgDid, issuerDid } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  

  const openInsurancePopup = async () => {

      var insuranceNumber = "10"
      if (orgDid && insuranceNumber && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

        const vc = await VerifiableCredentialsService.createInsuranceVC(orgDid, issuerDid, insuranceNumber);

        console.info("vc: ", JSON.stringify(vc))
        const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
        const fullVc = result.vc
        const proofUrl = result.proofUrl
        if (fullVc && signer && orgAccountClient && orgIssuerDelegation && walletClient) {
        
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
            vciss: issuerDid,
            proof: proofUrl
          };

          const uid = await AttestationService.addInsuranceAttestation(attestation, signer, orgIssuerDelegation, orgAccountClient, issuerAccountClient)
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