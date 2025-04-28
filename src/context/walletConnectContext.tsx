import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount, useWalletClient } from "wagmi";

import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage  } from "viem";



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
  DelegationStorageClient
} from "@metamask/delegation-toolkit/experimental";


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

const SESSION_KEY = 'didSession';

export type GetSnapsResponse = Record<string, Snap>;
export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export type WalletConnectContextState = {
    connect: (orgAddress: string, walletClient: WalletClient) => Promise<void>;

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
            
            // create orgAccountClient
            //console.info("create org smart account: ")
            //console.info("public client: ", publicClient)
            //console.info("owner: ", owner)
            //console.info("signatory: ", signatory)
            console.info("@@@@@@@@@@@@@ create org account with fixed aa address: 0x383668f69e39c5D9Dcb2B4b46112de6D2D727905")
            const orgAccountClient = await toMetaMaskSmartAccount({
              address: "0x383668f69e39c5D9Dcb2B4b46112de6D2D727905",
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(0),
            });
            console.info("org account client aa address: ", orgAccountClient.address)






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


            let orgDid = 'did:pkh:eip155:10:' + orgAccountClient.address
            setOrgDid(orgDid)
            setOrgAccountClient(orgAccountClient)

            let indivDid = 'did:pkh:eip155:10:' + indivAccountClient.address
            setIndivDid(indivDid)
            setIndivAccountClient(indivAccountClient)

            /*
            walletSigner.provider.getBalance(swa).then((balance) => {
              console.info("balance: ", balance)
            })
            walletSigner.provider.getBalance("0x9Be0417505e235FfFbd995C250e40561847777f3").then((balance) => {
              console.info("balance: ", balance)
            })
            */


    
            /*
            const burnerPrivateKey = generatePrivateKey();
            const burnerOwner = privateKeyToAccount(burnerPrivateKey);

            const burnerIssuerAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [burnerOwner.address, [], [], []],
              signatory: { account: burnerOwner },
              deploySalt: toHex(3),
            });
            setIssuerAccountClient(burnerIssuerAccountClient)
            */

            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
            
            /*
            
            let userOpHash1 = await bundlerClient.sendUserOperation({
              account: orgAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });
            

            const receipt1 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash1,
            });
            console.info("%%%%%%%%%%%%%%  receipt1: ", receipt1)
            */

            let userOpHash2 = await bundlerClient.sendUserOperation({
              account: indivAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });

            const receipt2 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash2,
            });
            console.info("%%%%%%%%%%%%%%  receipt2: ", receipt2)

            /*
            let userOpHash3 = await bundlerClient.sendUserOperation({
              account: issuerAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });

            const receipt3 = await bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash3,
            });
            console.info("%%%%%%%%%%%%%%  receipt3: ", receipt3)
            */
            


            // setup delegation for org to indiv
            let orgIndivDel = null

            try {
              orgIndivDel = await DelegationService.getDelegationFromSnap(walletClient, ownerEOAAddress, orgAccountClient.address, indivAccountClient.address)
            }
            catch (error) {
            }

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

              await DelegationService.saveDelegationToSnap(walletClient, ownerEOAAddress, orgAccountClient.address, indivAccountClient.address, orgIndivDel)
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
            


            console.info("%%%%%%%%%%%%%%%%%%%%%%%%%5  setup indiv issuer delegation")


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







            // setup org-individual delegation for sam the CFO

            const samCFOEOA = "0x8272226863aacd003975b5c497e366c14d009605"
            const samIndivAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [samCFOEOA, [], [], []],
              signatory: signatory,
              deploySalt: toHex(1),
            });
            console.info("%%%%%%%%% other individual EOA address: ", samCFOEOA)
            console.info("%%%%%%%%% other individual AA address: ", samIndivAccountClient.address)

            let samOrgIndivDel = null
            try {
              samOrgIndivDel = await DelegationService.getDelegationFromSnap(walletClient, samCFOEOA, orgAccountClient.address, samIndivAccountClient.address)
            }
            catch (error) {
            }

            if (samOrgIndivDel == null) {

              console.info("************************   CREATE DELEGATION FOR SAM ************")
              console.info("samCFOEOA: ", samCFOEOA)
              console.info("to: ", samIndivAccountClient.address)
              console.info("from: ", orgAccountClient.address)

              samOrgIndivDel = createDelegation({
                to: samIndivAccountClient.address,
                from: orgAccountClient.address,
                caveats: [] }
              );

              const signature = await orgAccountClient.signDelegation({
                delegation: samOrgIndivDel,
              });
  
  
              samOrgIndivDel = {
                ...samOrgIndivDel,
                signature,
              }

              await DelegationService.saveDelegationToSnap(walletClient, samCFOEOA, orgAccountClient.address, samIndivAccountClient.address, samOrgIndivDel)
            }
            else {
              console.info("************************   SAM's Delegation ************")
              console.info("samCFOEOA: ", samCFOEOA)
              console.info("to: ", samIndivAccountClient.address)
              console.info("from: ", orgAccountClient.address)
              console.info(" del: ", samOrgIndivDel)
            }







            /*

            console.info("************************* create delegation storage client: ", DelegationStorageEnvironment)
            const delegationStorageClient = new DelegationStorageClient({
              apiKey: "47151ebcb9354990941827e05efc536a7d18432a2a9a77502157c877fea82ffb",
              apiKeyId: "92dda3b7-1842-45c0-a06b-32d9ee08cdb5",
              environment: DelegationStorageEnvironment.prod
            });

            console.info("************************* Give storage a try")
            if (delegationStorageClient) {
              const delegationHash = await delegationStorageClient.storeDelegation(delegation);
              console.info("hash: ", delegationHash)
            }
            */







            /*  test connection to account abstraction and creating attestations

            const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"; 
            const OrgSchemaUID = "0xb868c40677eb842bcb2275dbaa311232ff8d57d594c15176e4e4d6f6df9902ea"
            const BaseSchema = "string entityid, bytes32 hash, uint64 issuedate, uint64 expiredate, string vccomm, string vcsig, string vciss, string proof, "
            const OrgSchema = BaseSchema + "string name"
        
            const schemaEncoder = new SchemaEncoder(OrgSchema);
            const schemaItems = [
              { name: 'entityid', value: "", type: 'string' },
              { name: 'hash', value: "", type: 'bytes32' },
              { name: 'issuedate', value: 1, type: 'uint64' },
              { name: 'expiredate', value: 1, type: 'uint64' },
              
              { name: 'vccomm', value: "", type: 'string' },
              { name: 'vcsig', value: "", type: 'string' },
              { name: 'vciss', value: "", type: 'string' },
        
              { name: 'proof', value: "", type: 'string' },
        
              { name: 'name', value: "", type: 'string' },
        
            ];
        
            
            const encodedData = schemaEncoder.encodeData(schemaItems);
        
            const eas = new EAS(EAS_CONTRACT_ADDRESS);
        
            console.info("eas connect")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner();
        

            console.info("...... wallet signer: ", walletSigner)
            eas.connect(walletSigner)
        
        
            console.info("construct eas.attest tx: ", orgAccountClient.address)
            let tx = await eas.attest({
              schema: OrgSchemaUID,
              data: {
                recipient: orgAccountClient.address,
                expirationTime: 0n, // BigInt in v6
                revocable: true,
                data: encodedData
              }
            })
        
      

            const executions: ExecutionStruct[] = [
              {
                target: tx.data.to,
                value: 0n,
                callData: tx.data.data,
              },
            ];

            console.info("redeemDelegations for this transaction delegation: ", delegation)

            const delegationChain : Delegation[] = [delegation];
            const data = DelegationFramework.encode.redeemDelegations({
              delegations: [ delegationChain ],
              modes: [SINGLE_DEFAULT_MODE],
              executions: [executions]
            });
        


            console.info(">>>>>>>>>>>>>>>>>>>  send user operation to delegate: ", delegateAccount)
            userOpHash = await bundlerClient.sendUserOperation({
              account: delegateAccount,
              calls: [
                {
                  to: delegateAccount.address,
                  data,
                },
              ],
              ...fee,
            });

        
            const userOperationReceipt =
              await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

            */

          }
        }
        
        getConnected()
      }

    }, [signatory, owner]);


    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      //entryPoint: { address: ENTRY_POINT_ADDRESS, version: '0.7' },
    });

    const connect = async (owner: any, signatory: any) => {
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
        setOrgNameValue]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
};




export const useWallectConnectContext = () => useContext(WalletConnectContext);