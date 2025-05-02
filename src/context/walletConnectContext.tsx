import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount, useWalletClient } from "wagmi";
import { useNavigate } from 'react-router-dom';

import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage  } from "viem";
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers, AbiCoder } from 'ethers';


import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, BUNDLER_URL, PAYMASTER_URL} from "../config";

import type {
  SignatoryFactory,
} from "../signers/SignatoryTypes";

import {
  useSelectedSignatory
} from "../signers/useSelectedSignatory";

import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  createDelegation,
  DelegationFramework,
  SINGLE_DEFAULT_MODE,
  getExplorerTransactionLink,
  getExplorerAddressLink,
  createExecution,
  getDelegationHashOffchain,
  Delegation,
  getDeleGatorEnvironment, 
} from "@metamask/delegation-toolkit";


import {
  createBundlerClient,
  createPaymasterClient,
  UserOperationReceipt,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { EthereumWebAuth } from '@didtools/pkh-ethereum';
import { optimism } from "viem/chains";

import DelegationService from "../service/DelegationService"

import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem, DelegatedProxyAttestationVersion } from '@ethereum-attestation-service/eas-sdk';
import { DeveloperBoard } from "@mui/icons-material";

import { IndivOrgAttestation, IndivEmailAttestation, IndivAttestation, OrgAttestation } from "../models/Attestation";
import AttestationService from "../service/AttestationService";
import VerifiableCredentialsService from "../service/VerifiableCredentialsService";
import { Navigate } from "react-router-dom";


export type GetSnapsResponse = Record<string, Snap>;
export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export type WalletConnectContextState = {
    connect: (orgAddress: string, walletClient: WalletClient, organizationName: string, fullName: string, email: string) => Promise<void>;
    setIndivAndOrgInfo: (indivName: string, orgName: string, indivEmail: string) => Promise<void>;
    buildSmartWallet: (owner: any, signatory: any, ) => Promise<void>;
    setupSmartWallet: (owner: any, signatory: any, ) => Promise<void>;

    orgDid?: string;
    indivDid?: string;
    issuerDid?: string;

    orgName?: string;
    indivName?: string;

    issuerAccountClient?: any;
    orgAccountClient?: any;
    indivAccountClient?: any;

    orgIndivDelegation?: Delegation,
    orgIssuerDelegation?: Delegation,
    indivIssuerDelegation?: Delegation,

    selectedSignatory?: SignatoryFactory,
    signatory?: any,
    
    setOrgNameValue: (orgNameValue: string) => Promise<void>,
    setOrgDidValue: (orgDidValue: string) => Promise<void>,
    
    isIndividualConnected: boolean
}

export const WalletConnectContext = createContext<WalletConnectContextState>({
  
  orgDid: undefined,
  indivDid: undefined,
  issuerDid: undefined,

  orgName: undefined,
  indivName: undefined,


  issuerAccountClient: undefined,
  orgAccountClient: undefined,
  indivAccountClient: undefined,

  orgIndivDelegation: undefined,
  orgIssuerDelegation: undefined,
  indivIssuerDelegation: undefined,

  signatory: undefined,

  isIndividualConnected: false,



  connect: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  buildSmartWallet: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  setIndivAndOrgInfo: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  setupSmartWallet: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  setOrgNameValue: async (orgNameValue: string) => {},
  setOrgDidValue: async (orgDidValue: string) => {},
})



