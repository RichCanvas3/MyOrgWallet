import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount, useWalletClient } from "wagmi";

import { createPublicClient, WalletClient, toHex, http, zeroAddress,  } from "viem";
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

import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem } from '@ethereum-attestation-service/eas-sdk';

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
    orgName?: string;
    orgAddress?: string;
    issuerAccountClient?: any;
    orgAccountClient?: any;
    orgDelegateClient?: any;
    orgAccountSessionKeyAddress?: any,
    orgAccountSessionStorageClient?: any,
    session?: DIDSession;
    signer?: ethers.JsonRpcSigner,
    selectedSignatory?: SignatoryFactory,
    signatory?: any,
    delegation?: Delegation,
    setOrgNameValue: (orgNameValue: string) => Promise<void>,
    
}

export const WalletConnectContext = createContext<WalletConnectContextState>({
  issuerAccountClient: undefined,
  orgDid: undefined,
  orgName: undefined,
  orgAddress: undefined,
  orgAccountClient: undefined,
  orgDelegateClient: undefined,
  orgAccountSessionKeyAddress: undefined,
  orgAccountSessionStorageClient: undefined,
  session: undefined,
  signer: undefined,
  signatory: undefined,
  delegation: undefined,

  connect: () => {
      throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
    },
  setOrgNameValue: async (orgNameValue: string) => {},

})



export const useWalletConnect = () => {

    const [orgDid, setOrgDid] = useState<string>();
    const [orgName, setOrgName] = useState<string>();
    const [orgAddress, setOrgAddress] = useState<string>();
    const [orgAccountClient, setOrgAccountClient] = useState<any>();
    const [orgDelegateClient, setOrgDelegateClient] = useState<any>();
    const [issuerAccountClient, setIssuerAccountClient] = useState<any>();
    const [orgAccountSessionKeyAddress, setOrgAccountSessionKeyAddress] = useState<any>();
    const [orgAccountSessionStorageClient, setOrgAccountSessionStorageClient] = useState<any>();
    const [session, setSession] = useState<DIDSession | undefined>();
    const [signer, setSigner] = useState<ethers.JsonRpcSigner>();
    const [signatory, setSignatory] = useState<any | undefined>();
    const [owner, setOwner] = useState<any | undefined>();
    const [delegation, setDelegation] = useState<Delegation | undefined>();
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
        console.log('************************  Org name set:', orgNameValue);
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
        

        // Build RichCanvas authority Smart Wallet DID
        console.info("))))))))))))))))) create issuer account client")
        const issuerOwner = privateKeyToAccount(ISSUER_PRIVATE_KEY);
        toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [issuerOwner.address, [], [], []],
          signatory: { account: issuerOwner },
          deploySalt: toHex(0),
        }).then((issuerAccountClient) => {
          console.info("issuerAccountClient: ", issuerAccountClient)

          //const message = "hello world"
          //const signed = await issuerAccountClient.signMessage({message})
          //console.info(">>>>>>>>>>>>>>>>>> signed message: ", signed)
  
          setIssuerAccountClient(issuerAccountClient)
        });

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
          const accountId  = new AccountId({chainId: "eip155:10", address: owner.address})
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
          walletClient.request({
            method: 'wallet_getSnaps',
            }).then((response: any) => {

              const snps = response as GetSnapsResponse
            
              const snapId = "local:http://localhost:8080"
              const snap = snps?.[snapId]

              if (snap == undefined) {
                const snapId = "local:http://localhost:8080"
                walletClient.request({
                  method: 'wallet_requestSnaps',
                  params: {
                    [snapId]: {} ,
                  },
                }).then((resp: any) => {
                  console.info("snap installed")
                })
              }
            
          })


          if (publicClient && selectedSignatory) {


            // create orgAccountClient
            const orgAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(0),
            });


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
            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
            let userOpHash = await bundlerClient.sendUserOperation({
              account: orgAccountClient,
              calls: [{ to: zeroAddress, data: "0x" }],
              ...fee
            });

            bundlerClient.waitForUserOperationReceipt({
              hash: userOpHash,
            });
            */
    
            
            const swa = await orgAccountClient.getAddress()
            setOrgAddress(swa as `0x${string}`)

            const did = 'did:pkh:eip155:10:' + swa;
            setOrgDid(did)

            setOrgAccountClient(orgAccountClient)

            /*
            walletSigner.provider.getBalance(swa).then((balance) => {
              console.info("balance: ", balance)
            })
            walletSigner.provider.getBalance("0x9Be0417505e235FfFbd995C250e40561847777f3").then((balance) => {
              console.info("balance: ", balance)
            })
            */


    
            const burnerPrivateKey = generatePrivateKey();
            const burnerOwner = privateKeyToAccount(burnerPrivateKey);


            const delegateAccount = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [burnerOwner.address, [], [], []],
              signatory: { account: burnerOwner },
              deploySalt: toHex(3),
            });
            setOrgDelegateClient(delegateAccount)


            const saved = sessionStorage.getItem('myOrgDelegation');
            //if (saved) {
            //  let delegation = JSON.parse(saved);
            //  setDelegation(delegation)
            //}
            //else {
              let delegation = createDelegation({
                to: delegateAccount.address,
                from: orgAccountClient.address,
                caveats: [] }
              );

              const signature = await orgAccountClient.signDelegation({
                delegation,
              });

              delegation = {
                ...delegation,
                signature,
              }

              setDelegation(delegation)

              // persist to sessionStorage
              sessionStorage.setItem(
                'myOrgDelegation',
                JSON.stringify(delegation)
              );
            //}


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
            issuerAccountClient,
            orgDid,
            orgName,
            orgAddress,
            orgAccountClient,
            orgDelegateClient,
            orgAccountSessionKeyAddress,
            orgAccountSessionStorageClient,
            session,
            signer,
            signatory,
            delegation,
            selectedSignatory,
            connect,
            setOrgNameValue,
    }
        
}

export const WalletConnectContextProvider = ({ children }: { children: any }) => {
    const {
      issuerAccountClient,
      orgAccountSessionKeyAddress,
      orgAccountSessionStorageClient,
      orgDid, 
      orgName,
      orgAddress,
      orgAccountClient,
      orgDelegateClient,
      connect, 
      session, 
      signer,
      selectedSignatory,
      signatory,
      delegation,
      setOrgNameValue
    } =
      useWalletConnect();
  
    const providerProps = useMemo(
      () => ({
        issuerAccountClient,
        orgAccountSessionKeyAddress,
        orgAccountSessionStorageClient,
        orgDid,
        orgName,
        orgAddress,
        orgAccountClient,
        orgDelegateClient,
        session,
        signer,
        selectedSignatory,
        signatory,
        delegation,
        connect,
        setOrgNameValue
      }),
      [
        issuerAccountClient,
        orgAccountSessionKeyAddress,
        orgAccountSessionStorageClient,
        orgDid,
        orgName,
        orgAddress,
        orgAccountClient,
        orgDelegateClient,
        session, 
        signer, 
        selectedSignatory,
        signatory,
        delegation,
        connect,
        setOrgNameValue]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
};




export const useWallectConnectContext = () => useContext(WalletConnectContext);