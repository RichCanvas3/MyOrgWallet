import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { ethers, formatEther } from "ethers";
import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import { VerifiableCredential } from '../models/VerifiableCredential'
import { VcZkProof, VcRevokeZkProof } from '../models/ZkProof'
import {Attestation, WebsiteAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { ALCHEMY_RPC_URL, ETHERSCAN_API_KEY } from "../config";

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"
import ZkProofService from "../service/ZkProofService"
import { useWalletClient, useAccount, useConnect, useEnsName, useEnsAvatar, useDisconnect } from 'wagmi';
import { getCachedResponse, putCachedResponse, putCachedValue } from "../service/CachedService"

import { useWallectConnectContext } from "../context/walletConnectContext";




interface AttestationViewModalProps {
  did: string;
  entityId: string;
  isVisible: boolean;
  onClose: () => void;
}



const AttestationViewModal: React.FC<AttestationViewModalProps> = ({did, entityId, isVisible, onClose}) => {

  const {t} = useTranslation();

  const [attestation, setAttestation] = useState<Attestation | undefined>(undefined);
  const [credential, setCredential] = useState<VerifiableCredential | undefined>(undefined);
  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [vcZkProof, setVcZkProof] = useState<VcZkProof | undefined>(undefined);
  const [vcRevokeZkProof, setVcRevokeZkProof] = useState<VcRevokeZkProof | undefined>(undefined);

  const dialogRef = useRef<HTMLDivElement>(null);

  const [hasInfo, setHasInfo] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [verified, setVerified] = useState(false);
  const { data: walletClient } = useWalletClient();

  const [ orgEthName, setOrgEthName] = useState<string>("");
  const [ orgEthAvatar, setOrgEthAvatar] = useState<string>("");

  const [activeTab, setActiveTab] = useState<'info' | 'vc' | 'vc-raw' | 'zk' | 'rzk' | 'at' >('vc');
  const { veramoAgent, mascaApi } = useWallectConnectContext();
  

  const handleClose = () => {
    console.info("close attestation modal")

    onClose();
  };
  
  // Async function defined inside the component
  const handleInitOperations = async () => {
    if (did) {

      const address = did.replace("did:pkh:eip155:10:", "") as `0x${string}`

      console.info("org address: ", address)

      console.info("call handle init operations")
      const cacheKey = address
      const cached = await getCachedResponse(cacheKey)
      if (!cached && address) {

        //   PRIVATE DATA
        const alchemyRpcUrl = ALCHEMY_RPC_URL

    
        //  get org account information
        const ACCOUNT_INFO_SMART_CONTRACT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        const accountBalanceUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
        const res = await fetch(accountBalanceUrl)
        const balance = await res.json()
        console.info("account balance: ", address, balance)


        const provider = new ethers.JsonRpcProvider(alchemyRpcUrl);
        let name = await provider.lookupAddress(address)
        console.info("----------------> lookup address: ", name )

        if (name) {
          setOrgEthName(name)
        }
        else {
          name = "richcanvas.eth"
          setOrgEthName(name)
        }

        if (name) {

          const resolver = await provider.getResolver(name);
          if (!resolver) {
            console.log("No resolver found for", name);
            return null;
          }
      
          // Fetch the avatar text record
          const avatar = await resolver.getText("avatar");
          console.log("Avatar URI:", avatar);

          if (avatar) {
            setOrgEthAvatar(avatar)
          }
          



          // get lots of data from ensdata.net
          const url = "https://api.ensdata.net/" + name
          const res = await fetch(url)
          const orgInfo = await res.json()
          if (orgInfo) {
            if (orgInfo.avatar) {
              setOrgEthAvatar(orgInfo.avatar)
            }
            if (orgInfo.twitter) {
              //console.info("x account: ", orgInfo.twitter)

            }
            if (orgInfo.url) {
              //console.info("website: ", orgInfo.url)
            }
          }
        }
        putCachedValue(cacheKey, true)
      }

    }



  }

  useEffect(() => {
    handleInitOperations();
  }, [did, entityId]);


  const address = did.replace("did:pkh:eip155:10:", "") as `0x${string}`


  // reverse lookup from address to ens name
  // lookup from ens name to other info
  // https://api.ensdata.net/richcanvas.eth
  const { data: name } = useEnsName({ address: address, chainId: 1 })
  if (name) {
    console.info("found eth name: ", name)
  }
  else {
    //console.info("not found eth name: ")
  }






  /*
  async function getEnsAvatar(name: string) {
    try {
      // Get the resolver for the ENS name
      const resolver = await provider.getResolver(name);
      if (!resolver) {
        console.log("No resolver found for", name);
        return null;
      }
  
      // Fetch the avatar text record
      const avatar = await resolver.getText("avatar");
      console.log("Avatar URI:", avatar);
      return avatar; // e.g., "ipfs://QmExampleHash123" or "https://example.com/image.png"
    } catch (error) {
      console.error("Error fetching avatar:", error);
      return null;
    }
  }
  getEnsAvatar("richcanvas.eth").then((avatar) => {
    if (avatar) {
      setOrgEthAvatar(avatar)
    }
    
  })
  */
  





  useEffect(() => {

    console.info(" >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>  is visible       ")
    setAttestation(undefined);
    setCredential(undefined); 
    setPublicKey(undefined);
    setVcZkProof(undefined);
    setVcRevokeZkProof(undefined);

    if (isVisible) {
      if (did) {

          let schemaUid = ""
          if (entityId == "indiv") {
            schemaUid = AttestationService.IndivSchemaUID
          }
          if (entityId == "indiv-org") {
            schemaUid = AttestationService.IndivOrgSchemaUID
          }
          if (entityId == "org") {
            schemaUid = AttestationService.OrgSchemaUID
          }
          if (entityId == "state-registration") {
            schemaUid = AttestationService.StateRegistrationSchemaUID
          }
          if (entityId == "domain") {
            schemaUid = AttestationService.RegisteredDomainSchemaUID
          }
          if (entityId == "shopify") {
            schemaUid = AttestationService.WebsiteSchemaUID
          }
          if (entityId == "insurance") {
            schemaUid = AttestationService.InsuranceSchemaUID
          }
          if (entityId == "email") {
            schemaUid = AttestationService.EmailSchemaUID
          }
          if (entityId == "indiv-email") {
            schemaUid = AttestationService.IndivEmailSchemaUID
          }
          if (entityId == "linkedin") {
            schemaUid = AttestationService.SocialSchemaUID
          }
          if (entityId == "x") {
            schemaUid = AttestationService.SocialSchemaUID
          }
          if (entityId == "website") {
            schemaUid = AttestationService.WebsiteSchemaUID
          }
          //console.info("go get shopify attestation: ", did)
          if (did) {
            AttestationService.getAttestationByAddressAndSchemaId(did, schemaUid, entityId).then((att) => {

              console.info("att: ", att)
              if (att) {

                setAttestation(att)


                /*
                let websiteAtt = att as WebsiteAttestation
      
                
                console.info("attestation id: ", websiteAtt.uid)
                console.info("org id: ", websiteAtt.attester)
        
                if (websiteAtt?.hash) {
                  console.info("hash: ", websiteAtt.hash)
                }
                if (websiteAtt?.vccomm) {
                  console.info("vccomm: ", websiteAtt.vccomm)
                }
                if (websiteAtt?.vcsig) {
                  console.info("vcsig: ", websiteAtt.vcsig)
                }
                if (websiteAtt?.vciss) {
                  console.info("vciss: ", websiteAtt.vciss)
                }

                if (websiteAtt?.type) {
                  console.info("type: ", websiteAtt.type)
                }
                if (websiteAtt?.url) {
                  console.info("url: ", websiteAtt.url)
                }
                */

                if (mascaApi) {
                  setHasInfo(true)

                  setHasCredential(false)
                  setCredential(undefined)
                  VerifiableCredentialsService.getCredential(mascaApi, att.entityId).then((cred) => {
                    if (cred) {
                      setHasCredential(true)
                      console.info(",,,,,,,,,, credential: ", cred)
                      setCredential(cred)
                    }
                    else {
                      setHasCredential(false)
                    }
                  })


                  
                }
                  

                if (att.proof && att.vccomm && att.vciss && att.attester) {
                  ZkProofService.getVcZkProof(att.proof, att.vccomm, att.vciss, att.attester).then((vcZkProof) => {
                    setVcZkProof(vcZkProof)
                    if (vcZkProof.isValid && att.vccomm) {
                      
                      AttestationService.getVcRevokedAttestation(att.attester, att.vccomm).then((revokeResponse) => {

                        if (revokeResponse.proof && revokeResponse.proof != "" && att.vccomm) {

                          ZkProofService.getVcRevokeZkProof(revokeResponse.proof, att.vccomm).then((vcRevokeZkProof) => {
                            if (vcRevokeZkProof.isValid && revokeResponse.proof) {
                              setVcRevokeZkProof(vcRevokeZkProof)
                              setVerified(false)
                            }
                            else {
                              setVerified(true)
                            }
                          })
                          
                        }
                        else {
                          setVerified(true)
                        }

         

                      })
                      /*
                      ZkProofService.getVcRevokeZkProof(att.vccomm).then((vcRevokeZkProof) => {
                        setVcRevokeZkProof(vcRevokeZkProof)
                        if (vcRevokeZkProof.isValid) {
                          setVerified(false)
                        }
                        else {
                          setVerified(true)
                        }
                      }) 
                        */
                    }
                    else {
                      setVerified(false)
                    }
                  })
                  
                }
            

                setAttestation(att)

              }
  
      
            })
          }

        

      }
    }
    
  }, [isVisible]);




  function cleanLine(str: string): string {

    if (!str) {
      return ''
    }

    if (str.length < 50) {
      return str
    }

    // Ensure the input starts with "0x" and is a valid hex string
    const hex = str.replace(/^['"]|['"]$/g, '');
    if (!hex.startsWith("0x")) {
      return hex; // Return unchanged if not a hex value
    }

    const hexBody = hex.slice(2); // Remove "0x" prefix
    if (hexBody.length <= 10 + 10) {
      return hex; // Return original if too short to truncate
    }

    // Remove leading zeros (except if it's all zeros)
    const trimmedHex = hexBody.replace(/^0+/, '') || '0';
    if (trimmedHex.length <= 10 + 10) {
      return `0x${trimmedHex}`;
    }

    // Take the specified number of characters from start and end
    const start = trimmedHex.slice(0, 10);
    const end = trimmedHex.slice(-10);

    return `0x${start}...${end}`;
  }


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
      <div ref={dialogRef} className="modal-dialog">
        {/* Header */}
        <div id="user-settings-header" className="modal-header">
          <h1 className="modal-title">{attestation?.entityId} attestation</h1>
          
          <button onClick={handleClose} className="close-button">
            <XMarkIcon className="close-icon" aria-hidden="true" />
          </button>
        </div>
 
        {/* Content */}
        <div className="modal-content">
          {/* Tabs */}
          <div className="tabs-container">
            <button
              className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
            <button
              className={`tab-button ${activeTab === 'vc' ? 'active' : ''}`}
              onClick={() => setActiveTab('vc')}
            >
              Verifiable Credential
            </button>
            <button
              className={`tab-button ${activeTab === 'vc-raw' ? 'active' : ''}`}
              onClick={() => setActiveTab('vc-raw')}
            >
              VC Raw
            </button>
            <button
              className={`tab-button  ${activeTab === 'at' ? 'active' : ''}`}
              onClick={() => setActiveTab('at')}
            >
              Attestation
            </button>
            <button
              className={`tab-button  ${activeTab === 'zk' ? 'active' : ''}`}
              onClick={() => setActiveTab('zk')}
            >
              ZK Proof
            </button>
            <button
              className={`tab-button  ${activeTab === 'rzk' ? 'active' : ''}`}
              onClick={() => setActiveTab('rzk')}
            >
              Revoked ZK Proof
            </button>

          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'info' && (
              <div className="tab-panel">
                <h2 className="panel-title">Info</h2>
                {hasInfo === true && (
                  <div>
                    {attestation?.entityId === "org" ? (
                      <div className="org-info">
                        <div>
                          <img
                            src={`${orgEthAvatar}`}
                            alt={`${orgEthName} avatar`}
                            className="org-avatar"
                          />
                        </div>
                        <div className="org-details">
                          <span className="org-name">
                            <a
                              href={`https://app.ens.domains/name/${orgEthName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="org-link"
                            >
                              Visit {orgEthName}
                            </a>
                          </span>
                        </div>
                        <div className="org-details">
                          <span className="org-did">{did}</span>
                        </div>
                      </div>
                    ) : (
                      <div></div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'vc-raw' && (
              <div className="tab-panel" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(credential, null, 2)}
                </div>
              </div>
            )}

            {activeTab === 'vc' && (
              <div className="tab-panel">
                <h2 className="panel-title">Verifiable Credential</h2>
                {hasCredential === false && (
                  <div className="panel-text">
                    You do not have access to verifiable credential
                  </div>
                )}
                {hasCredential === true && (
                  <div>
                    <div className="panel-details">
                      <p>
                        <strong>Type:</strong> {credential?.type?.join(', ')}
                      </p>
                      <p>
                        <strong>Issuer:</strong>{' '}
                        {typeof credential?.issuer === 'string'
                          ? credential.issuer
                          : credential?.issuer?.id}
                      </p>
                      <p>
                        <strong>Issued:</strong> {credential?.issuanceDate}
                      </p>
                      {credential?.expirationDate && (
                        <p>
                          <strong>Expires:</strong>{' '}
                          {new Date(credential.expirationDate).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                  </div>
                )}
              </div>
            )}
            {activeTab === 'at' && (
              <div className="tab-panel">
                <h2 className="panel-title">Attestation</h2>
                <p className="panel-text">
                  <strong>Entity:</strong> {attestation?.entityId}
                </p>
                <p className="panel-text">
                  <strong>DID:</strong>{' '}
                  <a
                    href={
                      'https://optimistic.etherscan.io/address/' +
                      attestation?.attester.replace("did:pkh:eip155:10:", "")
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="panel-link"
                  >
                    {attestation?.attester}
                  </a>
                </p>
                {attestation?.uid && (
                  <p className="panel-text">
                    <strong>Attestation ID:</strong>{' '}
                    <a
                      href={'https://optimism.easscan.org/attestation/view/' + attestation?.uid}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="panel-link"
                    >
                      {attestation?.uid}
                    </a>
                  </p>
                )}
                {attestation?.schemaId && (
                  <p className="panel-text">
                    <strong>Schema ID:</strong>{' '}
                    <a
                      href={'https://optimism.easscan.org/schema/view/' + attestation?.schemaId}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="panel-link"
                    >
                      {attestation?.schemaId}
                    </a>
                  </p>
                )}
                {attestation?.vccomm && (
                  <p className="panel-text">
                    <strong>VC Commitment:</strong> {attestation.vccomm}
                  </p>
                )}
                {attestation?.vciss && (
                  <p className="panel-text">
                    <strong>VC Issuer:</strong>{' '}
                    <a
                      href={
                        'https://optimistic.etherscan.io/address/' +
                        attestation?.vciss.replace("did:pkh:eip155:10:", "")
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="panel-link"
                    >
                      {attestation?.vciss}
                    </a>
                  </p>
                )}
                {attestation?.issuedate && (
                  <p className="panel-text">
                    <strong>Issue Date:</strong>{' '}
                    {new Date(attestation.issuedate).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            {activeTab === 'zk' && (
              <div className="tab-panel">
                <h2 className="panel-title">ZK Proof Summary</h2>
                {vcZkProof?.id && (
                  <p className="panel-text">
                    <strong>ID:</strong> {vcZkProof.id}
                  </p>
                )}
                {vcZkProof?.orgDid && (
                  <p className="panel-text">
                    <strong>DID:</strong> {vcZkProof.orgDid}
                  </p>
                )}
                {vcZkProof?.vccomm && (
                  <p className="panel-text">
                    <strong>VC Commitment:</strong> {vcZkProof.vccomm}
                  </p>
                )}
                {vcZkProof?.createdAt && (
                  <p className="panel-text">
                    <strong>Created:</strong> {new Date(vcZkProof.createdAt).toLocaleString()}
                  </p>
                )}
                <p className="panel-text">
                  <strong>Valid:</strong>{' '}
                  {vcZkProof?.isValid !== null && vcZkProof?.isValid !== undefined ? (
                    vcZkProof.isValid ? (
                      <span className="valid-text">✔ True</span>
                    ) : (
                      <span className="invalid-text">✖ False</span>
                    )
                  ) : (
                    'Unknown'
                  )}
                </p>
                {vcZkProof?.publicSignals?.length > 0 && (
                  <div className="panel-section">
                    <h3 className="section-title">Public Signals:</h3>
                    <ul className="section-list">
                      {vcZkProof.publicSignals.map((sig, index) => (
                        <li key={index}>{sig}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {vcZkProof?.proof && (
                  <div className="panel-section">
                    <h3 className="section-title">Proof:</h3>
                    <pre className="proof-text">
                      {vcZkProof.proof.length > 100
                        ? `${vcZkProof.proof.slice(0, 80)}...${vcZkProof.proof.slice(-20)}`
                        : vcZkProof.proof}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'rzk' && (
              <div className="tab-panel">
                <h2 className="panel-title">Revoke ZK Proof Summary</h2>
                {vcRevokeZkProof?.id && (
                  <p className="panel-text">
                    <strong>ID:</strong> {vcRevokeZkProof.id}
                  </p>
                )}
                {vcRevokeZkProof?.orgDid && (
                  <p className="panel-text">
                    <strong>DID:</strong> {vcRevokeZkProof.orgDid}
                  </p>
                )}
                {vcRevokeZkProof?.vccomm && (
                  <p className="panel-text">
                    <strong>VC Commitment:</strong> {vcRevokeZkProof.vccomm}
                  </p>
                )}
                {vcRevokeZkProof?.createdAt && (
                  <p className="panel-text">
                    <strong>Created:</strong> {new Date(vcRevokeZkProof.createdAt).toLocaleString()}
                  </p>
                )}
                <p className="panel-text">
                  <strong>Valid:</strong>{' '}
                  {vcRevokeZkProof?.isValid !== null && vcRevokeZkProof?.isValid !== undefined ? (
                    vcRevokeZkProof.isValid ? (
                      <span className="valid-text">✔ True</span>
                    ) : (
                      <span className="invalid-text">✖ False</span>
                    )
                  ) : (
                    'Unknown'
                  )}
                </p>
                {vcRevokeZkProof?.publicSignals?.length > 0 && (
                  <div className="panel-section">
                    <h3 className="section-title">Public Signals:</h3>
                    <ul className="section-list">
                      {vcRevokeZkProof.publicSignals.map((sig, index) => (
                        <li key={index}>{sig}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {vcRevokeZkProof?.proof && (
                  <div className="panel-section">
                    <h3 className="section-title">Proof:</h3>
                    <pre className="proof-text">
                      {vcRevokeZkProof.proof.length > 100
                        ? `${vcRevokeZkProof.proof.slice(0, 80)}...${vcRevokeZkProof.proof.slice(-20)}`
                        : vcRevokeZkProof.proof}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Transition.Child>
  </div>
</Transition>
  );
};

export default AttestationViewModal;
