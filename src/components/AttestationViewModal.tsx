import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { ethers, namehash  } from "ethers";
import {
  XMarkIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';

import { VerifiableCredential } from '../models/VerifiableCredential'
import { VcZkProof, VcRevokeZkProof } from '../models/ZkProof'
import {Attestation, IndivAccountAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import EnsService from '../service/EnsService';
import { RPC_URL,  ETHERSCAN_API_KEY, ETHERSCAN_URL, EAS_URL } from "../config";

import VerifiableCredentialsService from "../service/VerifiableCredentialsService"
import ZkProofService from "../service/ZkProofService"
import { getCachedResponse, putCachedResponse, putCachedValue } from "../service/CachedService"

import { useWallectConnectContext } from "../context/walletConnectContext";
import { 
  Button, 
  Tooltip,
  CircularProgress
} from "@mui/material";

interface AttestationViewModalProps {
  did: string;
  entityId: string;
  displayName: string;
  isVisible: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

const AttestationViewModal: React.FC<AttestationViewModalProps> = ({did, entityId, displayName, isVisible, onClose, onDelete}) => {

  const {t} = useTranslation();

  const [attestation, setAttestation] = useState<Attestation | undefined>(undefined);
  const [credential, setCredential] = useState<VerifiableCredential | undefined>(undefined);
  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [vcZkProof, setVcZkProof] = useState<VcZkProof | undefined>(undefined);
  const [vcRevokeZkProof, setVcRevokeZkProof] = useState<VcRevokeZkProof | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  const [hasInfo, setHasInfo] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [verified, setVerified] = useState(false);


  const [ orgEthName, setOrgEthName] = useState<string>("");
  const [ orgEthAvatar, setOrgEthAvatar] = useState<string>("");
  const [ avatarError, setAvatarError] = useState<boolean>(false);
  const [ ensData, setEnsData] = useState<{
    name: string | null;
    avatar: string | null;
    website: string | null;
    email: string | null;
    twitter: string | null;
    github: string | null;
    discord: string | null;
  }>({
    name: null,
    avatar: null,
    website: null,
    email: null,
    twitter: null,
    github: null,
    discord: null
  });

  const [activeTab, setActiveTab] = useState<'info' | 'vc' | 'vc-raw' | 'zk' | 'rzk' | 'at' >('vc');
  const { chain, veramoAgent, credentialManager, signatory, indivIssuerDelegation, orgIssuerDelegation, orgIndivDelegation, burnerAccountClient } = useWallectConnectContext();

  // Helper function to get the correct ENS URL based on chain
  const getEnsUrl = (ensName: string) => {
    if (chain?.id === 11155111) { // Sepolia
      return `https://sepolia.app.ens.domains/${ensName}`;
    } else if (chain?.id === 1) { // Mainnet
      return `https://app.ens.domains/name/${ensName}`;
    } else {
      // Default to Sepolia for other chains
      return `https://sepolia.app.ens.domains/${ensName}`;
    }
  };

  const handleClose = () => {
    console.info("close attestation modal")

    onClose();
  };

  // Async function defined inside the component
  const handleInitOperations = async () => {

    if (did && chain) {
      // Extract address from DID instead of using signatory
      const address = did.replace("did:pkh:eip155:" + chain?.id + ":", "") as `0x${string}`;

      const cacheKey = address;
      const cached = await getCachedResponse(cacheKey);
      
      if (!cached && address) {
        try {
          // Get comprehensive ENS data using EnsService
          const ensDataResult = await EnsService.getEnsComprehensiveData(address, chain);

          // Update state with ENS data
          setEnsData(ensDataResult);
          
          // Reset avatar error state when new data is loaded
          setAvatarError(false);
          
          // Set legacy state for backward compatibility
          if (ensDataResult.name) {
            setOrgEthName(ensDataResult.name);
          }
          if (ensDataResult.avatar) {
            setOrgEthAvatar(ensDataResult.avatar);
          }
          
          // Cache the result
          putCachedValue(cacheKey, true);
          
        } catch (error) {
          console.error("Error fetching ENS data:", error);
        }
      } else if (cached) {
        // If cached, try to get basic ENS data
        try {
          const ensDataResult = await EnsService.getEnsData(address, chain);

          setEnsData({
            name: ensDataResult.name,
            avatar: ensDataResult.avatar,
            website: null,
            email: null,
            twitter: null,
            github: null,
            discord: null
          });
          
          if (ensDataResult.name) {
            setOrgEthName(ensDataResult.name);
          }
          if (ensDataResult.avatar) {
            setOrgEthAvatar(ensDataResult.avatar);
          }
        } catch (error) {
          console.error("Error fetching cached ENS data:", error);
        }
      }
    }
  }

  useEffect(() => {
    handleInitOperations();
  }, [did, entityId, displayName]);


  const address = did.replace("did:pkh:eip155:" + chain?.id + ":", "") as `0x${string}`

  // Log ENS data when it changes
  useEffect(() => {
    if (ensData.name) {
      console.info("ENS name found:", ensData.name);
    }
    if (ensData.avatar) {
      console.info("ENS avatar found:", ensData.avatar);
    }
  }, [ensData]);






  useEffect(() => {

    setAttestation(undefined);
    setCredential(undefined);
    setPublicKey(undefined);
    setVcZkProof(undefined);
    setVcRevokeZkProof(undefined);

    if (isVisible) {
      if (did) {
        
          let schemaUid = ""
          if (entityId == "indiv(indiv)") {
            schemaUid = AttestationService.IndivSchemaUID
          }
          if (entityId == "account(indiv)") {
            schemaUid = AttestationService.IndivAccountSchemaUID
          }
          if (entityId == "account-org(org)") {
            schemaUid = AttestationService.AccountOrgDelSchemaUID
          }
          if (entityId == "account-indiv(org)") {
            schemaUid = AttestationService.AccountIndivDelSchemaUID
          }
          if (entityId == "account(org)") {
            schemaUid = AttestationService.OrgAccountSchemaUID
          }
          if (entityId == "org-indiv(org)") {
            schemaUid = AttestationService.OrgIndivSchemaUID
          }
          if (entityId == "org(org)") {
            schemaUid = AttestationService.OrgSchemaUID
          }
          if (entityId == "state-registration(org)") {
            schemaUid = AttestationService.StateRegistrationSchemaUID
          }
          if (entityId == "domain(org)") {
            schemaUid = AttestationService.RegisteredDomainSchemaUID
          }
          if (entityId == "ens(org)") {
            schemaUid = AttestationService.RegisteredENSSchemaUID
          }
          if (entityId == "shopify(org)") {
            schemaUid = AttestationService.WebsiteSchemaUID
          }
          if (entityId == "insurance(org)") {
            schemaUid = AttestationService.InsuranceSchemaUID
          }
          if (entityId == "email(org)") {
            schemaUid = AttestationService.EmailSchemaUID
          }
          if (entityId == "email(indiv)") {
            schemaUid = AttestationService.IndivEmailSchemaUID
          }
          if (entityId == "linkedin(indiv)") {
            schemaUid = AttestationService.SocialSchemaUID
          }
          if (entityId == "x(indiv)") {
            schemaUid = AttestationService.SocialSchemaUID
          }
          if (entityId == "website(org)") {
            schemaUid = AttestationService.WebsiteSchemaUID
          }
          //console.info("go get shopify attestation: ", did)
          if (did && chain) {
            AttestationService.getAttestationByDidAndSchemaId(chain, did, schemaUid, entityId, displayName).then(async (att) => {
              if (att) {

                if (att.entityId == "account(indiv)") {
                  const accountIndiv = att as IndivAccountAttestation
                  const accountAddress = accountIndiv.accountDid?.replace("did:pkh:eip155:" + chain?.id + ":", "") as `0x${string}`
                  console.info("chain id: ", chain?.id)
                  console.info("account(indiv) attestation address: ", accountAddress)

                  if (chain && accountAddress) {
                    try {
                      const provider = new ethers.JsonRpcProvider(chain.rpcUrls.default.http[0]);
                      const balance = await provider.getBalance(accountAddress);
                      console.info("balance: ", balance)
                      accountIndiv.accountBalance = (Number(balance) / 1e18).toFixed(4)
                      setAttestation(accountIndiv)
                    } catch (error) {
                      console.error("Error fetching balance:", error)
                    }
                  }

                }

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

                if (credentialManager && att.vcid) {
                  setHasInfo(true)

                  setHasCredential(false)
                  setCredential(undefined)

                  console.info("------> get credential using vcid: ", att)

                  VerifiableCredentialsService.getCredentialByVcid(credentialManager, att.vcid).then((cred) => {
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
                    if (vcZkProof.isValid && att.vccomm && chain) {

                      AttestationService.getVcRevokedAttestation(chain, att.attester, att.vccomm).then((revokeResponse) => {

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

  const handleDeleteAttestation = async () => {
    if (!attestation || !chain || !orgIssuerDelegation || !orgIndivDelegation || !indivIssuerDelegation || !burnerAccountClient) return;
    
    setIsDeleting(true);
    try {
      

      const walletSigner = signatory.signer

      if (attestation.class == "organization") {
        const attestations = [attestation]
        const rslt = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [orgIssuerDelegation, orgIndivDelegation], burnerAccountClient)
        console.info("delete organization attestations is done ")
      }
      if (attestation.class == "individual") {
        const attestations = [attestation]
        const rslt = await AttestationService.deleteAttestations(chain, attestations, walletSigner, [indivIssuerDelegation], burnerAccountClient)
        console.info("delete individual attestations is done ")
      }
      

      
      // Close modal after successful deletion
      handleClose();
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Error deleting attestation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {attestation && (
              <Tooltip title="Delete Attestation">
                <Button
                  onClick={handleDeleteAttestation}
                  disabled={isDeleting}
                  sx={{
                    minWidth: 'auto',
                    p: 1,
                    color: 'error.main',
                    '&:hover': {
                      backgroundColor: 'error.light',
                      color: 'white'
                    }
                  }}
                >
                  {isDeleting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <TrashIcon className="h-5 w-5" />
                  )}
                </Button>
              </Tooltip>
            )}
            <button onClick={handleClose} className="close-button">
              <XMarkIcon className="close-icon" aria-hidden="true" />
            </button>
          </div>
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
                    {attestation?.entityId === "org(org)" ? (
                      <div className="org-info">
                        <div>
                          {(ensData.avatar || orgEthAvatar) && !avatarError ? (
                            <img
                              src={ensData.avatar || orgEthAvatar}
                              alt={`${ensData.name || orgEthName || 'Organization'} avatar`}
                              className="org-avatar"
                              onError={() => setAvatarError(true)}
                            />
                          ) : (
                            <div className="org-avatar-placeholder">
                              <div className="avatar-initial">
                                {(ensData.name || orgEthName || 'O').charAt(0).toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="org-details">
                          <span className="org-name">
                            {ensData.name ? (
                              <a
                                href={getEnsUrl(ensData.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="org-link"
                              >
                                Visit {ensData.name}
                              </a>
                            ) : orgEthName ? (
                              <a
                                href={getEnsUrl(orgEthName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="org-link"
                              >
                                Visit {orgEthName}
                              </a>
                            ) : (
                              <span>No ENS name found</span>
                            )}
                          </span>
                        </div>
                        <div className="org-details">
                          <span className="org-did">{did}</span>
                        </div>
                        {/* Display additional ENS data if available */}
                        {(ensData.website || ensData.email || ensData.twitter || ensData.github || ensData.discord) && (
                          <div className="ens-details">
                            <h3>ENS Information</h3>
                            {ensData.website && (
                              <p className="panel-text">
                                <strong>Website:</strong>{' '}
                                <a href={ensData.website} target="_blank" rel="noopener noreferrer" className="panel-link">
                                  {ensData.website}
                                </a>
                              </p>
                            )}
                            {ensData.email && (
                              <p className="panel-text">
                                <strong>Email:</strong> {ensData.email}
                              </p>
                            )}
                            {ensData.twitter && (
                              <p className="panel-text">
                                <strong>Twitter:</strong>{' '}
                                <a href={`https://twitter.com/${ensData.twitter}`} target="_blank" rel="noopener noreferrer" className="panel-link">
                                  @{ensData.twitter}
                                </a>
                              </p>
                            )}
                            {ensData.github && (
                              <p className="panel-text">
                                <strong>GitHub:</strong>{' '}
                                <a href={`https://github.com/${ensData.github}`} target="_blank" rel="noopener noreferrer" className="panel-link">
                                  {ensData.github}
                                </a>
                              </p>
                            )}
                            {ensData.discord && (
                              <p className="panel-text">
                                <strong>Discord:</strong> {ensData.discord}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : attestation?.entityId === "account(indiv)" ? (
                      <div className="account-indiv-info">
  
                        <div className="panel-details">
                            <p className="panel-text">
                              <strong>Account Name:</strong> {(attestation as any).accountName || 'N/A'}
                            </p>
                            <p className="panel-text">
                              <strong>Account DID:</strong> {(attestation as any).accountDid || 'N/A'}
                            </p>
                            <p className="panel-text">
                              <strong>Account Balance:</strong> {(attestation as any).accountBalance || 'N/A'}
                            </p>

                        </div>

                      </div>
                    ) : (
                      <div>
                        <p> No information is available at this time. Please check back later. </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'vc-raw' && (
              <div className="tab-panel" style={{ maxHeight: '600px', overflowY: 'auto', color: 'white', backgroundColor: '#0e0e5e', fontSize: '12px'}}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <pre>
                    <code>
                      {JSON.stringify(credential, null, 2)}
                    </code>
                  </pre>
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
                      ETHERSCAN_URL + '/address/' +
                      attestation?.attester.replace("did:pkh:eip155:" + chain?.id + ":", "")
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
                      href={EAS_URL + '/attestation/view/' + attestation?.uid}
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
                      href={EAS_URL + '/schema/view/' + attestation?.schemaId}
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
                        ETHERSCAN_URL + '/address/' +
                        attestation?.vciss.replace("did:pkh:eip155:" + chain?.id + ":", "")
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
