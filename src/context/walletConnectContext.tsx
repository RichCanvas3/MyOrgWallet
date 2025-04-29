import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount, useWalletClient } from "wagmi";

import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage  } from "viem";
import { keccak256, toUtf8Bytes } from 'ethers';


import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, BUNDLER_URL, PAYMASTER_URL} from "../config";

import type {
  SignatoryFactory,
} from "../signers/SignatoryTypes";

import {
  useSelectedSignatory
} from "../signers/useSelectedSignatory";


import { ethers } from 'ethers';
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
  Delegation
} from "@metamask/delegation-toolkit";


import {
  createBundlerClient,
  createPaymasterClient,
  UserOperationReceipt,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";

import { DIDSession } from 'did-session';
import { AccountId } from 'caip';
import { EthereumWebAuth } from '@didtools/pkh-ethereum';
import { optimism } from "viem/chains";

import DelegationService from "../service/DelegationService"

import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem, DelegatedProxyAttestationVersion } from '@ethereum-attestation-service/eas-sdk';
import { DeveloperBoard } from "@mui/icons-material";

import { IndivAttestation } from "../models/Attestation";
import AttestationService from "../service/AttestationService";
import VerifiableCredentialsService from "../service/VerifiableCredentialsService";

const SESSION_KEY = 'didSession';

export type GetSnapsResponse = Record<string, Snap>;
export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export type WalletConnectContextState = {
    connect: (orgAddress: string, walletClient: WalletClient, organizationName: string, fullName: string, email: string) => Promise<void>;
    buildSmartWallet: (owner: any, signatory: any, ) => Promise<void>;
    setupSmartWallet: (owner: any, signatory: any, ) => Promise<void>;

    orgDid?: string;
    indivDid?: string;
    issuerDid?: string;

    orgName?: string;

    issuerAccountClient?: any;
    orgAccountClient?: any;
    indivAccountClient?: any;

    orgIndivDelegation?: Delegation,
    orgIssuerDelegation?: Delegation,
    indivIssuerDelegation?: Delegation,

    orgAccountSessionKeyAddress?: any,
    orgAccountSessionStorageClient?: any,
    session?: DIDSession;
    signer?: ethers.JsonRpcSigner,
    selectedSignatory?: SignatoryFactory,
    signatory?: any,
    
    setOrgNameValue: (orgNameValue: string) => Promise<void>,
    
    isIndividualConnected: boolean
}

export const WalletConnectContext = createContext<WalletConnectContextState>({
  
  orgDid: undefined,
  indivDid: undefined,
  issuerDid: undefined,

  orgName: undefined,


  issuerAccountClient: undefined,
  orgAccountClient: undefined,
  indivAccountClient: undefined,

  orgIndivDelegation: undefined,
  orgIssuerDelegation: undefined,
  indivIssuerDelegation: undefined,

  orgAccountSessionKeyAddress: undefined,
  orgAccountSessionStorageClient: undefined,
  session: undefined,
  signer: undefined,
  signatory: undefined,

  isIndividualConnected: false,



  connect: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  buildSmartWallet: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  setupSmartWallet: () => {
    throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
  },
  setOrgNameValue: async (orgNameValue: string) => {},

})



