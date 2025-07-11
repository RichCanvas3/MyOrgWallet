import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";

import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { useNavigate } from 'react-router-dom';

import { encodeFunctionData, hashMessage, createPublicClient, createWalletClient, WalletClient, toHex, http, zeroAddress, publicActions, custom, verifyMessage, signatureToCompactSignature  } from "viem";
import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers, AbiCoder } from 'ethers';
import { Chain } from "viem";

import { Resolver } from 'did-resolver';
import { createAgent,  } from '@veramo/core';
import type {
  W3CVerifiableCredential,
} from '@veramo/core';

import { CredentialPlugin } from '@veramo/credential-w3c';

import { KeyManagementSystem } from '@veramo/kms-local';
import { getResolver as ethrDidResolver } from 'ethr-did-resolver';
import { getResolver as webDidResolver } from 'web-did-resolver';

import { CredentialStatusPlugin } from '@veramo/credential-status';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { enableMasca} from '@blockchain-lab-um/masca-connector';


import {
  KeyDIDProvider,
  getDidKeyResolver as keyDidResolver,
} from '@blockchain-lab-um/did-provider-key';

import {
  KeyManager,
  MemoryKeyStore,
  MemoryPrivateKeyStore,
} from '@veramo/key-manager';

import {
  type AbstractIdentifierProvider,
  DIDManager,
  MemoryDIDStore,
} from '@veramo/did-manager';

import {
  PkhDIDProvider,
  getDidPkhResolver as pkhDidResolver,
} from '@veramo/did-provider-pkh';

import {
  WebDIDProvider
} from '@veramo/did-provider-web';

import { 
  EthrDIDProvider 
} 
from '@veramo/did-provider-ethr';



import {
  CredentialIssuerEIP712,
} from '@veramo/credential-eip712';

import {
  type AbstractDataStore,
  DataManager,
  type IDataManager,
} from '@blockchain-lab-um/veramo-datamanager';

import type { IKey, TKeyType, IDIDManager, ICredentialIssuer, ICredentialVerifier, IResolver, IDataStore, IKeyManager, VerifiableCredential, IVerifyResult } from '@veramo/core';

import { privateKeyToAccount, PrivateKeyAccount, generatePrivateKey } from "viem/accounts";
import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, ETHERSCAN_URL, BUNDLER_URL, PAYMASTER_URL, CHAIN_NAME} from "../config";

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
  type ToMetaMaskSmartAccountReturnType,
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

import { optimism, linea, sepolia } from "viem/chains";

import DelegationService from "../service/DelegationService"

import { OrgService } from "../service/OrgService"

import { OrgIndivAttestation, IndivEmailAttestation, IndivAttestation, OrgAttestation, RegisteredDomainAttestation } from "../models/Attestation";
import AttestationService from "../service/AttestationService";
import VerifiableCredentialsService from "../service/VerifiableCredentialsService";
import { Navigate } from "react-router-dom";

const defaultChain = CHAIN_NAME == "optimism" ? optimism : CHAIN_NAME == "sepolia" ? sepolia : CHAIN_NAME == "linea" ? linea : optimism

// Define missing types
export type CredentialJwtOrJSON = { proof: { jwt: string } } | Record<string, unknown>;
export type CredentialStatus = { revoked: boolean };



export type GetSnapsResponse = Record<string, Snap>;
export type Snap = {
  permissionName: string;
  id: string;
  version: string;
  initialPermissions: Record<string, unknown>;
};

export type WalletConnectContextState = {

    connect: (owner: string, signatory: any, organizationName: string, fullName: string, email: string) => Promise<void>;
    setIndivAndOrgInfo: (indivName: string, orgName: string, indivEmail: string) => Promise<void>;
    buildSmartWallet: (owner: string, signatory: any, ) => Promise<void>;
    setupSmartWallet: (owner: string, signatory: any, ) => Promise<void>;

    chain?: Chain;

    orgDid?: string;
    indivDid?: string;
    

    orgName?: string;
    indivName?: string;

    burnerAccountClient?: MetaMaskSmartAccount;
    orgAccountClient?: MetaMaskSmartAccount;
    indivAccountClient?: MetaMaskSmartAccount;

    orgIndivDelegation?: Delegation,
    orgIssuerDelegation?: Delegation,
    indivIssuerDelegation?: Delegation,

    selectedSignatory?: SignatoryFactory,
    signatory?: any,

    privateIssuerDid?: string;
    privateIssuerAccount?: PrivateKeyAccount,
    
    setOrgNameValue: (orgNameValue: string) => Promise<void>,
    setOrgDidValue: (orgDidValue: string) => Promise<void>,

    checkIfDIDBlacklisted: (did: string) => Promise<boolean>, 

    isIndividualConnected: boolean

    veramoAgent?: any
    mascaApi?: any

    isConnectionComplete: boolean

}



export const WalletConnectContext = createContext<WalletConnectContextState>({
  
  chain: defaultChain,

  orgDid: undefined,
  indivDid: undefined,
  

  orgName: undefined,
  indivName: undefined,


  burnerAccountClient: undefined,
  orgAccountClient: undefined,
  indivAccountClient: undefined,

  orgIndivDelegation: undefined,
  orgIssuerDelegation: undefined,
  indivIssuerDelegation: undefined,

  signatory: undefined,

  privateIssuerDid: undefined,
  privateIssuerAccount: undefined,

  isIndividualConnected: false,

  veramoAgent: undefined,
  mascaApi: undefined,

  isConnectionComplete: false,





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
  checkIfDIDBlacklisted: async (did: string) : Promise<boolean> => { return false},
})



