import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount } from "wagmi";
import { WalletClient } from "viem";
import {ISSUER_PRIVATE_KEY} from "../config";


import { ethers } from 'ethers';
import { BiconomySmartAccountV2, createSmartAccountClient, PaymasterMode, createSessionKeyEOA, createSessionSmartAccountClient, getSingleSessionTxParams } from "@biconomy/account";

import { DIDSession } from 'did-session';
import { AccountId } from 'caip';
import { EthereumWebAuth } from '@didtools/pkh-ethereum';

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
    issuerAccountClient?: BiconomySmartAccountV2;
    orgAccountClient?: BiconomySmartAccountV2;
    orgAccountSessionKeyAddress?: any,
    orgAccountSessionStorageClient?: any,
    session?: DIDSession;
    signer?: ethers.JsonRpcSigner,
    setOrgNameValue: (orgNameValue: string) => Promise<void>;
}

export const WalletConnectContext = createContext<WalletConnectContextState>({
  issuerAccountClient: undefined,
  orgDid: undefined,
  orgName: undefined,
  orgAddress: undefined,
  orgAccountClient: undefined,
  orgAccountSessionKeyAddress: undefined,
  orgAccountSessionStorageClient: undefined,
    session: undefined,
    signer: undefined,
    connect: () => {
        throw new Error('WalletConnectContext must be used within a WalletConnectProvider');
      },
    setOrgNameValue: async (orgNameValue: string) => {},

})


