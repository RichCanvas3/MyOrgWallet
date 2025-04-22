import * as React from 'react';
import {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ChatBubbleLeftIcon, LinkIcon, CheckIcon, PencilSquareIcon, TrashIcon, XMarkIcon} from "@heroicons/react/24/outline";
import { Attestation } from "../models/Attestation"
import {iconProps} from "../svg";
import { CheckCircleIcon, MinusCircleIcon } from '@heroicons/react/24/solid';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from 'wagmi';


import ZkProofService  from "../service/ZkProofService"
import AttestationService from '../service/AttestationService';

interface AttestationListItemProps {
  attestation: Attestation;
  isSelected: boolean;
  onSelectAttestation: (attestation: Attestation) => void;
}

const AttestationListItem: React.FC<AttestationListItemProps> = ({
                                                                     attestation,
                                                                     isSelected,
                                                                     onSelectAttestation,
                                                                   }) => {

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const navigate = useNavigate();
  const acceptButtonRef = useRef<HTMLButtonElement | null>(null);
  const { issuerAccountClient, signer, session, orgDid } = useWallectConnectContext();

  const [verified, setVerified] = useState(false);


  const verifyAttestation = async(attestation: Attestation) => {

    if (attestation.proof && attestation.vccomm && attestation.vciss && attestation.attester) {
      
      const vcZkProof = await ZkProofService.getVcZkProof(attestation.proof, attestation.vccomm, attestation.vciss, attestation.attester)
      if (vcZkProof.isValid && attestation.attester) {
        const attResponse = await AttestationService.getVcRevokedAttestation(attestation.attester, attestation.vccomm)
        const proofUrl = attResponse.proof
        if (proofUrl && proofUrl != "") {
          const vcRevokeZkProof =  await ZkProofService.getVcRevokeZkProof(proofUrl, attestation.vccomm)
          if (vcRevokeZkProof.isValid) {
            //console.info("******* revoked: ", attestation.entityId)
            setVerified(false)
          }
          else {
            //console.info("******* revoked but proof not valid: ", attestation.entityId)
            setVerified(true)
          }
        }
        else {
          //console.info("******* valid, and no: ", attestation.entityId)
          setVerified(true)
        }

      }
      else {
        //console.info("******* not valid: ", attestation.entityId)
        setVerified(false)
      }

    }
    else {
      //console.info("******* no proof: ", attestation.entityId, attestation.vccomm, attestation.vciss, attestation.attester)
    }
  }
  
  verifyAttestation(attestation)
  if (attestation.url && attestation.url.startsWith("https://") == false) {
    attestation.url = "https://" + attestation.url
  }

  const selectAttestation = () => {
    onSelectAttestation(attestation);
  };


  const revokeAttestation = () => {

      const serializedSession = session?.serialize()
      if (verified) {
        console.info(">>>>>>>>>>>>>>>>>>>  add revoked key: ", attestation.vccomm)
        setVerified(false)
        if (attestation.vccomm) {

          fetch('http://localhost:3051/api/proof/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commitment: attestation.vccomm.toString()
            }),
          }).then((proofUrlResponse) => {
            proofUrlResponse.json().then((proofResponse) => {
              const proofUrl = proofResponse.proofUrl
              console.info("proofResponse: ", proofResponse)
              console.info("proofUrl: ", proofUrl)
              if (attestation.vccomm && signer && issuerAccountClient && proofUrl) {
                console.info("add revoke attestation => proofUrl: ", proofUrl)
                AttestationService.addRevokeAttestation(attestation.vccomm, proofUrl, signer, issuerAccountClient).then((resp) => {

                })
              }
            })
          })
        }
      }
      else {
        setVerified(true)
        if (attestation.attester && attestation.vccomm) {
          AttestationService.getVcRevokedAttestation(attestation.attester, attestation.vccomm).then((attResponse) => {

            const uid = attResponse.uid
            const schemaId = attResponse.schemaId

            if (uid && schemaId  && signer && issuerAccountClient) {

              AttestationService.deleteIssuerAttestation(uid, schemaId, signer, issuerAccountClient)

              /*
              fetch('http://localhost:3051/api/proof/removerevoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  proof: attestation.proof?.toString()
                }),
              }).then((proofId) => {
                
              })
              */
            }
            
          })
        



        }
      }

  };



  return (
    <li
  key={attestation.uid}
  className="relative z-15"
  style={{ opacity: 1, height: 'auto' }}
>
<div className="attestation-item">
  {verified && <CheckCircleIcon className="status-icon verified" />}
  {!verified && <MinusCircleIcon className="status-icon unverified" />}
  <button
    onClick={() => selectAttestation()}
    type="button"
    className="attestation-button"
  >
    <div className="entity-id">
      {attestation.entityId}
    </div>
  </button>
  <button
    onClick={() => revokeAttestation()}
    type="button"
    className="attestation-button revoke"
  >
    Revoke VC
  </button>
  <a
    href={attestation.url}
    target="_blank"
    rel="noopener noreferrer"
    className="attestation-link"
  >
    <LinkIcon className="link-icon" />
  </a>
</div>
</li>
  );

}

export default AttestationListItem;