export const useWalletConnect = () => {

    const { isConnected } = useAccount();
    const { chain } = useWallectConnectContext();


    const {selectedSignatory, setSelectedSignatoryName, selectedSignatoryName } =
      useSelectedSignatory({
        chain: chain, 
        web3AuthClientId: WEB3_AUTH_CLIENT_ID,
        web3AuthNetwork: WEB3_AUTH_NETWORK,
        rpcUrl: RPC_URL,
      });

      

    const [orgDid, setOrgDid] = useState<string>();
    const [indivDid, setIndivDid] = useState<string>();
    const [privateIssuerDid, setPrivateIssuerDid] = useState<string>();

    const [veramoAgent, setVeramoAgent] = useState<any>();
    const [mascaApi, setMascaApi] = useState<any>();

    const [orgName, setOrgName] = useState<string>();
    const [indivName, setIndivName] = useState<string>();
    const [indivEmail, setIndivEmail] = useState<string>();

    const [isIndividualConnected, setIsIndividualConnected] = useState<boolean>(false);

    const [signatory, setSignatory] = useState<any | undefined>();
    const [privateIssuerAccount, setPrivateIssuerAccount] = useState<PrivateKeyAccount | undefined>();
    const [owner, setOwner] = useState<any | undefined>();

    const [burnerAccountClient, setBurnerAccountClient] = useState<MetaMaskSmartAccount>();
    const [orgAccountClient, setOrgAccountClient] = useState<MetaMaskSmartAccount>();
    const [indivAccountClient, setIndivAccountClient] = useState<MetaMaskSmartAccount>();

    const [orgIndivDelegation, setOrgIndivDelegation] = useState<Delegation | undefined>();
    const [orgIssuerDelegation, setOrgIssuerDelegation] = useState<Delegation | undefined>();
    const [indivIssuerDelegation, setIndivIssuerDelegation] = useState<Delegation | undefined>();

    const [isConnectionComplete, setIsConnectionComplete] = useState<boolean>(false);

    const blacklisted =  [
      {'did': 'did:pkh:eip155:10:0x478df0535850b01cBE24AA2DAd295B2968d24B67'},
      {'did': 'did:pkh:eip155:10:0x89AA108af44d340Be28034965c760Dd1Bb289189'},
      {'did': 'did:pkh:eip155:10:0x64b10fC4001023f2Be205eD83b7bf05f1bC2716C'},
      {'did': 'did:pkh:eip155:10:0xccEF79B6B5d5db30DaB7fd8759B4953c1923da12'},
      {'did': 'did:pkh:eip155:10:0x97D9d517A2948ae4eF9076b01492c7981e787B81'},
      {'did': 'did:pkh:eip155:10:0xb201929847147A25B5701F6f2c4058f3d3836c57'},
      {'did': 'did:pkh:eip155:10:0xd07ad34308111AC10EC883326A7DB9e77b4Da5A9'},
      {'did': 'did:pkh:eip155:10:0x547329A545144379D1DA8aB6D61003b63AB2dcb2'},
      //{'did': 'did:pkh:eip155:10:0x2F0BcB192212AD4e3977650feeE4f455053F7772'},

    ]

    function isBlacklisted(did: string) : boolean {

      for (const item of blacklisted) {
        if (item.did.toLowerCase() == did.toLowerCase()) {
          return true
        }
      }

      return false
    }

    const checkIfDIDBlacklisted = async (did: string) : Promise<boolean> => {
      return isBlacklisted(did)
    }

    

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

    

    const [connectedAddress, setConnectedAddress] = useState<string | undefined>();


    const setupVeramoAgent = async (privateIssuerDid: string) : Promise<any>  => {

      const privateKey = ISSUER_PRIVATE_KEY;
            if (!privateKey) {
              throw new Error('Private key not found in environment variables');
            }
      const networks: Array<{ name: string; chainId: string; rpcUrl: string; registry: string }> = [
          {
            name: 'optimism',
            chainId: '0xa',
            rpcUrl: `${import.meta.env.OPTIMISM_RPC_URL}`,
            registry: '0x1234567890abcdef1234567890abcdef12345678',
          },
          {
            name: 'sepolia',
            chainId: '0xaa36a7',
            rpcUrl: `${import.meta.env.SEPOLIA_RPC_URL}`,
            registry: '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B',
          },
          {
            name: 'mainnet',
            chainId: '0x1',
            rpcUrl: `${import.meta.env.ETHERUM_RPC_URL}`,
            registry: '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B',
          },
          {
            name: 'linea',
            chainId: '0xe708',
            rpcUrl: `${import.meta.env.LINEA_RPC_URL}`,
            registry: '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B',
          },
        ];
      
      const didProviders: Record<string, AbstractIdentifierProvider> = {
        'did:pkh': new PkhDIDProvider({
          defaultKms: 'local',
          chainId: '0xa'
        }),
        'did:aa': new PkhDIDProvider({
          defaultKms: 'local',
          chainId: '0xa'
        }),
        'did:ethr': new EthrDIDProvider({
          defaultKms: 'local',
          networks,
        }),
        'did:web': new WebDIDProvider({
          defaultKms: 'local'
        }),
        'did:key': new KeyDIDProvider({ 
          defaultKms: 'local' 
        }),
      };

      const veramoAgent = createAgent<
        IDIDManager &
        IKeyManager &
        IDataStore &
        IResolver &
        IDataManager &
        ICredentialIssuer &
        ICredentialVerifier
      >({
        plugins: [
          new CredentialPlugin(),
          new CredentialIssuerEIP712(),
          new CredentialStatusPlugin({
            StatusList2021Entry: async (): Promise<CredentialStatus> => {
              return { revoked: false };
            },
          }),
          new KeyManager({
            store: new MemoryKeyStore(),
            kms: {
              local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
            },
          }),
          //new DataManager({ store: vcStorePlugins }),
          new DIDResolverPlugin({
            resolver: new Resolver({
              ...ethrDidResolver({ networks }),
              ...keyDidResolver(),
              ...pkhDidResolver(),
              ...webDidResolver(),
            }),
          }),
          new DIDManager({
            store: new MemoryDIDStore(),
            defaultProvider: 'did:pkh',
            providers: didProviders,
          })

        ],
      })


      const key: IKey = await veramoAgent.keyManagerImport({
        privateKeyHex: privateKey.slice(2),
        type: 'Secp256k1' as TKeyType, // For Ethereum-based DIDs
        kms: 'local', // Matches your KeyManagementSystem
        meta: { alias: 'my-eth-key' },
      });

      if (privateIssuerDid){
        await veramoAgent.didManagerImport({
                did: privateIssuerDid,
                alias: 'my-issuer-did',
                provider: 'did:pkh',
                controllerKeyId: key.kid,
                keys: [
                  {
                    kid: key.kid,
                    kms: 'local',
                    type: 'Secp256k1',
                    publicKeyHex: key.publicKeyHex,
                    privateKeyHex: privateKey.slice(2),
                  },
                ],
              });
      }

      setVeramoAgent(veramoAgent)

      return veramoAgent
    }


    const snapId = process.env.USE_LOCAL === 'true'
        ? 'local:http://localhost:8081'
        : 'npm:@blockchain-lab-um/masca';
    const snapVersion = '1.3.0'

    useEffect(() => {

      if (!chain || !isConnected || connectedAddress) {
        try {
          setConnectedAddress(undefined);
        }
        catch (error) { 
          console.error("......... Error setting connected address:", error);  
        }
      }

      setSelectedSignatoryName("injectedProviderSignatoryFactory")

    }, [chain, isConnected, connectedAddress]);

    const setupSnap = async (ownerAddress: string) : Promise<any|undefined> => {   

      const provider = window.ethereum;
      if (provider) {
        await provider.request({
          method: 'wallet_requestSnaps',
          params: {
            [snapId]: { version: snapVersion },
          },
        });
      }

      const mascaRslt = await enableMasca(ownerAddress, {
        snapId: snapId,
        supportedMethods: ['did:ethr', 'did:key', 'did:pkh'], // Specify supported DID methods
      });

      const api = await (mascaRslt as any).data.getMascaApi();
      setMascaApi(api)

      if (provider) {

        const res = await api.getSnapSettings();
        const disablePopups = res.data?.dApp?.disablePopups
        if (!disablePopups || disablePopups == false) {
          await provider.request({
            method: 'wallet_invokeSnap',
            params: {
              snapId: snapId,
              request: {
                method: 'togglePopups',
              },
            },
          });
        }
      }

      return api

    }


    useEffect(() => {

      if (signatory && owner && chain) {

        // this is hybrid signatory so might have a wallet client
        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });


        const getConnected = async () => {

          // Initialize metamask wallet and give access to ceramic datastore
          let ownerEOAAddress = owner
          let localOrgAddress = undefined
          let localOrgDid = undefined

          if (publicClient && selectedSignatory && privateIssuerDid) {

            const privateKey = ISSUER_PRIVATE_KEY;
            if (!privateKey) {
              throw new Error('Private key not found in environment variables');
            }

            const veramoAgent = await setupVeramoAgent(privateIssuerDid)
            setVeramoAgent(veramoAgent)

            const mascaApi = await setupSnap(ownerEOAAddress)

            // connect to issuer account abstraction
            let burnerPrivateKey = await DelegationService.getBurnerKeyFromStorage(owner)
            if (!burnerPrivateKey) {
              console.info("create new burner key")
              burnerPrivateKey = generatePrivateKey() as `0x${string}`;
              await DelegationService.saveBurnerKeyToStorage(owner, burnerPrivateKey)
            }

            const burnerAccount = privateKeyToAccount(burnerPrivateKey as `0x${string}`);

            const burnerAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [burnerAccount.address, [], [], []],
              signatory: { account: burnerAccount },
              deploySalt: toHex(10),
            })

            setBurnerAccountClient(burnerAccountClient)


            // connect burner to individual account abstraction

            let indivAccountClient: ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined = await findValidIndivAccount(owner, signatory, publicClient)
            if (indivAccountClient == undefined) {
              console.info("*********** indivAccountClient is not valid")
              return
            }

            let localIndivAddress: `0x${string}` | undefined = await indivAccountClient.getAddress() as `0x${string}`
            let localIndivDid : string | undefined = 'did:pkh:eip155:' + chain?.id + ':' + indivAccountClient.address
            
            const orgIndivAttestation = await AttestationService.getOrgIndivAttestation(chain, localIndivDid, AttestationService.OrgIndivSchemaUID, "org-indiv(org)");
            const indivAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, localIndivDid, AttestationService.IndivSchemaUID, "indiv(indiv)", "")

            if (indivAttestation) {
              setIndivName((indivAttestation as IndivAttestation).name)
            }
            else {
              localIndivAddress = undefined
              localIndivDid = undefined
              indivAccountClient = undefined
            }
              
            // connect to org account abstraction
            // can have three states coming into this section
            setIndivDid(localIndivDid)
            setIndivAccountClient(indivAccountClient)


            let orgIndivDel : any | undefined
            let delegationOrgAddress : `0x${string}` | undefined
            if (orgIndivAttestation) {

              orgIndivDel = JSON.parse((orgIndivAttestation as OrgIndivAttestation).delegation)
              if (localIndivAddress == orgIndivDel.delegate) {
                // need to validate signature at some point
                delegationOrgAddress = orgIndivDel.delegator

                setOrgIndivDelegation(orgIndivDel)
              }
            }

            
            // create orgs AA associated with individual, connect to existing if already built
            let orgAccountClient : MetaMaskSmartAccount | undefined
            if (delegationOrgAddress) {
              orgAccountClient = await toMetaMaskSmartAccount({
                address: delegationOrgAddress,
                client: publicClient,
                implementation: Implementation.Hybrid,
                signatory: signatory,
              });
            }
            else {
              console.info("========== no valid delegation in org indiv attestation so see if we have valid indiv attestation that points to existing org account client ")
              if (indivAttestation) {

                console.info("=============> yes we have an individual attestation that points to org account")
                console.info("indiv attestation => org did: ", (indivAttestation as IndivAttestation).orgDid)
                localOrgDid = (indivAttestation as IndivAttestation).orgDid
                localOrgAddress = localOrgDid.replace('did:pkh:eip155:' + chain?.id + ':', '') as `0x${string}`

                // set with org address
                orgAccountClient = await toMetaMaskSmartAccount({
                  address: localOrgAddress as `0x${string}`,
                  client: publicClient,
                  implementation: Implementation.Hybrid,
                  signatory: signatory,
                });

              }
              else {
              }

            }

            if (orgIndivDel) {
              setOrgIndivDelegation(orgIndivDel)
            }
            
            let orgIssuerDel  = null
            if (orgAccountClient) {
              localOrgDid = 'did:pkh:eip155:' + chain?.id + ':' + orgAccountClient.address

              setOrgDid(localOrgDid)
              setOrgAccountClient(orgAccountClient)

              // setup delegation for org to issuer -> redelegation of orgIndivDel
              try {
                orgIssuerDel = await DelegationService.getDelegationFromStorage("relationship", ownerEOAAddress, orgAccountClient.address, burnerAccountClient.address)
              }
              catch (error) {
              }
            }

            if (orgIssuerDel == null && orgIndivDel && localIndivDid && indivAccountClient && orgAccountClient) {

              const parentDelegationHash = getDelegationHashOffchain(orgIndivDel);
              orgIssuerDel = createDelegation({
                to: burnerAccountClient.address,
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

              await DelegationService.saveDelegationToStorage("relationship", ownerEOAAddress, orgAccountClient.address, burnerAccountClient.address, orgIssuerDel)
            }

            if (orgIssuerDel) {
              setOrgIssuerDelegation(orgIssuerDel as Delegation)
            }



            // setup delegation for individual to issuer delegation
            let indivIssuerDel = null

            if (indivAccountClient) {
              try {
                indivIssuerDel = await DelegationService.getDelegationFromStorage("relationship", ownerEOAAddress, indivAccountClient.address, burnerAccountClient.address)
              }
              catch (error) {
              }

              if (indivIssuerDel == null && localIndivDid) {
                indivIssuerDel = createDelegation({
                  from: indivAccountClient.address,
                  to: burnerAccountClient.address,
                  caveats: [] }
                );

                const signature = await indivAccountClient.signDelegation({
                  delegation: indivIssuerDel,
                });
    
    
                indivIssuerDel = {
                  ...indivIssuerDel,
                  signature,
                }

                await DelegationService.saveDelegationToStorage("relationship", ownerEOAAddress, indivAccountClient.address, burnerAccountClient.address, indivIssuerDel)
              }

              setIndivIssuerDelegation(indivIssuerDel as Delegation)
              setIsIndividualConnected(true)

            }


            if (localOrgDid) {
              const attestation = await AttestationService.getAttestationByDidAndSchemaId(chain, localOrgDid, AttestationService.RegisteredDomainSchemaUID, "domain(org)", "")
              if (attestation) {
                const domainAttestation = attestation as RegisteredDomainAttestation
                const domain = domainAttestation.domain

                const key: IKey = await veramoAgent.keyManagerImport({
                    privateKeyHex: privateKey.slice(2),
                    type: 'Secp256k1' as TKeyType, // For Ethereum-based DIDs
                    kms: 'local', // Matches your KeyManagementSystem
                    meta: { alias: 'my-eth-key' },
                  });

                const webDid = "my-web-did:" + domain
                await veramoAgent.didManagerImport({
                  did: webDid,
                  alias: 'my-web-did',
                  provider: 'did:web',
                  controllerKeyId: key.kid,
                  keys: [
                    {
                      kid: key.kid,
                      kms: 'local',
                      type: 'Secp256k1',
                      publicKeyHex: key.publicKeyHex,
                      privateKeyHex: privateKey.slice(2),
                    },
                  ],
                });
              }
            }

            // cycle through savings accounts and add burner account abstraction to each
            console.info("************* save account burner del: ", signatory.walletClient.account.address)
            console.info("************* vals: ", localOrgDid, indivDid, indivAccountClient)
            if (localOrgDid && localIndivDid && indivAccountClient) {
              const accounts = await AttestationService.loadIndivAccounts(chain, localOrgDid, localIndivDid, "1110");
              console.info("************* accounts: ", accounts)
              for (const account of accounts) {

                const accType = "account-" + account.did
                const accountBurnerDel = await DelegationService.getDelegationFromStorage(accType, ownerEOAAddress, indivAccountClient.address, burnerAccountClient.address)
                if (!accountBurnerDel) {

                  const accountDelegationStr = account.attestation?.indivDelegation
                  if (accountDelegationStr) {
                    const accountDelegation = JSON.parse(accountDelegationStr)

                    const parentDelegationHash = getDelegationHashOffchain(accountDelegation);
                    let accountBurnerDel = createDelegation({
                      to: burnerAccountClient.address,
                      from: indivAccountClient.address,
                      parentDelegation: parentDelegationHash,
                      caveats: []
                    });


                    const signature = await indivAccountClient.signDelegation({
                      delegation: accountBurnerDel,
                    });
        
                    accountBurnerDel = {
                      ...accountBurnerDel,
                      signature,
                    }

                    console.info("************* save account burner del: ", account.did, ownerEOAAddress)
                    
                    await DelegationService.saveDelegationToStorage(accType, ownerEOAAddress, indivAccountClient.address, burnerAccountClient.address, accountBurnerDel)

                  }
                }
                
              }
              setIsIndividualConnected(true)
            }
            else {
              console.info("************* no accounts found")
              setIsIndividualConnected(false)
              setIsConnectionComplete(true);
            }

          }
        }
        
        getConnected()
      }

    }, [signatory, owner]);

    // Set connection complete when individual is successfully connected
    useEffect(() => {
      if (isIndividualConnected) {
        setIsConnectionComplete(true);
      }
    }, [isIndividualConnected]);

    const privateKey = ISSUER_PRIVATE_KEY as `0x${string}`;
    useEffect(() => { 
      if (chain) {
        const issAccount = privateKeyToAccount(privateKey);
        setPrivateIssuerAccount(issAccount)

        const issDid = `did:pkh:eip155:${chain?.id}:${issAccount.address}`
        setPrivateIssuerDid(issDid)
      }
    }, [chain]);


    const setIndivAndOrgInfo = async (indivName: string, orgName: string, indivEmail: string ) => {
      setOrgName(orgName)
      setIndivName(indivName)
      setIndivEmail(indivEmail)
    }

    const findValidIndivAccount = async(owner: any, signatory: any, publicClient: any) : Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> => {
      const startSeed = 100
      const tryCount = 30

      if (owner == undefined) {
        console.info("*********** owner is not defined")  
        return undefined
      }

      if (signatory == undefined) {
        console.info("*********** signatory is not defined")  
        return undefined
      }

      for (let i = 0; i < tryCount; i++) {

        // build individuals AA for EOA Connected Wallet
        const accountClient = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [owner, [], [], []],
          signatory: signatory,
          deploySalt: toHex(startSeed+i),
        });

        const address = await accountClient.getAddress()

        if (isBlacklisted(address) == false) {
          return accountClient
        } 
      }
      return undefined
    }


    const findValidOrgAccount = async(owner: any, signatory: any, publicClient: any) : Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> => {
      const startSeed = 10000
      const tryCount = 30

      for (let i = 0; i < tryCount; i++) {

        // build individuals AA for EOA Connected Wallet
        const indivAccountClient = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [owner, [], [], []],
          signatory: signatory,
          deploySalt: toHex(startSeed+i),
        });

        const indivAddress = await indivAccountClient.getAddress()

        if (isBlacklisted(indivAddress) == false) {
          return indivAccountClient
        } 
      }
      return undefined
    }

    const findValidExistingOrgAccount = async(
      orgAddressValue: `0x${string}`, 
      owner: `0x${string}`, 
      publicClient: any,
      signatory: any
    ) : Promise<ToMetaMaskSmartAccountReturnType<Implementation.Hybrid> | undefined> => {

      console.info("findValidExistingOrgAccount: ", orgAddressValue)
      console.info("owner: ", owner)
      console.info("publicClient: ", publicClient)
      console.info("signatory: ", signatory)

      const orgAccountClient = await toMetaMaskSmartAccount({
        address: orgAddressValue,
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [owner, [], [], []],
        signatory: signatory,
      });

      console.info("orgAccountClient 1: ", orgAccountClient.getAddress())
      const orgAddress = await orgAccountClient.getAddress()
      console.info("is blacklisted")
      if (isBlacklisted(orgAddress) == false) {
        console.info("orgAccountClient is not blacklisted")
        return orgAccountClient
      }
      console.info("orgAccountClient is blacklisted")
      return undefined
    }


    const buildSmartWallet = async (owner: any, signatory: any, ) => {

      if (signatory && owner && privateIssuerDid && chain) {

        console.info(">>>>>>>>>>>> buildSmartWallet: ", owner, signatory, privateIssuerDid, chain)

        const veramoAgent = await setupVeramoAgent(privateIssuerDid)
        setVeramoAgent(veramoAgent)

        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });


        
        if (publicClient) {

          // build individuals AA for EOA Connected Wallet
          
          /*
          const indivAccountClient = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [owner, [], [], []],
            signatory: signatory,
            deploySalt: toHex(11),
          });
          */
          
          console.info("find valid indiv account with owner: ", owner)
          const indivAccountClient = await findValidIndivAccount(owner, signatory, publicClient)
          if (!indivAccountClient) {
            console.info("*********** indivAccountClient is not valid")
            return
          } 
    

          console.info(">>>>>>>>>> indivAccountClient: ", indivAccountClient.address)

          const indivAddress = await indivAccountClient.getAddress()
          let indivDid = 'did:pkh:eip155:' + chain.id + ':' + indivAccountClient.address
          setIndivDid(indivDid)
          setIndivAccountClient(indivAccountClient)

          // if indivAccountClient is not deployed then deploy it
          let isDeployed = await indivAccountClient.isDeployed()
          console.info("is indivAccountClient deployed: ", isDeployed)
       
          if (isDeployed == false) {

            console.info("individual AA getting deployed: ", indivAccountClient.address)

            const pimlicoClient = createPimlicoClient({
              transport: http(BUNDLER_URL),
            });

            //const paymasterClient = createPaymasterClient({
            //  transport: http(PAYMASTER_URL),
            //});

            console.info("create bundler client ", BUNDLER_URL, PAYMASTER_URL)
            const bundlerClient = createBundlerClient({
                            transport: http(BUNDLER_URL),
                            paymaster: true,
                            chain: chain,
                            paymasterContext: {
                              mode:             'SPONSORED',
                            },
                          });

            console.info("get gas price") 
            const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

            console.info("deploy indivAccount EOA address: ", owner)
            console.info("deploy indivAccountClient AA address: ", indivAccountClient.address)
            try {
              console.info("send user operation with bundlerClient 2: ", bundlerClient)


              //const initCode = bundlerClient.initCode;

              const userOperationHash = await bundlerClient!.sendUserOperation({
                account: indivAccountClient,
                calls: [
                  {
                    to: zeroAddress,
                  },
                ],
                ...fee,
              });

              console.info("individual account is deployed - done")
              const { receipt } = await bundlerClient!.waitForUserOperationReceipt({
                hash: userOperationHash,
              });
            }
            catch (error) { 
              console.info("error deploying indivAccountClient: ", error)
            }
          }

  

          // get attestation for individual account abstraction address
          console.info(": ", indivDid)
          const orgIndivAttestation = await AttestationService.getOrgIndivAttestation(chain, indivDid, AttestationService.OrgIndivSchemaUID, "org-indiv(org)");


          let orgAddressValue : `0x${string}` | undefined
          let orgDidValue : string | undefined

          // if orgDid is already defined then use it
          if (orgDid) {
            console.info("############ orgDid is defined: ", orgDid)
            orgDidValue = orgDid
            orgAddressValue = orgDid.replace('did:pkh:eip155:' + chain?.id + ':', '') as `0x${string}`
          }


          // user can enter this part in four states
          //  1) new to site with new individual and new organization
          //  2) new to site with new individual and existing organization found my email domain match
          //  3) new to site with new individual (org-indiv attestation was added with delegation) and existing organization found by email domain match
          //  4) return to site with existing individual and existing owned organization with delegation

          // case 3 with delegation existing that points to existing organization
          // if org-indiv attestation already exists then lets find org name from the associated org delegation in attestation and use it
          let orgIndivDel : any | undefined
          if (orgIndivAttestation) {
            orgIndivDel = JSON.parse((orgIndivAttestation as OrgIndivAttestation).delegation)
            setOrgIndivDelegation(orgIndivDel)

            if (indivAddress == orgIndivDel.delegate) {
              console.info("*********** valid individual-org attestation so lets use this org address")
              // need to validate signature at some point
              orgAddressValue = orgIndivDel.delegator
              orgDidValue = 'did:pkh:eip155:' + chain?.id + ':' + orgAddressValue

              // check if org is blacklisted
              const isBlacklisted = await checkIfDIDBlacklisted(orgDidValue)
              if (isBlacklisted) {
                console.info("*********** org is blacklisted so don't use it")
                orgAddressValue = undefined
                orgDidValue = undefined
              }
            }
          }

            
          // build orgs AA associated with individual, connect to existing if already built
          let orgAccountClient : MetaMaskSmartAccount | undefined
          if (orgAddressValue) {

            console.info(" org address value is defined so lets try and connect: ", orgAddressValue)

            let isOwner = false
            const code = await publicClient.getCode({ address: orgAddressValue });
            console.info("code: ", code)
            const isDeployed = code !== '0x';
            if (isDeployed) {
              console.info("org account client is deployed: ", orgAddressValue)
              const data = '0x8da5cb5b';
              const provider = new ethers.BrowserProvider(window.ethereum);
              const returnData = await provider.call({ to: orgAddressValue, data });
              const coder = new AbiCoder();
              const [onChainOwner] = coder.decode(['address'], returnData);
              isOwner = onChainOwner.toLowerCase() == owner.toLowerCase()

              // make sure this org is not blacklisted
              console.info("find valid existing org account for address: ", orgAddressValue)
              console.info("find valid existing org account for owner: ", owner)
              console.info("find valid existing org account for public client: ", publicClient)


              // validate orgAddressValue is valid and not blacklisted

              const ownerOrgAccount = await findValidExistingOrgAccount(orgAddressValue, owner, publicClient, signatory)
              if (!ownerOrgAccount) {
                console.info("*********** ownerOrgAccount is not valid 3, not found or blacklisted")
                isOwner = false
              }


              console.info("owner: ", onChainOwner)
              console.info("isOwner: ", isOwner)
            }

            

            // if the user is owner of org or has been given delegatee access to it
            if (isOwner || orgIndivDel) {

              console.info("==========>  the user is owner of org or has been given delegatee access to it ")
              console.info("isOwner: ", isOwner)
              console.info("orgIndivDel: ", orgIndivDel)
              //console.info("==========> go back and user signin connect =============>")
              //return

              
              orgAccountClient = await toMetaMaskSmartAccount({
                address: orgAddressValue,
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [owner, [], [], []],
                signatory: signatory,

              });
              

              if (!orgAccountClient) {
                console.info("*********** orgAccountClient is not valid 1")
                return
              }
              

              orgDidValue = 'did:pkh:eip155:' + chain?.id + ':' + orgAddressValue
              setOrgDid(orgDidValue)
              setOrgAccountClient(orgAccountClient)

            }
            else {
              console.info("==========>  the user does not have access to org account abstraction ")
            }

          }
          else {
            // this is first time through so create new org AA and deploy it
            console.info("==========>  this is first time through so create new org AA and deploy it 2 ")

            orgAccountClient = await findValidOrgAccount(owner, signatory, publicClient)
            if (!orgAccountClient) {
              console.info("*********** orgAccountClient is not valid 2")
              return
            }
            console.info("orgAccountClient address ..... : ", orgAccountClient.address)

            /*
            orgAccountClient = await toMetaMaskSmartAccount({
              client: publicClient,
              implementation: Implementation.Hybrid,
              deployParams: [owner, [], [], []],
              signatory: signatory,
              deploySalt: toHex(10),
            });
            */

            orgAddressValue = orgAccountClient.address
            orgDidValue = 'did:pkh:eip155:' + chain?.id + ':' + orgAddressValue

            setOrgDid(orgDidValue)
            setOrgAccountClient(orgAccountClient)

            let isDeployed = await orgAccountClient.isDeployed()
            console.info("is orgAccountClient deployed: ", isDeployed)

            if (isDeployed == false) {

              console.info("org account is getting deployed: ", orgAccountClient.address)

              const pimlicoClient = createPimlicoClient({
                transport: http(BUNDLER_URL),
              });
              //const paymasterClient = createPaymasterClient({
              //  transport: http(PAYMASTER_URL),
              //});
              const bundlerClient = createBundlerClient({
                              transport: http(BUNDLER_URL),
                              paymaster: true,
                              chain: chain,
                              paymasterContext: {
                                mode:             'SPONSORED',
                              },
                            });


              const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

              console.info("send user operation")
              const userOperationHash = await bundlerClient!.sendUserOperation({
                account: orgAccountClient,
                calls: [
                  {
                    to: zeroAddress,
                  },
                ],
                //paymaster: paymasterClient,
                ...fee,
              });

              console.info("org account is deployed - done")
              const { receipt } = await bundlerClient!.waitForUserOperationReceipt({
                hash: userOperationHash,
              });
            }
 
  
            
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

    const setupSmartWallet = async (owner: string, signatory: any, ) => {

      console.info("setup smart wallet")

      if (owner && signatory && chain) {




        console.info("owner and signatory are defined")

        const publicClient = createPublicClient({
          chain: chain,
          transport: http(RPC_URL),
        });


        // connect to issuer account abstraction
        let burnerPrivateKey = await DelegationService.getBurnerKeyFromStorage(owner)
        if (!burnerPrivateKey) {
          burnerPrivateKey = generatePrivateKey() as `0x${string}`;
          await DelegationService.saveBurnerKeyToStorage(owner, burnerPrivateKey)
        }
        const burnerAccount = privateKeyToAccount(burnerPrivateKey as `0x${string}`);


        const burnerAccountClient = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [burnerAccount.address, [], [], []],
          signatory: { account: burnerAccount },
          deploySalt: toHex(10),
        })

        console.info("******* burner EOA: ", burnerAccount.address)
        setBurnerAccountClient(burnerAccountClient)

        console.info("********* burner account client: ", burnerAccountClient.address)
        let isDeployed = await burnerAccountClient.isDeployed()
        console.info("******is burnerAccountClient deployed: ", isDeployed)
        if (isDeployed == false) {

          console.info("burner account is getting deployed: ", burnerAccountClient.address)

          const pimlicoClient = createPimlicoClient({
            transport: http(BUNDLER_URL),
          });

          //const paymasterClient = createPaymasterClient({
          //  transport: http(PAYMASTER_URL),
          //});

          console.info("create bundler client ", BUNDLER_URL, PAYMASTER_URL)
          const bundlerClient = createBundlerClient({
                          transport: http(BUNDLER_URL),
                          paymaster: true,
                          chain: chain,
                          paymasterContext: {
                            mode:             'SPONSORED',
                          },
                        });

          console.info("get gas price") 
          const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

          console.info("deploy burnerAccount EOA address: ", burnerAccount.address)
          console.info("deploy burnerAccountClient AA address: ", burnerAccountClient.address)

          try {
            console.info("send user operation with bundlerClient: ", bundlerClient)
            //const mx = BigInt(500_000_000_000_000_000)
            //const fee = {
            //  maxFeePerGas: mx,
            //  maxPriorityFeePerGas: mx,
            //}

            console.info("fee: ", fee)
            const userOperationHash = await bundlerClient!.sendUserOperation({
              account: burnerAccountClient,
              calls: [
                {
                  to: zeroAddress,
                },
              ],
              //paymaster: paymasterClient,
              ...fee,
            });

            console.info("burnerAccountClient account is deployed - done")
            const { receipt } = await bundlerClient!.waitForUserOperationReceipt({
              hash: userOperationHash,
            });
          }
          catch (error) { 
            console.info("error deploying burnerAccountClient: ", error)
          }
        }
        

        console.info("********* ISSUER_PRIVATE_KEY: ", ISSUER_PRIVATE_KEY)
        const privateIssuerOwner = privateKeyToAccount(ISSUER_PRIVATE_KEY as `0x${string}`);
        setPrivateIssuerAccount(privateIssuerOwner)

        console.info("********* privateIssuer AA address: ", privateIssuerOwner.address)
        let privateIssuerDid = 'did:pkh:eip155:' + chain?.id + ':' + privateIssuerOwner.address
        setPrivateIssuerDid(privateIssuerDid)
        
        // setup veramo agent and masca api
        console.info("setup veramo for issuer aa did: ", privateIssuerDid)
        const veramoAgent = await setupVeramoAgent(privateIssuerDid)
        setVeramoAgent(veramoAgent)

        console.info("setup snap for owner: ", owner)
        const mascaApi = await setupSnap(owner)

        console.info("orgIndivDelegation: ", orgIndivDelegation)
        console.info("orgAccountClient 2: ", orgAccountClient)

        if (orgIndivDelegation && orgAccountClient) {

          // setup delegation for org to issuer -> redelegation of orgIndivDel
          let orgIssuerDel  = null
          console.info("get delegation from storage: ", owner, orgAccountClient.address, burnerAccountClient.address)
          orgIssuerDel = await DelegationService.getDelegationFromStorage("relationship", owner, orgAccountClient.address, burnerAccountClient.address)
          if (orgIssuerDel == null && indivDid && indivAccountClient) {

            console.info("indivDid: ", indivDid)
            console.info("indivAccountClient: ", indivAccountClient)

            const parentDelegationHash = getDelegationHashOffchain(orgIndivDelegation);
            orgIssuerDel = createDelegation({
              to: burnerAccountClient.address,
              from: indivAccountClient.address,
              parentDelegation: parentDelegationHash,
              caveats: []
            });


            console.info("sign delegation")
            const signature = await indivAccountClient.signDelegation({
              delegation: orgIssuerDel,
            });


            orgIssuerDel = {
              ...orgIssuerDel,
              signature,
            }

            console.info("save delegation to storage")
            await DelegationService.saveDelegationToStorage("relationship", owner, orgAccountClient.address, burnerAccountClient.address, orgIssuerDel)
          }

          console.info("orgIssuerDel: ", orgIssuerDel)
          if (orgIssuerDel) {
            setOrgIssuerDelegation(orgIssuerDel as Delegation)
          }

          // add new org attestation
          console.info("add new org attestation")
          const addOrgAttestation = async (mascaApi: any) => {

            console.info("*********** ADD ORG ATTESTATION 2 ****************")

            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "org(org)"
        

            console.info("fields: ", orgName, orgDid, privateIssuerDid, orgIssuerDel, indivDid, mascaApi, walletSigner, walletClient)
            if (walletSigner && walletClient && mascaApi && chain && privateIssuerAccount && orgName && orgDid && orgIssuerDel && mascaApi) {
        
              console.info("create credential for org attestation")
              const vc = await VerifiableCredentialsService.createOrgVC(entityId, orgDid, privateIssuerDid, orgName);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgName, orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
              const fullVc = result.vc
              const proof = result.proof
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
                  vciss: privateIssuerDid,
                  proof: proof
                };
        
                const uid = await AttestationService.addOrgAttestation(chain, attestation, walletSigner, [orgIssuerDel as Delegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
              }
            }
          }

          const addDomainAttestation = async (mascaApi: any) => {

            function getDomainFromEmail(email: string): string | null {
              const atIndex = email.lastIndexOf('@');
              if (atIndex <= 0 || atIndex === email.length - 1) {
                // no '@', '@' at start, or '@' at end → invalid
                return null;
              }
              return email.slice(atIndex + 1);
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "domain(org)"
        
            if (walletSigner && walletClient && orgName && orgDid && orgIssuerDel && indivEmail && mascaApi) {

              console.info("*********** ADD DOMAIN ATTESTATION ****************")

              const entityId = "domain(org)"
              const domainName = getDomainFromEmail(indivEmail)

              if (domainName && privateIssuerAccount) {

                try {
                  const rslt = await OrgService.checkDomain(domainName);
                  let rsltJson = JSON.parse(rslt)
                  console.info("domain check: ", rsltJson)
                } catch (error) {
                  console.error("Error checking domain: ", error)
                }
                
            
                const domaincreationdate = new Date("2023-03-10")
                const domaincreationdateSeconds = Math.floor(domaincreationdate.getTime() / 1000); // Convert to seconds

          
                const vc = await VerifiableCredentialsService.createRegisteredDomainVC(entityId, orgDid, privateIssuerDid, domainName, "");
                const result = await VerifiableCredentialsService.createCredential(vc, entityId, domainName, orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
                const fullVc = result.vc
                const proof = result.proof
                if (fullVc) {
                
                  // now create attestation
                  const hash = keccak256(toUtf8Bytes("hash value"));
                  const attestation: RegisteredDomainAttestation = {
                    domain: domainName,
                    domaincreationdate: domaincreationdateSeconds,
                    attester: orgDid,
                    class: "organization",
                    category: "identity",
                    entityId: entityId,
                    hash: hash,
                    vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                    vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                    vciss: privateIssuerDid,
                    proof: proof
                  };
          
                  const uid = await AttestationService.addRegisteredDomainAttestation(chain, attestation, walletSigner, [orgIssuerDel as Delegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
                }

              }
            }
          }

          console.info("===========> : ", indivDid, orgDid)
          if (indivDid && orgDid && chain) {
            console.info(" get att")
            const orgAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, orgDid, AttestationService.OrgIndivSchemaUID, "org(org)", "")
            if (!orgAttestation) {
              console.info("=============> no org attestation so add one")
              await addOrgAttestation(mascaApi)
            }
          }


          // add new org indiv attestation
          const addOrgIndivAttestation = async (mascaApi: any) => {

            

            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "org-indiv(org)"
        
            if (mascaApi && walletSigner && walletClient && privateIssuerAccount && indivDid && orgDid && orgIssuerDel) {

              console.info("*********** ADD ORG INDIV ATTESTATION 2 ****************")

              let indName = "indiv name"
              if (indivName) {
                indName = indivName
              }
              
              const delegationJsonStr = JSON.stringify(orgIndivDelegation)
        
              const vc = await VerifiableCredentialsService.createOrgIndivVC(entityId, orgDid, indivDid, indName, delegationJsonStr, privateIssuerDid);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, indName, orgDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
              const fullVc = result.vc
              const proof = result.proof

              if (fullVc) {

                
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: OrgIndivAttestation = {
                  indivDid: indivDid,
                  name: indName,
                  delegation: delegationJsonStr,
                  attester: orgDid,
                  class: "organization",
                  category: "leadership",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: privateIssuerDid,
                  proof: proof
                };
        
                console.info("AttestationService add org indiv attestation")
                const uid = await AttestationService.addOrgIndivAttestation(chain, attestation, walletSigner, [orgIssuerDel as Delegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
              }
            }
            else {
              console.info("*********** no wallet signer or client or indivDid or orgDid or orgIssuerDel")  
              console.info("walletSigner: ", walletSigner)
              console.info("walletClient: ", walletClient)
              console.info("privateIssuerAccount: ", privateIssuerAccount)
              console.info("indivDid: ", indivDid)
              console.info("orgDid: ", orgDid)
              console.info("orgIssuerDel: ", orgIssuerDel)
            }
          }

          if (indivDid && orgDid) {
            const orgIndivAttestation = await AttestationService.getOrgIndivAttestation(chain,indivDid, AttestationService.OrgIndivSchemaUID, "org-indiv(org)")
            if (!orgIndivAttestation) {
              console.info("=============> no indiv attestation so add one")
              await addDomainAttestation(mascaApi)
              await addOrgIndivAttestation(mascaApi)
            }
          }
          
        }
      

        if (indivAccountClient && burnerAccountClient) {

          // setup delegation for individual to issuer delegation
          let indivIssuerDel = null
          indivIssuerDel = await DelegationService.getDelegationFromStorage("relationship", owner, indivAccountClient.address, burnerAccountClient.address)
          if (indivIssuerDel == null && indivDid) {

            console.info("delegation does not exist for indiv-issuer so create one")
            console.info("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3")
            indivIssuerDel = createDelegation({
              from: indivAccountClient.address,
              to: burnerAccountClient.address,
              caveats: [] }
            );

            const signature = await indivAccountClient.signDelegation({
              delegation: indivIssuerDel,
            });


            indivIssuerDel = {
              ...indivIssuerDel,
              signature,
            }

            await DelegationService.saveDelegationToStorage("relationship", owner, indivAccountClient.address, burnerAccountClient.address, indivIssuerDel)
          }

          setIndivIssuerDelegation(indivIssuerDel as Delegation)




          // add indiv  attestation
          const addIndivAttestation = async (mascaApi: any) => {

            console.info("*********** ADD INDIV ATTESTATION 1 ****************")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "indiv(indiv)"
        
            if (walletSigner && walletClient && privateIssuerAccount && indivDid && orgDid && mascaApi) {

              let indName = "name";
              if (indivName) {
                indName = indivName
              }
        
              const vc = await VerifiableCredentialsService.createIndivVC(entityId, indivDid, privateIssuerDid, orgDid, indName);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, indName, indivDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
              const fullVc = result.vc
              const proof = result.proof

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
                  vciss: privateIssuerDid,
                  proof: proof
                };

                const uid = await AttestationService.addIndivAttestation(chain, attestation, walletSigner, [indivIssuerDel as Delegation], indivAccountClient, burnerAccountClient)
              }
            }
          }
          
          // add indiv email attestation
          const addIndivEmailAttestation = async (mascaApi: any) => {

            console.info("*********** ADD INDIV EMAIL ATTESTATION ****************")
            const provider = new ethers.BrowserProvider(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const walletSigner = await provider.getSigner()
        
            const walletClient = signatory.walletClient
            const entityId = "email(indiv)"
        
            if (walletSigner && walletClient && privateIssuerAccount && indivDid && mascaApi) {

              let indEmail = "email";
              if (indivEmail) {
                indEmail = indivEmail
              }
        
              const vc = await VerifiableCredentialsService.createIndivEmailVC(entityId, indivDid, privateIssuerDid, "business", indEmail);
              const result = await VerifiableCredentialsService.createCredential(vc, entityId, indivEmail, indivDid, mascaApi, privateIssuerAccount, burnerAccountClient, veramoAgent)
              const fullVc = result.vc
              const proof = result.proof

              if (fullVc) {
              
                // now create attestation
                const hash = keccak256(toUtf8Bytes("hash value"));
                const attestation: IndivEmailAttestation = {
                  type: "business",
                  email: indEmail,
                  attester: indivDid,
                  class: "individual",
                  category: "identity",
                  entityId: entityId,
                  hash: hash,
                  vccomm: (fullVc.credentialSubject as any).commitment.toString(),
                  vcsig: (fullVc.credentialSubject as any).commitmentSignature,
                  vciss: privateIssuerDid,
                  proof: proof
                };
        
                //console.info("+++++++++++++ AttestationService add indiv attestation")
                //console.info("+++++++++++++ att: ", attestation)
                //console.info("+++++++++++++ del: ", indivIssuerDel)
                //console.info("+++++++++++++ indivAccountClient: ", indivAccountClient)
                //console.info("+++++++++++++ burnerAccountClient: ", burnerAccountClient)


                const uid = await AttestationService.addIndivEmailAttestation(chain, attestation, walletSigner, [indivIssuerDel as Delegation], indivAccountClient, burnerAccountClient)
              }
            }
          }

          if (indivDid && orgDid && indivIssuerDel) {
            const indivAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.IndivSchemaUID, "indiv(indiv)", "")
            if (!indivAttestation) {
              addIndivAttestation(mascaApi)
            }

            const indivEmailAttestation = await AttestationService.getAttestationByDidAndSchemaId(chain, indivDid, AttestationService.IndivEmailSchemaUID, "email(indiv)", "", "")
            if (!indivEmailAttestation) {
              addIndivEmailAttestation(mascaApi)
            }
          }
        }


      }

      console.info("setup smart wallet - done")
    }

    const connect = async (owner: any, signatory: any, organizationName: string, fullName: string, email: string) => {
      console.info("*********** set signatory: ", signatory)
      setSignatory(signatory)
      setOwner(owner)
    }
    return {
            chain, 

            orgDid,
            indivDid,
            

            indivName,
            orgName,

            isIndividualConnected,


            burnerAccountClient,
            orgAccountClient,
            indivAccountClient,

            signatory,

            privateIssuerDid,
            privateIssuerAccount,

            veramoAgent,
            mascaApi,
            
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
            checkIfDIDBlacklisted,
            isConnectionComplete

            

    }
        
}

export const WalletConnectContextProvider = ({ children }: { children: any }) => {
    const {
      chain,

      orgDid, 
      indivDid,
      

      indivName,
      orgName,

      isIndividualConnected,

      burnerAccountClient,
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

      privateIssuerDid,
      privateIssuerAccount,

      veramoAgent,
      mascaApi,
      
      setOrgNameValue,
      setOrgDidValue,
      checkIfDIDBlacklisted,
      isConnectionComplete
    } =
      useWalletConnect();
  
    const providerProps = useMemo(
      () => ({

        chain,

        orgDid,
        indivDid,
        

        indivName,
        orgName,

        isIndividualConnected,

        burnerAccountClient,
        orgAccountClient,
        indivAccountClient,

        orgIndivDelegation,
        orgIssuerDelegation,
        indivIssuerDelegation,

        selectedSignatory,
        signatory,

        privateIssuerAccount,
        privateIssuerDid,

        veramoAgent,
        mascaApi,

        connect,
        setIndivAndOrgInfo,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue,
        setOrgDidValue,
        checkIfDIDBlacklisted,
        isConnectionComplete
      }),
      [
        
        indivName,
        orgName,

        orgDid,
        indivDid, 

        isIndividualConnected,

        burnerAccountClient,
        orgAccountClient,
        indivAccountClient,

        orgIndivDelegation,
        orgIssuerDelegation,
        indivIssuerDelegation,

        selectedSignatory,
        signatory,

        privateIssuerDid,
        privateIssuerAccount,

        veramoAgent,
        mascaApi,

        connect,
        setIndivAndOrgInfo,
        buildSmartWallet,
        setupSmartWallet,
        setOrgNameValue,
        setOrgDidValue,
        checkIfDIDBlacklisted,
        isConnectionComplete]
    );
  
    return <WalletConnectContext.Provider value={providerProps}>{children}</WalletConnectContext.Provider>;
};




export const useWallectConnectContext = () => useContext(WalletConnectContext);