export const useWalletConnect = () => {

    const [orgDid, setOrgDid] = useState<string>();
    const [orgName, setOrgName] = useState<string>();
    const [orgAddress, setOrgAddress] = useState<string>();
    const [orgAccountClient, setOrgAccountClient] = useState<BiconomySmartAccountV2>();
    const [issuerAccountClient, setIssuerAccountClient] = useState<BiconomySmartAccountV2>();
    const [orgAccountSessionKeyAddress, setOrgAccountSessionKeyAddress] = useState<any>();
    const [orgAccountSessionStorageClient, setOrgAccountSessionStorageClient] = useState<any>();
    const [session, setSession] = useState<DIDSession | undefined>();
    const [signer, setSigner] = useState<ethers.JsonRpcSigner>();

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
        //console.info("........ if connection to wallet has changed then update info .........")
        if (!chain || !isConnected || (connectedAddress && web3ModalAddress !== connectedAddress)) {
          setConnectedAddress(undefined);
        }
      }, [chain, isConnected, web3ModalAddress, connectedAddress]);

      


    const connect = async (address: string, walletClient: WalletClient) => {
      
      if (address && walletClient) {

          // Build RichCanvas authority Smart Wallet DID
          
          // Initialize Biconomy Smart Account
          const rpcUrl = "https://opt-mainnet.g.alchemy.com/v2/UXKG7nGL5a0mdDhvP-2ScOaLiRIM0rsW"
          const provider = new ethers.JsonRpcProvider(rpcUrl);

          const issuerSigner = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider)
          const issuerAccountClient = await createSmartAccountClient({
            signer: issuerSigner,
            bundlerUrl: "https://bundler.biconomy.io/api/v2/10/94d7c93d-8f7c-406f-8b15-dc68ad1bf5a1", 
            paymasterUrl: "https://paymaster.biconomy.io/api/v1/10/p-KEFt8JW.1da34986-b260-4e01-ad68-af0b953aaa39",
            rpcUrl: rpcUrl
          });
          setIssuerAccountClient(issuerAccountClient)


          


          // Initialize metamask wallet session and give access to ceramic datastore
          const accountId  = new AccountId({chainId: "eip155:10", address: address})
          const authMethod = await EthereumWebAuth.getAuthMethod(walletClient, accountId);
        
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
          


          const ethersProvider = new ethers.BrowserProvider(walletClient.transport);
          walletClient.request({
            method: 'wallet_getSnaps',
            }).then((response) => {

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
                }).then((resp) => {
                  console.info("snap installed")
                })
              }
            
          })




          const walletSigner = await ethersProvider.getSigner();
          if (walletSigner) {

              setSigner(walletSigner)
              const orgAccountClient = await createSmartAccountClient({
                signer: walletSigner,
                bundlerUrl: "https://bundler.biconomy.io/api/v2/10/94d7c93d-8f7c-406f-8b15-dc68ad1bf5a1", 
                paymasterUrl: "https://paymaster.biconomy.io/api/v1/10/p-KEFt8JW.1da34986-b260-4e01-ad68-af0b953aaa39",
              })



              /*

              NEED TO FIGURE OUT HOW TO CREATE SESSION KEYS THAT ALLOW USER TO SIGN TRANSACTIONS WITHOUT PROMPTING USER EACH TIME

              https://docs.biconomy.io/modules/validators/smartSessions


              import { createSmartAccountClient, toNexusAccount, toSmartSessionsValidator } from "@biconomy/abstractjs";
              import { createWalletClient, custom, http } from "viem";
              import { baseSepolia } from "viem/chains";
              import { hexToBigInt } from "viem/utils";

              // Step 1: Connect to MetaMask
              const metamaskProvider = window.ethereum;
              if (!metamaskProvider) {
                throw new Error("MetaMask is not installed");
              }

              const walletClient = createWalletClient({
                chain: baseSepolia,
                transport: custom(metamaskProvider),
              });

              const [account] = await walletClient.getAddresses();
              if (!account) {
                throw new Error("No MetaMask account found");
              }

              // Step 2: Initialize the primary smart account
              const bundlerUrl = "https://bundler.biconomy.io/api/v2/84532/..."; // Replace with your bundler URL
              const nexusAccount = await toNexusAccount({
                signer: walletClient,
                chain: baseSepolia,
                transport: http(),
              });

              const nexusClient = await createSmartAccountClient({
                account: nexusAccount,
                transport: http(bundlerUrl),
              });

              const smartAccountAddress = await nexusClient.account.address;
              console.log("Smart Account Address:", smartAccountAddress);

              // Step 3: Create a session key (new keypair for signing)
              const sessionOwner = walletClient; // In practice, generate a new keypair securely
              const sessionPublicKey = account; // Replace with actual session key address if different

              // Define session permissions (e.g., allow transferring up to 100 tokens on an ERC-20 contract)
              const sessionRequestedInfo = {
                permissionIds: ["erc20-transfer"], // Example permission ID
                action: {
                  contractAddress: "0xYourERC20ContractAddress", // Replace with target contract
                  maxAmountPerTransfer: hexToBigInt("100000000000000000000"), // 100 tokens (adjust decimals)
                  validUntil: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
                  validAfter: Math.floor(Date.now() / 1000),
                },
                sessions: [
                  {
                    sessionPublicKey,
                    moduleData: {
                      // Additional parameters if needed
                    },
                  },
                ],
              };

              // Step 4: Grant session permissions (requires MetaMask signature)
              const createSessionsResponse = await nexusClient.grantPermission({ sessionRequestedInfo });
              const { success } = await nexusClient.waitForUserOperationReceipt({
                hash: createSessionsResponse.userOpHash,
              });
              if (success) {
                console.log("Session key permissions granted successfully");
              }

              // Step 5: Create a Nexus client for the session key
              const sessionData = {
                granter: nexusClient.account.address,
                sessionPublicKey,
                moduleData: {
                  permissionIds: createSessionsResponse.permissionIds,
                  action: createSessionsResponse.action,
                  sessions: createSessionsResponse.sessions,
                  mode: "USE",
                },
              };

              const smartSessionNexusClient = await createSmartAccountClient({
                chain: baseSepolia,
                accountAddress: sessionData.granter,
                signer: sessionOwner, // Session key signer
                transport: http(),
                bundlerTransport: http(bundlerUrl),
              });

              // Step 6: Create a Smart Sessions Module for validation
              const usePermissionsModule = toSmartSessionsValidator({
                account: smartSessionNexusClient.account,
                signer: sessionOwner,
                moduleData: sessionData.moduleData,
              });

              const useSmartSessionNexusClient = smartSessionNexusClient.extend(() => ({
                ...smartSessionNexusClient,
                account: {
                  ...smartSessionNexusClient.account,
                  validateUserOp: usePermissionsModule.validateUserOp,
                },
              }));

              // Step 7: Execute a transaction with the session key (no MetaMask prompt)
              const tx = {
                to: "0xRecipientAddress",
                value: BigInt(0),
                data: "0xa9059cbb000000000000000000000000RecipientAddress0000000000000000000000000000000000000000000000000000000000000064", // ERC-20 transfer (100 tokens)
              };



              const { sessionKeyAddress, sessionStorageClient } = await createSessionKeyEOA(
                orgAccountClient,
                optimism
              );
    
              console.info("sessionKeyAddress: ", JSON.stringify(sessionKeyAddress))
              console.info("sessionStorageClient: ", JSON.stringify(sessionStorageClient))

              setOrgAccountSessionKeyAddress(sessionKeyAddress)
              setOrgAccountSessionStorageClient(sessionStorageClient)

              sessionStorageClient.getAllSessionData



              // to test the session with metamask

              const BaseSchema = "string entityid, bytes32 hash, uint64 issuedate, uint64 expiredate, string vccomm, string vcsig, string vciss, "

              const SmartWalletSchemaUID = "0x48274e8523e9877690a844299733841575a47a4391d3c31efe94be43336440d6"
              const SmartWalletSchema = BaseSchema + "string type, string contractaddress"

            console.info("try and create something")

            const add = await orgAccountClient.getAddress()
            const schemaEncoder = new SchemaEncoder(SmartWalletSchema);
            const schemaItems = [
                { name: 'entityid', value: "", type: 'string' },
                { name: 'hash', value: "", type: 'bytes32' },
                { name: 'issuedate', value: 1, type: 'uint64' },
                { name: 'expiredate', value: 1, type: 'uint64' },
                
                { name: 'vccomm', value: "", type: 'string' },
                { name: 'vcsig', value: "", type: 'string' },
                { name: 'vciss', value: "", type: 'string' },

                { name: 'type', value: "", type: 'string' },
                { name: 'contractaddress', value: "", type: 'string' },
                
              ];

            
            const encodedData = schemaEncoder.encodeData(schemaItems);

            const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"; 
            const eas = new EAS(EAS_CONTRACT_ADDRESS);
            eas.connect(walletSigner)

            let tx = await eas.attest({
              schema: SmartWalletSchemaUID,
              data: {
                recipient: add,
                expirationTime: 0n, // BigInt in v6
                revocable: true,
                data: encodedData
              }
            })

           
            console.info("call send transaction")
            let swTx = await orgAccountClient.sendTransaction(tx.data,  {
                  
                    paymasterServiceData: {
                      mode: PaymasterMode.SPONSORED,
                      
                    },
                  
                  },
                { 
                  leafIndex: "LAST_LEAF",
                  store: "DEFAULT_STORE",
                  chain: optimism
                })

                                          
            console.info("await for response")
            let resp = await swTx.wait()

            console.info("done: ", resp)
            

            console.info("create emulated smart account")
            const emulatedUsersSmartAccount = await createSessionSmartAccountClient(
              {
                accountAddress: add, // Dapp can set the account address on behalf of the user
                bundlerUrl: "https://bundler.biconomy.io/api/v2/10/94d7c93d-8f7c-406f-8b15-dc68ad1bf5a1", 
                paymasterUrl: "https://paymaster.biconomy.io/api/v1/10/p-KEFt8JW.1da34986-b260-4e01-ad68-af0b953aaa39",
                chainId: 10
              },
              add // Storage client, full Session or simply the smartAccount address if using default storage for your environment
            );

            console.info("session stuff")
            const params = await getSingleSessionTxParams(
              add,
              optimism,
              0 // index of the relevant policy leaf to the tx
            );

            const withSponsorship = {
              paymasterServiceData: { mode: PaymasterMode.SPONSORED },
            };
            console.info("send transaction")
            const { wait } = await emulatedUsersSmartAccount.sendTransaction(tx.data, {
              ...params,
              ...withSponsorship,
            });
            console.info("holly crap it worked")

            //sessionKeyAddress:  "0x42F121bb72d1d1cb8937aB4775C27Bf363676BA6"
            //sessionStorageClient:  {"smartAccountAddress":"0x478df0535850b01cbe24aa2dad295b2968d24b67"}

 
            */































      
              setOrgAccountClient(orgAccountClient)
              const swa = await orgAccountClient.getAccountAddress()


              /*
              walletSigner.provider.getBalance(swa).then((balance) => {
                console.info("balance: ", balance)
              })
              walletSigner.provider.getBalance("0x9Be0417505e235FfFbd995C250e40561847777f3").then((balance) => {
                console.info("balance: ", balance)
              })
              */


              
              setOrgAddress(swa)

              const did = 'did:pkh:eip155:10:' + swa;
              setOrgDid(did)
          }

      }
      else {

      }
    }
    return {
      issuerAccountClient,
      orgDid,
      orgName,
      orgAddress,
      orgAccountClient,
      orgAccountSessionKeyAddress,
      orgAccountSessionStorageClient,
      session,
      signer,
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
      connect, 
      session, 
      signer,
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
        session,
        signer,
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
        session, 
        signer, 
        connect,
        setOrgNameValue]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
  };




export const useWallectConnectContext = () => useContext(WalletConnectContext);