export const useWalletConnect = () => {

    const [orgDid, setOrgDid] = useState<string>();
    const [indivDid, setIndivDid] = useState<string>();
    const [issuerDid, setIssuerDid] = useState<string>();

    const [orgName, setOrgName] = useState<string>();

    const [isIndividualConnected, setIsIndividualConnected] = useState<boolean>();


    
    const [orgAccountSessionKeyAddress, setOrgAccountSessionKeyAddress] = useState<any>();
    const [orgAccountSessionStorageClient, setOrgAccountSessionStorageClient] = useState<any>();
    const [session, setSession] = useState<DIDSession | undefined>();
    const [signer, setSigner] = useState<ethers.JsonRpcSigner>();
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

    const { isConnected, address: web3ModalAddress, chain } = useAccount();

    const [connectedAddress, setConnectedAddress] = useState<string | undefined>();




    useEffect(() => {

        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });
      

        //console.info("........ if connection to wallet has changed then update info .........")
        if (!chain || !isConnected || (connectedAddress && web3ModalAddress !== connectedAddress)) {
          setConnectedAddress(undefined);
        }

        console.info("*************  set signatory to injectedProviderSignatoryFactory ************")
        setSelectedSignatoryName("injectedProviderSignatoryFactory")
        



    }, [chain, isConnected, web3ModalAddress, connectedAddress]);


    useEffect(() => {

      if (signatory && owner) {

        // this is hybrid signatory so might have a wallet client
        const walletClient = signatory.walletClient

        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });


        const getConnected = async () => {

          // need to refactor the walletSigner stuff
          const provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const walletSigner = await provider.getSigner();
          setSigner(walletSigner)


          // not using session for ceramic storage so need to refactor

          // Initialize metamask wallet session and give access to ceramic datastore
          let ownerEOAAddress = owner
          console.info("ownerEOAAddress: ", ownerEOAAddress)

          const accountId  = new AccountId({chainId: "eip155:10", address: owner})
          const authMethod = await EthereumWebAuth.getAuthMethod(publicClient, accountId);
        
          // Authorize DID session
          
          let thisSession = session
          if (session === undefined) {
            const sessionStr = localStorage.getItem(SESSION_KEY);
            if (sessionStr) {
              thisSession = await DIDSession.fromSession(sessionStr);
              setSession(thisSession);
              //console.log('Authorized DID 2:', JSON.stringify(ss.did));
            }
            else {
              thisSession = await DIDSession.authorize(authMethod, {
                resources: [`ceramic://*`],
                expiresInSecs: 60 * 60 * 24 * 7
              });

              localStorage.setItem(SESSION_KEY, thisSession.serialize());
              setSession(thisSession);
              //console.log('Authorized DID 1:', JSON.stringify(ss.did));
            }
          }
          
          // configure snaps if not already configured
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

            console.info("issuerAccountClient: ", issuerAccountClient)

            //const message = "hello world"
            //const signed = await issuerAccountClient.signMessage({message})
            //console.info(">>>>>>>>>>>>>>>>>> signed message: ", signed)
    
            let issuerDid = 'did:pkh:eip155:10:' + issuerAccountClient.address
            setIssuerDid(issuerDid)
            setIssuerAccountClient(issuerAccountClient)



            // connect to individual account abstraction
            console.info("individual authenticated owner EOA address: ", owner)
            const indivAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(1),
            });

            const indivAddress = await indivAccountClient.getAddress()
            console.info("individual authenticated owner AA address: ", indivAddress)


            // connect to org account abstraction
            let indivDid = 'did:pkh:eip155:10:' + indivAccountClient.address
            setIndivDid(indivDid)
            setIndivAccountClient(indivAccountClient)

            const indivAttestation = await AttestationService.getIndivAttestation(indivDid, AttestationService.IndivSchemaUID, "indiv");
            console.info("==========> get indiv attestation: ")
            console.info("==========> indivDid: ", indivDid)
            console.info("==========> att: ", indivAttestation)

            let orgIndivDel : any | undefined
            let delegationOrgAddress : `0x${string}` | undefined
            if (indivAttestation) {
              orgIndivDel = JSON.parse((indivAttestation as IndivAttestation).rolecid)
              if (indivAddress == orgIndivDel.delegate) {
                console.info("*********** valid individual attestation so lets use this org address")
                // need to validate signature at some point
                delegationOrgAddress = orgIndivDel.delegator
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
              console.info("==========>  org address not defined ")
              orgAccountClient = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [owner, [], [], []],
                signatory: signatory,
                deploySalt: toHex(0),
              });
            }

            console.info("org account client aa address: ", orgAccountClient.address)

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















            // deploy orgAccountClient
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




            
            

            /*
            walletSigner.provider.getBalance(swa).then((balance) => {
              console.info("balance: ", balance)
            })
            walletSigner.provider.getBalance("0x9Be0417505e235FfFbd995C250e40561847777f3").then((balance) => {
              console.info("balance: ", balance)
            })
            */


            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
            

            let userOpHash2 = await bundlerClient.sendUserOperation({
              account: indivAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });

            const receipt2 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash2,
            });
            console.info("%%%%%%%%%%%%%%  receipt2: ", receipt2)


            if (indivDid && orgIndivDel == null) {

              console.info("------------  CONSTRUCT ORG INDIV DELEGATION ----------")
              console.info("ownerEOAAddress: ", ownerEOAAddress)
              console.info("to: ", indivAccountClient.address)
              console.info("from: ", orgAccountClient.address)

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

            }
            else {
              console.info("indiv delegation already exists")
              console.info("ownerEOAAddress: ", ownerEOAAddress)
              console.info("to: ", indivAccountClient.address)
              console.info("from: ", orgAccountClient.address)
            }

            if (orgIndivDel) {
              setOrgIndivDelegation(orgIndivDel)
            }
            
            
            // setup delegation for org to issuer -> redelegation of orgIndivDel
            let orgIssuerDel  = null
            try {
              orgIssuerDel = await DelegationService.getDelegationFromSnap(walletClient, ownerEOAAddress, orgAccountClient.address, issuerAccountClient.address)
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

              await DelegationService.saveDelegationToSnap(walletClient, ownerEOAAddress, orgAccountClient.address, issuerAccountClient.address, orgIssuerDel)
            }

            if (orgIssuerDel) {
              setOrgIssuerDelegation(orgIssuerDel)
            }
            


            // setup delegation for individual to issuer delegation
            let indivIssuerDel = null

            try {
              indivIssuerDel = await DelegationService.getDelegationFromSnap(walletClient, ownerEOAAddress, indivAccountClient.address, issuerAccountClient.address)
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

              await DelegationService.saveDelegationToSnap(walletClient, ownerEOAAddress, indivAccountClient.address, issuerAccountClient.address, indivIssuerDel)
            }

            setIndivIssuerDelegation(indivIssuerDel)
            setIsIndividualConnected(true)


          }
        }
        
        getConnected()
      }

    }, [signatory, owner]);

    useEffect(() => {
  
      console.info("===========> check to see if we need to add individual attestation")
      if (signatory && orgDid && indivDid && issuerDid && orgAccountClient && orgIndivDelegation && orgIssuerDelegation) {
        const addIndivAttestation = async () => {

          console.info("*********** ADD INDIV ATTESTATION ****************")
      
          const walletClient = signatory.walletClient
          const entityId = "indiv"
      
          if (signer && walletClient && session) {
      
            const indivName = ""
      
            const vc = await VerifiableCredentialsService.createIndivVC(entityId, orgDid, issuerDid, indivDid, indivName);
            const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
            const fullVc = result.vc
            const proofUrl = result.proofUrl

            if (fullVc) {

              const indivName = "indiv name"
            
              // now create attestation
              const hash = keccak256(toUtf8Bytes("hash value"));
              const attestation: IndivAttestation = {
                indivDid: indivDid,
                name: indivName,
                rolecid: JSON.stringify(orgIndivDelegation),
                attester: orgDid,
                class: "organization",
                category: "people",
                entityId: entityId,
                hash: hash,
                vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                vciss: issuerDid,
                proof: proofUrl
              };
      
              console.info("AttestationService add indiv attestation")
              const uid = await AttestationService.addIndivAttestation(attestation, signer, [orgIssuerDelegation, orgIndivDelegation], orgAccountClient, issuerAccountClient)
            }
          }
        }

        AttestationService.getIndivAttestation(indivDid, AttestationService.IndivSchemaUID, "indiv").then((indivAttestation) => {
          if (!indivAttestation) {
            console.info("=============> no indiv attestation so add one")
            addIndivAttestation()
          }
        })
        
      }
      
      
    }, [signatory, orgDid, indivDid, issuerDid, orgAccountClient, orgIndivDelegation, orgIssuerDelegation]);

    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      //entryPoint: { address: ENTRY_POINT_ADDRESS, version: '0.7' },
    });

    const buildSmartWallet = async (owner: any, signatory: any, ) => {
      console.info(".......... build smart wallet ...............")
      console.info("signatory: ", signatory)
      console.info("owner: ", owner)
      if (signatory && owner) {

        console.info(" ........  everything is ready .........")

        // this is hybrid signatory so might have a wallet client
        const walletClient = signatory.walletClient

        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
        });



        // need to refactor the walletSigner stuff
        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletSigner = await provider.getSigner();
        setSigner(walletSigner)

        // Initialize metamask wallet session and give access to ceramic datastore
        let ownerEOAAddress = owner
        console.info("ownerEOAAddress: ", ownerEOAAddress)

        const accountId  = new AccountId({chainId: "eip155:10", address: owner})
        const authMethod = await EthereumWebAuth.getAuthMethod(publicClient, accountId);
      
        // Authorize DID session
        let thisSession = session
        if (session === undefined) {
          const sessionStr = localStorage.getItem(SESSION_KEY);
          if (sessionStr) {
            thisSession = await DIDSession.fromSession(sessionStr);
            setSession(thisSession);
            //console.log('Authorized DID 2:', JSON.stringify(ss.did));
          }
          else {
            thisSession = await DIDSession.authorize(authMethod, {
              resources: [`ceramic://*`],
              expiresInSecs: 60 * 60 * 24 * 7
            });

            localStorage.setItem(SESSION_KEY, thisSession.serialize());
            setSession(thisSession);
            //console.log('Authorized DID 1:', JSON.stringify(ss.did));
          }
        }
        

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
          const indivAttestation = await AttestationService.getIndivAttestation(indivDid, AttestationService.IndivSchemaUID, "indiv");


          // if it exists then lets find org name from the associated org delegation in attestation
          let orgIndivDel : any | undefined
          let delegationOrgAddress : `0x${string}` | undefined
          if (indivAttestation) {
            orgIndivDel = JSON.parse((indivAttestation as IndivAttestation).rolecid)
            setOrgIndivDelegation(orgIndivDel)

            if (indivAddress == orgIndivDel.delegate) {
              console.info("*********** valid individual attestation so lets use this org address")
              // need to validate signature at some point
              delegationOrgAddress = orgIndivDel.delegator
            }
          }

            
          // build orgs AA associated with individual, connect to existing if already built
          let orgAccountClient : any | undefined
          if (delegationOrgAddress) {
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
            console.info("==========>  org address not defined ")
            orgAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(0),
            });
          }

          let orgDid = 'did:pkh:eip155:10:' + orgAccountClient.address
          setOrgDid(orgDid)
          setOrgAccountClient(orgAccountClient)

          // deploy these two AA's and setup delegation between org and individual if it is not already defined
          if (!orgIndivDel) {

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
    
    
            // this is probably not needed to setup delegation
            // deploy individual AA
            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
            let userOpHash1 = await bundlerClient.sendUserOperation({
              account: indivAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });
            const receipt1 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash1,
            });

            // deploy organization AA
            let userOpHash2 = await bundlerClient.sendUserOperation({
              account: indivAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });
            const receipt2 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash2,
            });
            

            // setup delegation between them
            let orgIndivDel = createDelegation({
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

      if (owner && signatory && orgIndivDelegation) {

        const publicClient = createPublicClient({
          chain: optimism,
          transport: http(),
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
            calculateGasLimits: true,
            expiryDuration:  300,
          },
        });


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



        // setup delegation for org to issuer -> redelegation of orgIndivDel
        let orgIssuerDel  = null
        try {
          orgIssuerDel = await DelegationService.getDelegationFromSnap(walletClient, owner, orgAccountClient.address, issuerAccountClient.address)
        }
        catch (error) {
        }

        if (orgIssuerDel == null && orgIndivDelegation && indivDid) {

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

          await DelegationService.saveDelegationToSnap(walletClient, owner, orgAccountClient.address, issuerAccountClient.address, orgIssuerDel)
        }

        if (orgIssuerDel) {
          setOrgIssuerDelegation(orgIssuerDel)
        }
        


        // setup delegation for individual to issuer delegation
        let indivIssuerDel = null

        try {
          indivIssuerDel = await DelegationService.getDelegationFromSnap(walletClient, owner, indivAccountClient.address, issuerAccountClient.address)
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

          await DelegationService.saveDelegationToSnap(walletClient, owner, indivAccountClient.address, issuerAccountClient.address, indivIssuerDel)
        }

        setIndivIssuerDelegation(indivIssuerDel)



        // add new org indiv attestation
        const addIndivAttestation = async () => {

          console.info("*********** ADD INDIV ATTESTATION ****************")
      
          const walletClient = signatory.walletClient
          const entityId = "indiv"
      
          if (signer && walletClient && session && indivDid && orgDid && orgIssuerDel) {
      
            const indivName = ""
      
            const vc = await VerifiableCredentialsService.createIndivVC(entityId, orgDid, issuerDid, indivDid, indivName);
            const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
            const fullVc = result.vc
            const proofUrl = result.proofUrl

            if (fullVc) {

              const indivName = "indiv name"
            
              // now create attestation
              const hash = keccak256(toUtf8Bytes("hash value"));
              const attestation: IndivAttestation = {
                indivDid: indivDid,
                name: indivName,
                rolecid: JSON.stringify(orgIndivDelegation),
                attester: orgDid,
                class: "organization",
                category: "people",
                entityId: entityId,
                hash: hash,
                vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                vciss: issuerDid,
                proof: proofUrl
              };
      
              console.info("AttestationService add indiv attestation")
              const uid = await AttestationService.addIndivAttestation(attestation, signer, [orgIssuerDel, orgIndivDelegation], orgAccountClient, issuerAccountClient)
            }
          }
        }

        if (indivDid && orgDid) {
          AttestationService.getIndivAttestation(indivDid, AttestationService.IndivSchemaUID, "indiv").then((indivAttestation) => {
            if (!indivAttestation) {
              console.info("=============> no indiv attestation so add one")
              addIndivAttestation()
            }
          })
        }
        
      }

    }

    const connect = async (owner: any, signatory: any, organizationName: string, fullName: string, email: string) => {
      console.info("set signatory")
      setSignatory(signatory)
      setOwner(owner)
    }
    return {
            
            orgDid,
            indivDid,
            issuerDid,

            orgName,

            isIndividualConnected,


            issuerAccountClient,
            orgAccountClient,
            indivAccountClient,

            orgAccountSessionKeyAddress,
            orgAccountSessionStorageClient,
            session,
            signer,
            signatory,
            
            orgIndivDelegation,
            orgIssuerDelegation,
            indivIssuerDelegation,

            selectedSignatory,
            connect,
            buildSmartWallet,
            setupSmartWallet,
            setOrgNameValue,
    }
        
}