export const useWalletConnect = () => {

    const [orgDid, setOrgDid] = useState<string>();
    const [indivDid, setIndivDid] = useState<string>();
    const [issuerDid, setIssuerDid] = useState<string>();

    const [orgName, setOrgName] = useState<string>();
    const [indivName, setIndivName] = useState<string>();
    const [indivEmail, setIndivEmail] = useState<string>();

    const [isIndividualConnected, setIsIndividualConnected] = useState<boolean>();

    const [signatory, setSignatory] = useState<any | undefined>();
    const [owner, setOwner] = useState<any | undefined>();

    const [issuerAccountClient, setIssuerAccountClient] = useState<any>();
    const [orgAccountClient, setOrgAccountClient] = useState<any>();
    const [indivAccountClient, setIndivAccountClient] = useState<any>();

    const [orgIndivDelegation, setOrgIndivDelegation] = useState<Delegation | undefined>();
    const [orgIssuerDelegation, setOrgIssuerDelegation] = useState<Delegation | undefined>();
    const [indivIssuerDelegation, setIndivIssuerDelegation] = useState<Delegation | undefined>();



    const {selectedSignatory, setSelectedSignatoryName, selectedSignatoryName } =
      useSelectedSignatory({
        chain: optimism,
        web3AuthClientId: WEB3_AUTH_CLIENT_ID,
        web3AuthNetwork: WEB3_AUTH_NETWORK,
        rpcUrl: RPC_URL,
      });

    const setOrgNameValue = useCallback(async (orgNameValue: string) => {
      try {
        setOrgName(orgNameValue);
      } catch (error) {
        console.error('Failed to set org name:', error);
      }
    }, []);

    const setOrgDidValue = useCallback(async (orgDidValue: string) => {
      try {
        setOrgDid(orgDidValue);
      } catch (error) {
        console.error('Failed to set org did:', error);
      }
    }, []);

    const { isConnected, address: web3ModalAddress, chain } = useAccount();

    const [connectedAddress, setConnectedAddress] = useState<string | undefined>();




    useEffect(() => {

        //console.info("........ if connection to wallet has changed then update info .........")
        if (!chain || !isConnected || (connectedAddress && web3ModalAddress !== connectedAddress)) {
          console.info("****************** is disconnected")
          setConnectedAddress(undefined);
        }

        console.info(".......... setSelectedSignatoryName .............")
        setSelectedSignatoryName("injectedProviderSignatoryFactory")

    }, [chain, isConnected, web3ModalAddress, connectedAddress]);

    


    useEffect(() => {

      if (signatory && owner) {

        // this is hybrid signatory so might have a wallet client
        const walletClient = signatory.walletClient

        console.info("............. publicClient = createPublicClient 1 ............... ")
        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });


        const getConnected = async () => {

          // Initialize metamask wallet and give access to ceramic datastore
          let ownerEOAAddress = owner

          if (publicClient && selectedSignatory) {

            // connect to issuer account abstraction
            const issuerOwner = privateKeyToAccount(ISSUER_PRIVATE_KEY);
            const issuerAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [issuerOwner.address, [], [], []],
              signatory: { account: issuerOwner },
              deploySalt: toHex(0),
            })

            let issuerDid = 'did:pkh:eip155:10:' + issuerAccountClient.address
            setIssuerDid(issuerDid)
            setIssuerAccountClient(issuerAccountClient)


            // connect to individual account abstraction
            const indivAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(1),
            });

            const indivAddress = await indivAccountClient.getAddress()


            // connect to org account abstraction
            // can have three states coming into this section
            let indivDid = 'did:pkh:eip155:10:' + indivAccountClient.address
            setIndivDid(indivDid)
            setIndivAccountClient(indivAccountClient)

            const indivOrgAttestation = await AttestationService.getIndivOrgAttestation(indivDid, AttestationService.IndivOrgSchemaUID, "indiv-org");
            const indivAttestation = await AttestationService.getAttestationByAddressAndSchemaId(indivDid, AttestationService.IndivSchemaUID, "indiv")
            if (indivAttestation) {
              setIndivName((indivAttestation as IndivAttestation).name)
            }
              


            let orgIndivDel : any | undefined
            let delegationOrgAddress : `0x${string}` | undefined
            if (indivOrgAttestation) {
              orgIndivDel = JSON.parse((indivOrgAttestation as IndivOrgAttestation).rolecid)
              if (indivAddress == orgIndivDel.delegate) {
                console.info("*********** valid individual attestation so lets use this org address")
                // need to validate signature at some point
                delegationOrgAddress = orgIndivDel.delegator

                setOrgIndivDelegation(orgIndivDel)
              }
            }

            
            // create orgAccountClient
            let orgAccountClient : any | undefined
            if (delegationOrgAddress) {
              console.info("==========>  org address provided: ", delegationOrgAddress)
              orgAccountClient = await toMetaMaskSmartAccount({
                address: delegationOrgAddress,
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [owner, [], [], []],
                signatory: signatory,
                deploySalt: toHex(0),
              });
            }
            else {

              if (indivAttestation) {
                const orgDidValue = (indivAttestation as IndivAttestation).orgDid
                const orgAddressValue = orgDidValue.replace('did:pkh:eip155:10:', '') as `0x${string}`

                // set with org address
                orgAccountClient = await toMetaMaskSmartAccount({
                  address: orgAddressValue,
                  client: publicClient,
                  implementation: Implementation.Hybrid,
                  deployParams: [owner, [], [], []],
                  signatory: signatory,
                  deploySalt: toHex(0),
                });

              }
              
              /*
              // remove this
              // setup delegation between them
              orgIndivDel = createDelegation({
                to: indivAccountClient.address,
                from: orgAccountClient.address,
                caveats: [] }
              );
    
              const signature = await orgAccountClient.signDelegation({
                delegation: orgIndivDel,
              });
    
              orgIndivDel = {
                ...orgIndivDel,
                signature,
              }
    
              setOrgIndivDelegation(orgIndivDel)
              */
            }


            let orgDid = 'did:pkh:eip155:10:' + orgAccountClient.address
            setOrgDid(orgDid)
            setOrgAccountClient(orgAccountClient)




            /*
            const message = 'Hello, MetaMask Delegator!';
            const signature = await orgAccountClient.signMessage({ message });

            console.info("message: ", message)
            console.info("address: ", orgAccountClient.address)
            console.info("signature: ", signature)

            const messageHash = await hashMessage(message);

            console.log("Message signature:", signature);
            console.log("Message hash:", messageHash);
          
            const isValidSignatureData = encodeFunctionData({
              abi: [
                {
                  name: "isValidSignature",
                  type: "function",
                  inputs: [
                    { name: "_hash", type: "bytes32" },
                    { name: "_signature", type: "bytes" },
                  ],
                  outputs: [{ type: "bytes4" }],
                  stateMutability: "view",
                },
              ],
              functionName: "isValidSignature",
              args: [messageHash, signature],
            });
          
            const { data: isValidSignature } = await publicClient.call({
              account: orgAccountClient.address,
              data: isValidSignatureData,
              to: orgAccountClient.address,
            });
          
            console.log("Message signature:", signature);
            console.log("Message hash:", messageHash);
            console.log("isValidSignatureCall:", isValidSignature); // should be EIP1271_MAGIC_VALUE(0x1626ba7e)
            */


            if (orgIndivDel) {
              setOrgIndivDelegation(orgIndivDel)
            }
            
            
            // setup delegation for org to issuer -> redelegation of orgIndivDel
            let orgIssuerDel  = null
            try {
              orgIssuerDel = await DelegationService.getDelegationFromStorage(walletClient, ownerEOAAddress, orgAccountClient.address, issuerAccountClient.address)
            }
            catch (error) {
            }

            if (orgIssuerDel == null && orgIndivDel && indivDid) {

              const parentDelegationHash = getDelegationHashOffchain(orgIndivDel);
              orgIssuerDel = createDelegation({
                to: issuerAccountClient.address,
                from: indivAccountClient.address,
                parentDelegation: parentDelegationHash,
                caveats: []
              });


              const signature = await indivAccountClient.signDelegation({
                delegation: orgIssuerDel,
              });
  
  
              orgIssuerDel = {
                ...orgIssuerDel,
                signature,
              }

              await DelegationService.saveDelegationToStorage(walletClient, ownerEOAAddress, orgAccountClient.address, issuerAccountClient.address, orgIssuerDel)
            }

            if (orgIssuerDel) {
              setOrgIssuerDelegation(orgIssuerDel)
            }
            


            // setup delegation for individual to issuer delegation
            let indivIssuerDel = null

            try {
              indivIssuerDel = await DelegationService.getDelegationFromStorage(walletClient, ownerEOAAddress, indivAccountClient.address, issuerAccountClient.address)
            }
            catch (error) {
            }

            if (indivIssuerDel == null && indivDid) {
              indivIssuerDel = createDelegation({
                from: indivAccountClient.address,
                to: issuerAccountClient.address,
                caveats: [] }
              );

              const signature = await indivAccountClient.signDelegation({
                delegation: indivIssuerDel,
              });
  
  
              indivIssuerDel = {
                ...indivIssuerDel,
                signature,
              }

              await DelegationService.saveDelegationToStorage(walletClient, ownerEOAAddress, indivAccountClient.address, issuerAccountClient.address, indivIssuerDel)
            }

            setIndivIssuerDelegation(indivIssuerDel)
            setIsIndividualConnected(true)


          }
        }
        
        getConnected()
      }

    }, [signatory, owner]);

    /*
    useEffect(() => {
  
      console.info("===========> check to see if we need to add individual attestation")
      if (signatory && orgDid && indivDid && issuerDid && orgAccountClient && orgIndivDelegation && orgIssuerDelegation) {
        const addIndivOrgAttestation = async () => {

          console.info("*********** ADD INDIV ATTESTATION ****************")

          const provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const walletSigner = await provider.getSigner()

      
          const walletClient = signatory.walletClient
          const entityId = "indiv-org"
      
          if (walletSigner && walletClient) {
      
            const indivName = ""
      
            const vc = await VerifiableCredentialsService.createIndivOrgVC(entityId, orgDid, issuerDid, indivDid, indivName);
            const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient)
            const fullVc = result.vc
            const proofUrl = result.proofUrl

            if (fullVc) {

              const indivName = "indiv name"
            
              // now create attestation
              const hash = keccak256(toUtf8Bytes("hash value"));
              const attestation: IndivOrgAttestation = {
                indivDid: indivDid,
                name: indivName,
                rolecid: JSON.stringify(orgIndivDelegation),
                attester: orgDid,
                class: "organization",
                category: "leaders",
                entityId: entityId,
                hash: hash,
                vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                vciss: issuerDid,
                proof: proofUrl
              };
      
              console.info("AttestationService add indiv attestation")
              const uid = await AttestationService.addIndivOrgAttestation(attestation, walletSigner, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, issuerAccountClient)
            }
          }
        }

        AttestationService.getIndivOrgAttestation(indivDid, AttestationService.IndivOrgSchemaUID, "indiv-org").then((indivOrgAttestation) => {
          if (!indivOrgAttestation) {
            console.info("=============> no indiv org attestation so add one")
            addIndivOrgAttestation()
          }
        })
        
      }
      
      
    }, [signatory, orgDid, indivDid, issuerDid, orgAccountClient, orgIndivDelegation, orgIssuerDelegation]);
    */
    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      //entryPoint: { address: ENTRY_POINT_ADDRESS, version: '0.7' },
    });

    const setIndivAndOrgInfo = async (indivName: string, orgName: string, indivEmail: string ) => {
      setOrgName(orgName)
      setIndivName(indivName)
      setIndivEmail(indivEmail)
    }
    const buildSmartWallet = async (owner: any, signatory: any, ) => {

      if (signatory && owner) {


        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });


        
        if (publicClient) {

          // build individuals AA for EOA Connected Wallet
          const indivAccountClient = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [owner, [], [], []],
            signatory: signatory,
            deploySalt: toHex(1),
          });

          const indivAddress = await indivAccountClient.getAddress()
          let indivDid = 'did:pkh:eip155:10:' + indivAccountClient.address
          setIndivDid(indivDid)
          setIndivAccountClient(indivAccountClient)

          // get attestation for individual account abstraction address
          const indivOrgAttestation = await AttestationService.getIndivOrgAttestation(indivDid, AttestationService.IndivOrgSchemaUID, "indiv-org");

          let orgAddressValue : `0x${string}` | undefined
          let orgDidValue : string | undefined

          // if orgDid is already defined then use it
          if (orgDid) {
            orgDidValue = orgDid
            orgAddressValue = orgDid.replace('did:pkh:eip155:10:', '') as `0x${string}`
          }


          // user can enter this part in four states
          //  1) new to site with new individual and new organization
          //  2) new to site with new individual and existing organization found my email match
          //  3) new to site with new individual (indiv-org attestation was added with delegation) and existing organization found by email match
          //  4) return to site with existing individual and existing owned organization with delegation

          // case 3 with delegation existing that points to existing organization
          // if indiv-org attestation already exists then lets find org name from the associated org delegation in attestation and use it
          let orgIndivDel : any | undefined
          if (indivOrgAttestation) {
            orgIndivDel = JSON.parse((indivOrgAttestation as IndivOrgAttestation).rolecid)
            setOrgIndivDelegation(orgIndivDel)

            if (indivAddress == orgIndivDel.delegate) {
              console.info("*********** valid individual-org attestation so lets use this org address")
              // need to validate signature at some point
              orgAddressValue = orgIndivDel.delegator
              orgDidValue = 'did:pkh:eip155:10:' + orgAddressValue
            }
          }

            
          // build orgs AA associated with individual, connect to existing if already built
          let orgAccountClient : any | undefined
          if (orgAddressValue) {

            let isOwner = false
            const code = await publicClient.getCode({ address: orgAddressValue });
            const isDeployed = code !== '0x';
            if (isDeployed) {
              const data = '0x8da5cb5b';
              const provider = new ethers.BrowserProvider(window.ethereum);
              const returnData = await provider.call({ to: orgAddressValue, data });
              const coder = new AbiCoder();
              const [onChainOwner] = coder.decode(['address'], returnData);
              isOwner = onChainOwner.toLowerCase() == owner.toLowerCase()
            }

            

            // if the user is owner of org or has been given delegatee access to it
            if (isOwner || orgIndivDel) {

              console.info("==========>  the user is owner of org or has been given delegatee access to it ")

              orgAccountClient = await toMetaMaskSmartAccount({
                address: orgAddressValue,
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [owner, [], [], []],
                signatory: signatory,
                deploySalt: toHex(0),
              });

              orgDidValue = 'did:pkh:eip155:10:' + orgAddressValue
              setOrgDid(orgDidValue)
              setOrgAccountClient(orgAccountClient)
            }
            else {
              console.info("==========>  the user does not have access to org account abstraction ")
            }

          }
          else {
            // this is first time through so create new org AA and deploy it
            console.info("==========>  this is first time through so create new org AA and deploy it ")
            orgAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(0),
            });
            orgAddressValue = orgAccountClient.address
            orgDidValue = 'did:pkh:eip155:10:' + orgAddressValue

            setOrgDid(orgDidValue)
            setOrgAccountClient(orgAccountClient)

            // I'm not sure if we need to deploy AA's to setup delegation,  going to comment it out for now
            const bundlerClient = createBundlerClient({
              transport: http(BUNDLER_URL),
              paymaster: createPaymasterClient({
                transport: http(PAYMASTER_URL),
              }),
              chain: optimism,
              paymasterContext: {
                // at minimum this must be an object; for Biconomy you can use:
                mode:             'SPONSORED',
                calculateGasLimits: true,
                expiryDuration:  300,
              },
            });
  
            


            // setup delegation between them
            orgIndivDel = createDelegation({
              to: indivAccountClient.address,
              from: orgAccountClient.address,
              caveats: [] }
            );
  
            const signature = await orgAccountClient.signDelegation({
              delegation: orgIndivDel,
            });
  
            orgIndivDel = {
              ...orgIndivDel,
              signature,
            }
  
            setOrgIndivDelegation(orgIndivDel)

          }

        }

      }
    }

    const setupSmartWallet = async (owner: any, signatory: any, ) => {

      if (owner && signatory) {

        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });
        const walletClient = signatory.walletClient

        /*
          // configure snaps if not already configured
          const walletClient = signatory.walletClient
          const snapResponse = await walletClient.request({
            method: 'wallet_getSnaps',
          })

          const snps = snapResponse as GetSnapsResponse
        
          const snapId = "local:http://localhost:8080"
          const snap = snps?.[snapId]

          if (snap == undefined) {
            const snapId = "local:http://localhost:8080"
            const snapRequestResponse = await walletClient.request({
              method: 'wallet_requestSnaps',
              params: {
                [snapId]: {} ,
              },
            })
          }
          */

        // connect to issuer account abstraction
        const issuerOwner = privateKeyToAccount(ISSUER_PRIVATE_KEY);
        const issuerAccountClient = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [issuerOwner.address, [], [], []],
          signatory: { account: issuerOwner },
          deploySalt: toHex(0),
        })

        console.info("issuerAccountClient: ", issuerAccountClient)

        let issuerDid = 'did:pkh:eip155:10:' + issuerAccountClient.address
        setIssuerDid(issuerDid)
        setIssuerAccountClient(issuerAccountClient)

        if (orgIndivDelegation) {

          console.info("user has orgIndivDelegation to manage org")

          // setup delegation for org to issuer -> redelegation of orgIndivDel
          let orgIssuerDel  = null
          orgIssuerDel = await DelegationService.getDelegationFromStorage(walletClient, owner, orgAccountClient.address, issuerAccountClient.address)
          if (orgIssuerDel == null && indivDid) {

            const parentDelegationHash = getDelegationHashOffchain(orgIndivDelegation);
            orgIssuerDel = createDelegation({
              to: issuerAccountClient.address,
              from: indivAccountClient.address,
              parentDelegation: parentDelegationHash,
              caveats: []
            });


            const signature = await indivAccountClient.signDelegation({
              delegation: orgIssuerDel,
            });


            orgIssuerDel = {
              ...orgIssuerDel,
              signature,
            }

            await DelegationService.saveDelegationToStorage(walletClient, owner, orgAccountClient.address, issuerAccountClient.address, orgIssuerDel)
          }

          if (orgIssuerDel) {
            setOrgIssuerDelegation(orgIssuerDel)
          }

          // add new org attestation
          const addOrgAttestation = async () => {

            console.info("*********** ADD ORG ATTESTATION ****************")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "org"
        
            console.info(".........1 ", walletSigner, walletClient, orgName, orgDid, orgIssuerDel)
            if (walletSigner && walletClient && orgName && orgDid && orgIssuerDel) {
        
              const vc = await VerifiableCredentialsService.createOrgVC(entityId, orgDid, issuerDid, orgName);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient)
              const fullVc = result.vc
              const proofUrl = result.proofUrl
              console.info(".........2 ")
              if (fullVc) {
              
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: OrgAttestation = {
                  name: orgName,
                  attester: orgDid,
                  class: "organization",
                  category: "wallet",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: issuerDid,
                  proof: proofUrl
                };
        
                console.info("AttestationService add indiv attestation")
                const uid = await AttestationService.addOrgAttestation(attestation, walletSigner, [orgIssuerDel, orgIndivDelegation], orgAccountClient, issuerAccountClient)
              }
            }
          }

          console.info("===========> : ", indivDid, orgDid)
          if (indivDid && orgDid) {
            console.info(" get att")
            const orgAttestation = await AttestationService.getAttestationByAddressAndSchemaId(orgDid, AttestationService.OrgSchemaUID, "org")
            if (!orgAttestation) {
              console.info("=============> no org attestation so add one")
              addOrgAttestation()
            }
          }




          // add new org indiv attestation
          const addIndivOrgAttestation = async () => {

            console.info("*********** ADD INDIV ATTESTATION ****************")

            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "indiv-org"
        
            if (walletSigner && walletClient && indivDid && orgDid && orgIssuerDel) {

              let indName = "indiv name"
              if (indivName) {
                indName = indivName
              }
              
        
              const vc = await VerifiableCredentialsService.createIndivOrgVC(entityId, orgDid, issuerDid, indivDid, indName);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient)
              const fullVc = result.vc
              const proofUrl = result.proofUrl

              if (fullVc) {

                
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: IndivOrgAttestation = {
                  indivDid: indivDid,
                  name: indName,
                  rolecid: JSON.stringify(orgIndivDelegation),
                  attester: orgDid,
                  class: "organization",
                  category: "leaders",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: issuerDid,
                  proof: proofUrl
                };
        
                console.info("AttestationService add indiv org attestation")
                const uid = await AttestationService.addIndivOrgAttestation(attestation, walletSigner, [orgIssuerDel, orgIndivDelegation], orgAccountClient, issuerAccountClient)
              }
            }
          }

          if (indivDid && orgDid) {
            const indivOrgAttestation = await AttestationService.getIndivOrgAttestation(indivDid, AttestationService.IndivOrgSchemaUID, "indiv-org")
            if (!indivOrgAttestation) {
              console.info("=============> no indiv attestation so add one")
              addIndivOrgAttestation()
            }
          }
          
        }
      

        if (indivAccountClient && issuerAccountClient) {

          // setup delegation for individual to issuer delegation
          let indivIssuerDel = null
          indivIssuerDel = await DelegationService.getDelegationFromStorage(walletClient, owner, indivAccountClient.address, issuerAccountClient.address)
          if (indivIssuerDel == null && indivDid) {

            console.info("delegation does not exist for indiv-issuer so create one")
            indivIssuerDel = createDelegation({
              from: indivAccountClient.address,
              to: issuerAccountClient.address,
              caveats: [] }
            );

            const signature = await indivAccountClient.signDelegation({
              delegation: indivIssuerDel,
            });


            indivIssuerDel = {
              ...indivIssuerDel,
              signature,
            }





            /*
            const code1 = await publicClient.getCode({ address: indivAccountClient.address });
            const isDeployed1 = code1 !== '0x';
            console.info(" is indiv AA address: ", indivAccountClient.address)
            console.info(" is indiv AA deployed: ", isDeployed1)

            const code2 = await publicClient.getCode({ address: issuerAccountClient.address });
            const isDeployed2 = code2 !== '0x';
            console.info(" is issuer AA address: ", issuerAccountClient.address)
            console.info(" is issuer AA deployed: ", isDeployed2)
            */





    
            /*
            console.info("test send on indiv user to issuer delegation")
            const pimlicoClient = createPimlicoClient({
              transport: http(BUNDLER_URL),
              //entryPoint: { address: ENTRY_POINT_ADDRESS, version: '0.7' },
            });
            const bundlerClient = createBundlerClient({
                            transport: http(BUNDLER_URL),
                            paymaster: createPaymasterClient({
                              transport: http(PAYMASTER_URL),
                            }),
                            chain: optimism,
                            paymasterContext: {
                              // at minimum this must be an object; for Biconomy you can use:
                              mode:             'SPONSORED',
                              //calculateGasLimits: true,
                              //expiryDuration:  300,
                            },
                          });

            console.info("set execution")
            const executions = [
              {
                target: zeroAddress,
                value: 0n,
                callData: "0x",
              },
            ];

            console.info("redeemDelegations")
            const delegationChain = [indivIssuerDel]
            const data = DelegationFramework.encode.redeemDelegations({
                  delegations: [ delegationChain ],
                  modes: [SINGLE_DEFAULT_MODE],
                  executions: [executions]
                });
            
            console.info("get fee")
            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

            try {
              console.info("fee: ", fee)
              console.info("issuerAccountClient: ", issuerAccountClient)
              console.info("delegation: ", indivIssuerDel)
              let userOpHash = await bundlerClient.sendUserOperation({
                account: issuerAccountClient,
                calls: [
                  {
                    to: getDeleGatorEnvironment(optimism.id).DelegationManager.
                    data,
                  },
                ],
                ...fee,
              });
        
        
            
              console.info("wait for receipt")
              const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
              console.info("user op receipt: ", userOperationReceipt)
            }
            catch (error) {
              console.info("error: ", error)
            }
            */




            console.info("&&&&&&&&&&&&&& Save indIssuerDelegation: ", indivIssuerDel)
            await DelegationService.saveDelegationToStorage(walletClient, owner, indivAccountClient.address, issuerAccountClient.address, indivIssuerDel)
          }

          setIndivIssuerDelegation(indivIssuerDel)

          // add indiv  attestation
          const addIndivAttestation = async () => {

            console.info("*********** ADD INDIV ATTESTATION ****************")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "indiv"
        
            if (walletSigner && walletClient && indivDid && orgDid) {

              let indName = "name";
              if (indivName) {
                indName = indivName
              }
        
              const vc = await VerifiableCredentialsService.createIndivVC(entityId, indivDid, issuerDid, orgDid, indName);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, indivDid, walletClient, issuerAccountClient)
              const fullVc = result.vc
              const proofUrl = result.proofUrl

              if (fullVc) {
              
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: IndivAttestation = {
                  orgDid: orgDid,
                  name: indName,
                  attester: indivDid,
                  class: "individual",
                  category: "wallet",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: issuerDid,
                  proof: proofUrl
                };

                const uid = await AttestationService.addIndivAttestation(attestation, walletSigner, [indivIssuerDel], indivAccountClient, issuerAccountClient)
              }
            }
          }
          
          // add indiv email attestation
          const addIndivEmailAttestation = async () => {

            console.info("*********** ADD INDIV EMAIL ATTESTATION ****************")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "indiv-email"
        
            if (walletSigner && walletClient && indivDid) {

              let indEmail = "email";
              if (indivEmail) {
                indEmail = indivEmail
              }
        
              const vc = await VerifiableCredentialsService.createIndivEmailVC(entityId, indivDid, issuerDid, "business", indEmail);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, indivDid, walletClient, issuerAccountClient)
              const fullVc = result.vc
              const proofUrl = result.proofUrl

              if (fullVc) {
              
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: IndivEmailAttestation = {
                  type: "business",
                  email: indEmail,
                  attester: indivDid,
                  class: "individual",
                  category: "profile",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: issuerDid,
                  proof: proofUrl
                };
        
                console.info("+++++++++++++ AttestationService add indiv attestation")
                console.info("+++++++++++++ att: ", attestation)
                console.info("+++++++++++++ del: ", indivIssuerDel)
                console.info("+++++++++++++ indivAccountClient: ", indivAccountClient)
                console.info("+++++++++++++ issuerAccountClient: ", issuerAccountClient)

                const code1 = await publicClient.getCode({ address: indivAccountClient.address });
                const isDeployed1 = code1 !== '0x';
                console.info(" is indiv AA deployed: ", isDeployed1)

                const code2 = await publicClient.getCode({ address: issuerAccountClient.address });
                const isDeployed2 = code2 !== '0x';
                console.info(" is issuer AA deployed: ", isDeployed2)

                const uid = await AttestationService.addIndivEmailAttestation(attestation, walletSigner, [indivIssuerDel], indivAccountClient, issuerAccountClient)
              }
            }
          }

          if (indivDid && orgDid && indivIssuerDel) {
            const indivAttestation = await AttestationService.getAttestationByAddressAndSchemaId(indivDid, AttestationService.IndivSchemaUID, "indiv")
            if (!indivAttestation) {
              addIndivAttestation()
            }

            const indivEmailAttestation = await AttestationService.getAttestationByAddressAndSchemaId(indivDid, AttestationService.IndivEmailSchemaUID, "indiv-email")
            if (!indivEmailAttestation) {
              addIndivEmailAttestation()
            }
          }
        }


      }
    }

    const connect = async (owner: any, signatory: any, organizationName: string, fullName: string, email: string) => {
      setSignatory(signatory)
      setOwner(owner)
    }
    return {
            
            orgDid,
            indivDid,
            issuerDid,

            indivName,
            orgName,

            isIndividualConnected,


            issuerAccountClient,
            orgAccountClient,
            indivAccountClient,

            signatory,
            
            orgIndivDelegation,
            orgIssuerDelegation,
            indivIssuerDelegation,

            selectedSignatory,

            connect,
            setIndivAndOrgInfo,
            buildSmartWallet,
            setupSmartWallet,
            setOrgNameValue,
            setOrgDidValue,

    }
        
}