export const WalletConnectContextProvider = ({ children }: { children: any }) => {
    const {
      
      orgAccountSessionKeyAddress,
      orgAccountSessionStorageClient,

      orgDid, 
      indivDid,
      issuerDid,

      orgName,

      isIndividualConnected,

      issuerAccountClient,
      orgAccountClient,
      indivAccountClient,

      orgIndivDelegation,
      orgIssuerDelegation,
      indivIssuerDelegation,

      connect, 
      buildSmartWallet,
      setupSmartWallet,

      session, 
      signer,
      selectedSignatory,
      signatory,
      
      setOrgNameValue
    } =
      useWalletConnect();
  
    const providerProps = useMemo(
      () => ({
        
        orgAccountSessionKeyAddress,
        orgAccountSessionStorageClient,

        orgDid,
        indivDid,
        issuerDid,

        orgName,

        isIndividualConnected,

        issuerAccountClient,
        orgAccountClient,
        indivAccountClient,

        orgIndivDelegation,
        orgIssuerDelegation,
        indivIssuerDelegation,


        session,
        signer,
        selectedSignatory,
        signatory,
        connect,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue
      }),
      [
        orgAccountSessionKeyAddress,
        orgAccountSessionStorageClient,
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

        session, 
        signer, 
        selectedSignatory,
        signatory,
        connect,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
};




export const useWallectConnectContext = () => useContext(WalletConnectContext);