export const WalletConnectContextProvider = ({ children }: { children: any }) => {
    const {

      orgDid, 
      indivDid,
      issuerDid,

      indivName,
      orgName,

      isIndividualConnected,

      issuerAccountClient,
      orgAccountClient,
      indivAccountClient,

      orgIndivDelegation,
      orgIssuerDelegation,
      indivIssuerDelegation,

      connect, 
      setIndivAndOrgInfo,
      buildSmartWallet,
      setupSmartWallet,

      selectedSignatory,
      signatory,
      
      setOrgNameValue,
      setOrgDidValue
    } =
      useWalletConnect();
  
    const providerProps = useMemo(
      () => ({

        orgDid,
        indivDid,
        issuerDid,

        indivName,
        orgName,

        isIndividualConnected,

        issuerAccountClient,
        orgAccountClient,
        indivAccountClient,

        orgIndivDelegation,
        orgIssuerDelegation,
        indivIssuerDelegation,

        selectedSignatory,
        signatory,
        connect,
        setIndivAndOrgInfo,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue,
        setOrgDidValue
      }),
      [
        
        indivName,
        orgName,

        orgDid,
        indivDid, 
        issuerDid,

        isIndividualConnected,

        issuerAccountClient,
        orgAccountClient,
        indivAccountClient,

        orgIndivDelegation,
        orgIssuerDelegation,
        indivIssuerDelegation,

        selectedSignatory,
        signatory,
        connect,
        setIndivAndOrgInfo,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue,
        setOrgDidValue]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
};




export const useWallectConnectContext = () => useContext(WalletConnectContext);