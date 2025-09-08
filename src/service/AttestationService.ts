import {EventEmitter} from "./EventEmitter";
import FileDataService from './FileDataService';
import { ChatMessage } from '../models/ChatCompletion';
import { Entity } from '../models/Entity';

import { Attestation,
  AttestationCategory,
  IndivAttestation,
  AIAgentAttestation,
  OrgIndivAttestation,
  OrgAttestation,
  IndivAccountAttestation,
  OrgAccountAttestation,
  AccountOrgDelAttestation,
  AccountIndivDelAttestation,
  SocialAttestation,
  RegisteredDomainAttestation,
  RegisteredENSAttestation,
  WebsiteAttestation,
  InsuranceAttestation,
  EmailAttestation,
  StateRegistrationAttestation,
  IndivEmailAttestation}
  from '../models/Attestation';

import { Organization } from '../models/Organization';
import { ethers, formatEther, Interface, ZeroAddress } from "ethers"; // install alongside EAS
import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem } from '@ethereum-attestation-service/eas-sdk';
import { AccountStateConflictError, WalletClient } from "viem";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

import { encodeNonce } from "permissionless/utils"



import {WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, BUNDLER_URL, PAYMASTER_URL, EAS_URL, EAS_CONTRACT_ADDRESS} from "../config";

const STORE_URL = `${import.meta.env.VITE_API_URL}/json`;


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
  Delegation,
  getDeleGatorEnvironment
} from "@metamask/delegation-toolkit";

import {
  createBundlerClient,
  createPaymasterClient,
  UserOperationReceipt,
} from "viem/account-abstraction";

import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  Client,
  createPublicClient,
  Hex,
  http,
  toHex,
  zeroAddress,
} from "viem";
import { type Chain } from 'viem'

import { Account, IndivAccount, AccountType, ACCOUNT_TYPES } from '../models/Account';
import { SingleBedRounded } from "@mui/icons-material";
import { attributesToProps } from "html-react-parser";

export interface AttestationChangeEvent {
  action: 'add' | 'edit' | 'delete' | 'delete-all' | 'revoke',
  entityId: string,
  attestation?: Attestation, // not set on delete
}



const graphQLUrl = EAS_URL || "https://optimism.easscan.org";

const easApolloClient = new ApolloClient({
  uri: graphQLUrl + "/graphql",
  cache: new InMemoryCache(),
});


const easContractAddress = EAS_CONTRACT_ADDRESS ||"0x4200000000000000000000000000000000000021";
const eas = new EAS(easContractAddress);





class AttestationService {


  static getAttestationById(entities: Entity[], entityId: string, requireAttestation: boolean): Attestation | undefined {

    let rtnAttestation : Attestation | undefined
    for (const entity of entities) {
      if (entity.name == entityId) {
        if (requireAttestation) {
          if (entity.attestation != undefined) {
            rtnAttestation = entity.attestation
          }
        }
        else {
          if (entity.attestation != undefined) {
            rtnAttestation = entity.attestation
          }
        }
      }
    }

    return rtnAttestation;
  }




  static async setEntityAttestations(chain: Chain, orgDid: string, indivDid: string, currentWalletAddress?: string) {

    let entities = this.DefaultEntities

    const orgAddress = orgDid.replace("did:pkh:eip155:" + chain?.id + ":", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:" + chain?.id + ":", "")

    // Determine which addresses to query based on the currently connected wallet
    let addressesToQuery: string[] = [];

    if (currentWalletAddress) {
      // If we have a current wallet address, only query attestations from addresses
      // that belong to this specific wallet session

      // For now, we'll still query both addresses but add more specific filtering later
      // This is a conservative approach to ensure we don't miss any attestations
      addressesToQuery = [orgAddress, indivAddress];
    } else {
      // Fallback to the original behavior if no current wallet address is provided
      addressesToQuery = [orgAddress, indivAddress];
    }

    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            attester: { in: [${addressesToQuery.map(addr => `"${addr}"`).join(", ")}] }
            revoked: { equals: false }
          }
        ) {
          id
          attester
          schemaId
          data
        }
      }`;


    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });

    // cycle through aes attestations and update entity with attestation info
    let processedCount = 0;
    let skippedCount = 0;

    for (const item of data.attestations) {

      //console.info("attestationitem: ", item)

      // check if this aes attestation is from a valid schema
      let schema : string | undefined
      for (const entity of AttestationService.DefaultEntities) {
        //console.info("item: ", item, entity.schemaId)
        if (entity.schemaId == item.schemaId) {
          schema = entity.schema
        }
      }

      //console.info("schemaId: ", item.schemaId)

      if (schema) {

        //console.info("...... valid schema .......")
        const schemaEncoder = new SchemaEncoder(schema);

        // find entityId
        let entityId : string | undefined
        let hash : string | undefined
        let decodedData : SchemaDecodedItem[] = []

        try {
          decodedData = schemaEncoder.decodeData(item.data);
          for (const field of decodedData) {

            let fieldName = field["name"]
            let fieldValue = field["value"].value as string

            if (fieldName == "entityid") {
              entityId = fieldValue
            }
            if (fieldName == "hash") {
              hash = fieldValue
            }
          }
        }
        catch (error) {
          console.info("error uid 1: ", item.id)
          console.info("error schemaId 1: ", item.schemaId)
          console.info("decode error 1: ", error)
          continue
        }

                  // find entity
          if (entityId != undefined && hash != undefined) {

            let entity : Entity  | undefined;
            for (const ent of entities) {
              if (ent.name == entityId) {
                entity = ent
              }
            }

            // Additional filtering: Only process attestations that belong to the current user's context
            let shouldProcessAttestation = true;


            // For organization-related attestations, check if they belong to the current org
            if (entityId.includes("(org)") && item.attester.toLowerCase() === orgAddress.toLowerCase()) {
              // This is an org attestation, verify it belongs to current org
              shouldProcessAttestation = true;
            }
            // For individual-related attestations, check if they belong to the current individual
            else if (entityId.includes("(indiv)") && item.attester.toLowerCase() === indivAddress.toLowerCase()) {
              // This is an individual attestation, verify it belongs to current individual
              shouldProcessAttestation = true;
            }
            // If attestation is from a different address than expected, skip it
            else if (item.attester.toLowerCase() !== orgAddress.toLowerCase() &&
                     item.attester.toLowerCase() !== indivAddress.toLowerCase()) {
              console.log(`Skipping attestation ${item.id} - wrong attester: ${item.attester} (expected: ${orgAddress} or ${indivAddress})`);
              shouldProcessAttestation = false;
            }

            // Additional filtering: If we have a current wallet address, ensure attestations belong to this wallet's context
            if (currentWalletAddress && shouldProcessAttestation) {
              // The currentWalletAddress is the EOA address of the connected wallet
              // We need to check if this attestation was created by smart accounts that belong to this EOA
              // This is a more sophisticated check that could be enhanced with additional context

              // For now, we'll use the existing logic but add more detailed logging
              const attestationBelongsToCurrentWallet =
                item.attester.toLowerCase() === orgAddress.toLowerCase() ||
                item.attester.toLowerCase() === indivAddress.toLowerCase();

              if (!attestationBelongsToCurrentWallet) {
                //console.log(`Skipping attestation ${item.id} - not from current wallet context: ${item.attester} (current wallet: ${currentWalletAddress})`);
                shouldProcessAttestation = false;
              } else {
                //console.log(`Keeping attestation ${item.id} - belongs to current wallet context: ${item.attester} (current wallet: ${currentWalletAddress})`);
              }
            }

            if (!shouldProcessAttestation) {
              skippedCount++;
              //console.log(`SKIPPED attestation ${item.id} - entityId: ${entityId}, attester: ${item.attester}`);
              continue;
            }

            processedCount++;
 
          // construct correct attestation
          if (entity != undefined) {
            let att: Attestation | undefined;

            if (entityId == "indiv(indiv)") {
              att = this.constructIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "agent(agent)") {
              att = this.constructAIAgentAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account(indiv)") {
              att = this.constructIndivAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account-org(org)") {
              att = this.constructAccountOrgDelAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account-indiv(org)") {
              att = this.constructAccountIndivDelAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account(org)") {
              att = this.constructOrgAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org(org)") {
              att = this.constructOrgAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org-indiv(org)") {
              att = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "linkedin(indiv)") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "x(indiv)") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "shopify(org)") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "insurance(org)") {
              att = this.constructInsuranceAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "state-registration(org)") {
              att = this.constructStateRegistrationAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "domain(org)") {
              att = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "ens(org)") {
              att = this.constructRegisteredENSAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "website(org)") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email(org)") {
              att = this.constructEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email(indiv)") {
              att = this.constructIndivEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }

            if (att != undefined) {
              entity.attestation = att
            } else {
              console.info(`Constructor returned undefined for entity ${entityId}, skipping`)
            }
          }

        }

      }

          };

    return entities

  }




  static RevokeSchemaUID = "0x8ced29acd56451bf43c457bd0cc1c13aa213fcdcdbd872ab87674d3fbf9fc218"
  static RevokeSchema = "string vccomm, string proof, uint64 issuedate"
  static async addRevokeAttestation(vccomm: string, proof: string, signer: ethers.JsonRpcSigner, burnerAccountClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds

    //console.info("attestation: ", attestation)

    const schemaEncoder = new SchemaEncoder(this.RevokeSchema);
    const schemaItems = [
        { name: 'vccomm', value: vccomm, type: 'string' },
        { name: 'proof', value: proof, type: 'string' },
        { name: 'issuedate', value: issuedate, type: 'uint64' },
      ];

    const encodedData = schemaEncoder.encodeData(schemaItems);
    let swa = await burnerAccountClient.getAddress()

    let tx = await eas.attest({
      schema: AttestationService.RevokeSchemaUID,
      data: {
        recipient: swa,
        expirationTime: 0n, // BigInt in v6
        revocable: true,
        data: encodedData
      }
    })

    let swTx = await burnerAccountClient.sendTransaction(tx.data, {
            paymasterServiceData: {
              mode: 'SPONSORED',
            },
          })


    let resp = await swTx.wait()

    return ""

  }
  static async getVcRevokedAttestation(chain: Chain, orgDid: string, vccomm: string) {

    const address = orgDid.replace("did:pkh:eip155:" + chain?.id + ":", "")

    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            attester: { equals: "${address}"}
            schemaId:  { equals: "${AttestationService.RevokeSchemaUID}"}
            revoked: { equals: false }
          }
        ) {
          id
          schemaId
          data
        }
      }`;


    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });

    // cycle through aes attestations and update entity with attestation info
    for (const item of data.attestations) {

      let attVccomm : string | undefined
      let attProof: string | undefined

      //console.info("...... valid schema .......")
      const schemaEncoder = new SchemaEncoder(AttestationService.RevokeSchema);

      let decodedData : SchemaDecodedItem[] = []

      try {
        decodedData = schemaEncoder.decodeData(item.data);
        for (const field of decodedData) {

          let fieldName = field["name"]
          let fieldValue = field["value"].value as string

          if (fieldName == "vccomm") {
            attVccomm = fieldValue
          }
          if (fieldName == "proof") {
            attProof = fieldValue
          }
        }
      }
      catch (error) {
        console.info("error uid: ", item.id)
        console.info("error schemaId: ", item.schemaId)
        console.info("decode error: ", error)
        throw error
      }


      if (attVccomm == vccomm) {
        return { "uid": item.id, "schemaId": item.schemaId, "proof": attProof}
      }

    }


    return {}

  }


  static BaseSchema = "string entityid, bytes32 hash, uint64 issuedate, uint64 expiredate, string vccomm, string vcsig, string vciss, string vcid, string proof, "




  static async storeAttestation(chain: Chain, schema: string, encodedData: any, delegator: MetaMaskSmartAccount, delegate: MetaMaskSmartAccount, delegationChain: Delegation[], easInstance?: EAS, verifyAttestationAvailability: boolean = true) {

    console.info("inside store attestation: ", delegator.address)

    const key1 = BigInt(Date.now())      // or some secure random
    const nonce1 = encodeNonce({ key: key1, sequence: 0n })

    // This code was duplicated and causing issues - removing it


    const paymasterClient = createPaymasterClient({
      transport: http(PAYMASTER_URL),
    });


    console.info("pimlico client configruation for BUNDLER URL")
    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
    });
    const bundlerClient = createBundlerClient({
                    transport: http(BUNDLER_URL),
                    paymaster: paymasterClient,
                    chain: chain,
                    paymasterContext: {
                      mode:             'SPONSORED',
                    },
                  });

    // This code was using executions before it was defined - removing it

    try {
      const key1 = BigInt(Date.now())      // or some secure random
      const nonce1 = encodeNonce({ key: key1, sequence: 0n })

      // Use the provided EAS instance or create a new one
      const easToUse = easInstance || eas;
      console.info("eas connect: ", easToUse)
      console.info("delegator: ", delegator)

      let tx = await easToUse.attest({
        schema: schema,
        data: {
          recipient: delegator.address,
          expirationTime: 0n, // BigInt in v6
          revocable: true,
          data: encodedData
        }
      })


      console.info("eas attest tx: ", tx)
      const executions = [
        {
          target: tx.data.to,
          value: 0n,
          callData: tx.data.data,
        },
      ];


      const paymasterClient = createPaymasterClient({
        transport: http(PAYMASTER_URL),
      });


      console.info("pimlico client configruation for BUNDLER URL")
      const pimlicoClient = createPimlicoClient({
        transport: http(BUNDLER_URL),
      });
      const bundlerClient = createBundlerClient({
                      transport: http(BUNDLER_URL),
                      paymaster: paymasterClient,
                      chain: chain,
                      paymasterContext: {
                        mode:             'SPONSORED',
                      },
                    });

      console.info("redeem delegations: ", delegationChain)
      console.info("delegation chain length: ", delegationChain.length)
      console.info("executions: ", executions)

      const data = DelegationFramework.encode.redeemDelegations({
        delegations: [ delegationChain ],
        modes: [SINGLE_DEFAULT_MODE],
        executions: [executions]
      });

      //console.info("encoded delegation data: ", data)


      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
      let userOpHash: Hex;

      userOpHash = await bundlerClient.sendUserOperation({
        account: delegate,
        calls: [
          {
            to: delegate.address,
            data,
          },
        ],
        nonce: nonce1,
        paymaster: paymasterClient,
        ...fee

      });

      console.info("done sending user operation")
      console.info("waiting for user operation receipt with hash: ", userOpHash)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('User operation receipt timeout after 60 seconds')), 60000);
      });

      const userOperationReceipt = await Promise.race([
        bundlerClient.waitForUserOperationReceipt({ hash: userOpHash }),
        timeoutPromise
      ]);
      console.info("......... add attestation receipt ................: ", userOperationReceipt)
      
      // Verify attestation was created and is available with retry logic (only if requested)
      if (verifyAttestationAvailability) {
        console.info("Verifying attestation availability...");
        const maxRetries = 5;
        const baseDelay = 4000; // Start with 4 seconds
        let attestationQuery = null;
        let apolloQuery = null;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Calculate delay with exponential backoff: 2s, 4s, 8s, 16s, 32s
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.info(`🔄 Attempt ${attempt}/${maxRetries}: Waiting ${delay}ms before verification...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Step 1: Query the attestation on-chain to verify it exists
            console.info("🔍 Step 1: Verifying on-chain attestation...");
            attestationQuery = await easToUse.getAttestation((userOperationReceipt as any).receipt.transactionHash);
            console.info(`✅ On-chain attestation verified successfully on attempt ${attempt}:`, attestationQuery);
            
            // Step 2: Query the attestation via Apollo GraphQL to verify indexer is ready
            console.info("🔍 Step 2: Verifying GraphQL indexer availability...");
            const txHash = (userOperationReceipt as any).receipt.transactionHash;
            const apolloQuery = gql`
              query GetAttestationByTxHash($txHash: String!) {
                attestations(
                  where: {
                    transactionHash: { equals: $txHash }
                    revoked: { equals: false }
                  }
                ) {
                  id
                  attester
                  schemaId
                  data
                  transactionHash
                  blockTimestamp
                }
              }
            `;
            
            const apolloResult = await easApolloClient.query({ 
              query: apolloQuery, 
              variables: { txHash },
              fetchPolicy: "no-cache" 
            });
            
            if (apolloResult.data.attestations && apolloResult.data.attestations.length > 0) {
              const apolloAttestation = apolloResult.data.attestations[0];
              console.info(`✅ GraphQL indexer verification successful on attempt ${attempt}:`, apolloAttestation);
              
              // Additional verification: check if the attestation data matches what we sent
              if (attestationQuery && attestationQuery.data) {
                console.info("✅ Attestation data verified:", {
                  schema: attestationQuery.schema,
                  recipient: attestationQuery.recipient,
                  attester: attestationQuery.attester,
                  data: attestationQuery.data
                });
              }
              
              // Success! Both on-chain and GraphQL are ready
              console.info("🎉 Complete verification successful - attestation is available both on-chain and via GraphQL!");
              break;
              
            } else {
              throw new Error("GraphQL query returned no attestations for transaction hash");
            }
            
          } catch (verificationError) {
            lastError = verificationError;
            console.warn(`⚠️ Attestation verification attempt ${attempt}/${maxRetries} failed:`, verificationError);
            
            if (attempt === maxRetries) {
              console.warn("⚠️ All attestation verification attempts failed. Final error:", lastError);
              console.warn("⚠️ This is just verification - the main operation succeeded, so continuing...");
              console.warn("⚠️ Note: Attestation may not be immediately available via GraphQL indexer");
            } else {
              console.info(`⏳ Retrying in ${baseDelay * Math.pow(2, attempt)}ms...`);
            }
          }
        }
      } else {
        console.info("⏭️ Skipping attestation availability verification as requested");
      }
    }
    catch (error) {
      console.info(">>>>>>>>>>>> error trying to save using delegate address: ", delegate.address)
      console.info(">>>>>>>>>>>>>> try saving with Delegation Manager")
      console.error("......... error: ", error)

      // Log more detailed error information
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      // Re-throw the error to prevent silent failures
      throw error;
    }

  }


  
  static AIAgentSchemaUID = "0xeab949eeef45faa3119bea08f4fa0460e446354f1eee808737266bd6c3588e8b"
  static AIAgentSchema = this.BaseSchema + "string orgdid, string agentdomain"
  static async addAIAgentAttestation(chain: Chain, attestation: AIAgentAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], aiAgentAccountClient: MetaMaskSmartAccount, aiAgentDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    console.info("....... add ai agent attestation signer: ", signer)
    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    console.info("create ai agent attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.agentDomain) {

      const schemaEncoder = new SchemaEncoder(this.AIAgentSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'orgdid', value: attestation.orgDid, type: 'string' },
          { name: 'agentdomain', value: attestation.agentDomain, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.AIAgentSchemaUID, encodedData, aiAgentAccountClient, aiAgentDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

        console.info("********************  done adding ai agent attestation *********************")

    }

    return attestation.entityId

  }
  static constructAIAgentAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let orgdid: string | undefined
    let agentdomain: string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "orgdid") {
        orgdid = field["value"].value as string
      }
      if (fieldName == "agentdomain") {
        agentdomain = field["value"].value as string
      }
    }

    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && orgdid != undefined && vcid != undefined && agentdomain != undefined) {
      let displayName = agentdomain
      if (displayName == "" || displayName == undefined || displayName == null) {
        displayName = entityId.replace("(agent)", "").replace("(org)", "").replace("(indiv)", "")
      }
      
      const att : AIAgentAttestation = {
        displayName: displayName,
        class: "agent",
        category: "wallet",
        entityId: entityId,
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        orgDid: orgdid,
        agentDomain: agentdomain
      }

      return att
    }

    return undefined
  }



  static IndivSchemaUID = "0x6cec06c3c01411fb63e6635161a5b761c0f57c99d5e067d459174d193b32b6fb"
  static IndivSchema = this.BaseSchema + "string orgdid, string name"
  static async addIndivAttestation(chain: Chain, attestation: IndivAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, indivDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    console.info("....... add indiv attestation signer: ", signer)
    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    console.info("create attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.IndivSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'orgdid', value: attestation.orgDid, type: 'string' },
          { name: 'name', value: attestation.name, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.IndivSchemaUID, encodedData, indivAccountClient, indivDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

        console.info("********************  done adding indiv attestation *********************")

    }



    return attestation.entityId

  }
  static constructIndivAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let orgdid: string | undefined
    let name : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "orgdid") {
        orgdid = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && orgdid != undefined && name != undefined && vcid != undefined) {
      //console.info("set to indiv attestation with name: ", name)
      const att : IndivAttestation = {
        displayName: name,
        class: "individual",
        category: "wallet",
        entityId: entityId,
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        orgDid: orgdid,
        name: name
      }

      return att
    }



    return undefined
  }

  static OrgIndivSchemaUID = "0xf814ab5706be8e7e4491e73c729a35453a5b8ebf48b0975dc95ddb77162b149f"
  static OrgIndivSchema = this.BaseSchema + "string indivdid, string name, string delegation"
  static async addOrgIndivAttestation(chain: Chain, attestation: OrgIndivAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.name && attestation.delegation) {

      const schemaEncoder = new SchemaEncoder(this.OrgIndivSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'indivdid', value: attestation.indivDid, type: 'string' },
          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'delegation', value: attestation.delegation, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.OrgIndivSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

        console.info("********************  done adding attestation *********************")

    }



    return attestation.entityId

  }
  static constructOrgIndivAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let indivdid: string | undefined
    let name : string | undefined
    let delegation : string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "indivdid") {
        indivdid = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
      if (fieldName == "delegation") {
        delegation = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && indivdid != undefined && name != undefined && delegation != undefined) {
      const att : OrgIndivAttestation = {
        displayName: name,
        class: "organization",
        category: "leadership",
        entityId: entityId,
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        indivDid: indivdid,
        name: name,
        delegation: delegation
      }

      //console.info("OrgIndivAttestation: ", att)

      return att
    }



    return undefined
  }


  static OrgSchemaUID = "0x50aa9bcdc8b8d6c926a9790dd7dc81f74b30f29b697777c8c7e39384571f9d09"
  static OrgSchema = this.BaseSchema + "string name"
  static async addOrgAttestation(chain: Chain, attestation: OrgAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    console.info("....... add org attestation signer: ", signer)
    console.info("....... signer type: ", typeof signer)
    console.info("....... signer address: ", await signer.getAddress())
    console.info("....... signer provider: ", signer.provider)

    // Create a new EAS instance for this specific chain
    const easContractAddress = EAS_CONTRACT_ADDRESS || "0x4200000000000000000000000000000000000021";
    console.info("....... EAS contract address: ", easContractAddress)
    const chainEas = new EAS(easContractAddress);
    console.info("....... EAS instance created: ", chainEas)

    try {
      chainEas.connect(signer)
      console.info("....... EAS connected successfully")
    } catch (error) {
      console.error("....... Error connecting EAS: ", error)
      throw error
    }



    console.info("eas is connected so add org attestation: ", attestation)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    //console.info("attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.OrgSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },

        ];

        console.info("Store attestation: ", attestation)
        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.OrgSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, chainEas, verifyAttestationAvailability)

        console.info("send out attestation change event")
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }



    return attestation.entityId

  }
  static constructOrgAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let name : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined) {
        //console.info("set to org attestation with name: ", name)
        const att : OrgAttestation = {
          displayName: name,
          class: "organization",
          category: "wallet",
          entityId: entityId,
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          name: name
        }

        return att
      }



    return undefined
  }


  static IndivAccountSchemaUID = "0x5c969e9ab4d9b6e2e4c77ab03395fdb70e907c1e3e55b1728f70319fc54b3169"
  static IndivAccountSchema = this.BaseSchema + "string accountname, string accountdid"
  static async addIndivAccountAttestation(chain: Chain, attestation: IndivAccountAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, indivDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    console.info("....... add account attestation attestation: ", attestation)
    console.info("...... delegation chain: ", delegationChain)

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    //console.info("attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.accountName) {

      const schemaEncoder = new SchemaEncoder(this.IndivAccountSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'accountname', value: attestation.accountName, type: 'string' },
          { name: 'accountdid', value: attestation.accountDid, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.IndivAccountSchemaUID, encodedData, indivAccountClient, indivDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }



    return attestation.entityId

  }
  static constructIndivAccountAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let accountname : string | undefined
    let accountDid : string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]
      let fieldValue = field["value"].value as string

      if (fieldName == "hash") {
        hash = fieldValue
      }
      if (fieldName == "vccomm") {
        vccomm = fieldValue
      }
      if (fieldName == "vcsig") {
        vcsig = fieldValue
      }
      if (fieldName == "vciss") {
        vciss = fieldValue
      }
      if (fieldName == "vcid") {
        vcid = fieldValue
      }
      if (fieldName == "proof") {
        proof = fieldValue
      }
      if (fieldName == "accountname") {
        accountname = fieldValue
      }
      if (fieldName == "accountdid") {
        accountDid = fieldValue
      }

    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && accountname != undefined && accountDid != undefined) {
        const att : IndivAccountAttestation = {
          displayName: accountname,
          class: "individual",
          category: "finance",
          entityId: entityId,
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          accountName: accountname,
          accountDid: accountDid,
          accountBalance: "0"
        }

        return att
      } else {
      }



    return undefined
  }

  static AccountOrgDelSchemaUID = "0x4a66bdbef7dff7dd4f7b87d955e1e83ec2b457e81c3b32a4f909a527b2b0065c"
  static AccountOrgDelSchema = this.BaseSchema + "string accountdid, string accountname, string coacode, string coacategory, string delegation"
  static async addAccountOrgDelAttestation(chain: Chain, attestation: AccountOrgDelAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.accountName) {

      const schemaEncoder = new SchemaEncoder(this.AccountOrgDelSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'accountdid', value: attestation.accountDid, type: 'string' },
          { name: 'accountname', value: attestation.accountName, type: 'string' },


          { name: 'coacode', value: attestation.coaCode, type: 'string' },
          { name: 'coacategory', value: attestation.coaCategory, type: 'string' },

          { name: 'delegation', value: attestation.delegation, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain,this.AccountOrgDelSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }



    return attestation.entityId

  }
  static constructAccountOrgDelAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let accountname : string | undefined
    let accountDid : string | undefined
    let delegation : string | undefined
    let coaCode : string | undefined
    let coaCategory : string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "accountname") {
        accountname = field["value"].value as string
      }
      if (fieldName == "coacode") {
        coaCode = field["value"].value as string
      }
      if (fieldName == "coacategory") {
        coaCategory = field["value"].value as string
      }
      if (fieldName == "accountdid") {
        accountDid = field["value"].value as string
      }
      if (fieldName == "delegation") {
        delegation = field["value"].value as string
      }
    }

    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && accountname != undefined && accountDid != undefined && delegation != undefined && coaCode != undefined && coaCategory != undefined) {
        //console.info("set to org account attestation with name: ", name)
        const att : AccountOrgDelAttestation = {
          displayName: accountname,
          class: "organization",
          category: "delegations",
          entityId: entityId,
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          accountName: accountname,
          coaCode: coaCode,
          coaCategory: coaCategory,
          accountDid: accountDid,
          delegation: delegation
        }

        return att
      }



    return undefined
  }

  static AccountIndivDelSchemaUID = "0x671dc5424b2424e57e002804b70b39d3150fc472a819e030237dc0a915ccaf33"
  static AccountIndivDelSchema = this.BaseSchema + "string indivdid, string accountdid, string accountname, string coacode, string coacategory, string orgdelegation, string indivdelegation"
  static async addAccountIndivDelAttestation(chain: Chain, attestation: AccountIndivDelAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.accountName) {

      const schemaEncoder = new SchemaEncoder(this.AccountIndivDelSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'indivdid', value: attestation.indivDid, type: 'string' },

          { name: 'accountdid', value: attestation.accountDid, type: 'string' },
          { name: 'accountname', value: attestation.accountName, type: 'string' },


          { name: 'coacode', value: attestation.coaCode, type: 'string' },
          { name: 'coacategory', value: attestation.coaCategory, type: 'string' },


          { name: 'orgdelegation', value: attestation.orgDelegation, type: 'string' },
          { name: 'indivdelegation', value: attestation.indivDelegation, type: 'string' },

        ];


        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain,this.AccountIndivDelSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }



    return attestation.entityId

  }
  static constructAccountIndivDelAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let accountname : string | undefined
    let accountDid : string | undefined
    let orgDelegation : string | undefined
    let indivDelegation : string | undefined
    let coaCode : string | undefined
    let coaCategory : string | undefined
    let indivDid : string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "accountname") {
        accountname = field["value"].value as string
      }
      if (fieldName == "coacode") {
        coaCode = field["value"].value as string
      }
      if (fieldName == "coacategory") {
        coaCategory = field["value"].value as string
      }
      if (fieldName == "accountdid") {
        accountDid = field["value"].value as string
      }
      if (fieldName == "indivdid") {
        indivDid = field["value"].value as string
      }
      if (fieldName == "orgdelegation") {
        orgDelegation = field["value"].value as string
      }
      if (fieldName == "indivdelegation") {
        indivDelegation = field["value"].value as string
      }
    }

    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && indivDid && accountname != undefined && accountDid != undefined && orgDelegation != undefined && indivDelegation != undefined && coaCode != undefined && coaCategory != undefined) {
        //console.info("set to org account attestation with name: ", name)
        const att : AccountIndivDelAttestation = {
          displayName: accountname,
          class: "organization",
          category: "account access",
          entityId: entityId,
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          accountName: accountname,
          indivDid: indivDid,
          coaCode: coaCode,
          coaCategory: coaCategory,
          accountDid: accountDid,
          orgDelegation: orgDelegation,
          indivDelegation: indivDelegation
        }

        return att
      }



    return undefined
  }


  static OrgAccountSchemaUID = "0xf965206ce74eb4591fca4065803bd1512041bc8816444265a4c2fa497f5f43f1"
  static OrgAccountSchema = this.BaseSchema + "string accountdid, string accountname, string coacode, string coacategory"
  static async addOrgAccountAttestation(chain: Chain, attestation: OrgAccountAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.accountName) {

      const schemaEncoder = new SchemaEncoder(this.OrgAccountSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'accountdid', value: attestation.accountDid, type: 'string' },
          { name: 'accountname', value: attestation.accountName, type: 'string' },


          { name: 'coacode', value: attestation.coaCode, type: 'string' },
          { name: 'coacategory', value: attestation.coaCategory, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain,this.OrgAccountSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }



    return attestation.entityId

  }
  static constructOrgAccountAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let accountname : string | undefined
    let accountDid : string | undefined
    let coaCode : string | undefined
    let coaCategory : string | undefined

    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "accountname") {
        accountname = field["value"].value as string
      }
      if (fieldName == "coacode") {
        coaCode = field["value"].value as string
      }
      if (fieldName == "coacategory") {
        coaCategory = field["value"].value as string
      }
      if (fieldName == "accountdid") {
        accountDid = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && accountname != undefined && accountDid != undefined && coaCode != undefined && coaCategory != undefined) {
        //console.info("set to org account attestation with name: ", name)
        const att : OrgAccountAttestation = {
          displayName: accountname,
          class: "organization",
          category: "finance",
          entityId: entityId,
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          accountName: accountname,
          coaCode: coaCode,
          coaCategory: coaCategory,
          accountDid: accountDid
        }

        return att
      }



    return undefined
  }



  static SocialSchemaUID = "0xd00b6934cdad8201a14471d066718b63ae5be129cde05159afd2fce232f4b06d"
  static SocialSchema = this.BaseSchema + "string name, string url"
  static async addSocialAttestation(chain: Chain, attestation: SocialAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, burnerAccountClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.name != undefined && attestation.url != undefined && attestation.proof != undefined) {

      const schemaEncoder = new SchemaEncoder(this.SocialSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'url', value: attestation.url, type: 'string' },
        ];

      const encodedData = schemaEncoder.encodeData(schemaItems);

      console.info("store attestation")
              await AttestationService.storeAttestation(chain, this.SocialSchemaUID, encodedData, indivAccountClient, burnerAccountClient, delegationChain, undefined, verifyAttestationAvailability)

      console.info("done")
      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);

    }
    else {
      console.info("parms: ", attestation.vccomm, attestation.vcsig, attestation.vciss, attestation.name, attestation.url, attestation.proof)


      throw new Error("social attestation info not complete")
    }

    return attestation.entityId
  }
  static async updateSocialAttestation(chain: Chain, attestation: SocialAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, walletClient: WalletClient): Promise<void> {

    eas.connect(signer)

    // revoke
    if (attestation?.uid) {
      let tx = await eas.revoke({ schema: this.SocialSchemaUID, data: { uid: attestation.uid }})
      let trx = await orgAccountClient.sendTransaction(tx.data, {
        paymasterServiceData: {
          mode: 'SPONSORED',
        },
      })
      let rsl = await trx.wait()
    }

    let result2 = await this.addSocialAttestation(chain, attestation, signer, delegationChain, orgAccountClient, orgAccountClient)
  }
  static constructSocialAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {


    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let name : string | undefined
    let url : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
      if (fieldName == "url") {
        url = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined) {
      //console.info("set to social attestation with name: ", name)
      let displayName = name
      if (displayName == "" || displayName == undefined || displayName == null) {
        displayName = entityId.replace("(org)", "").replace("(indiv)", "").replace("(agent)", "")
      }

      const att : SocialAttestation = {
        displayName: displayName,
        entityId: entityId,
        class: "individual",
        category: "identity",
        attester: attester,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        name: name,
        url: url
      }

      return att
    }


    return undefined
  }

  static RegisteredDomainSchemaUID = "0xf4385673957d7b6a14c1c175cb46ffb90bfc7a31b7515333582d32de797d2d85"
  static RegisteredDomainSchema = this.BaseSchema + "string domain, uint64 domaincreationdate"
  static async addRegisteredDomainAttestation(chain: Chain, attestation: RegisteredDomainAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.domain && attestation.domaincreationdate) {

      const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
      const schemaItems : SchemaItem[] = [

          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'domain', value: attestation.domain, type: 'string' },
          { name: 'domaincreationdate', value: attestation.domaincreationdate, type: 'uint64' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.RegisteredDomainSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }

    return attestation.entityId

  }
  static constructRegisteredDomainAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let domain : string | undefined
    let proof : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "domain") {
        domain = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && domain != undefined) {
        //console.info("set to org attestation with name: ", name)
        const att : RegisteredDomainAttestation = {
          displayName: domain,
          entityId: entityId,
          class: "organization",
          category: "identity",
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          domain: domain
        }

        return att
      }



    return undefined
  }


  static RegisteredENSSchemaUID = "0xa5fd47bc58477f60bf9e0578d792ac9831563f11bfc453111bec62cac130d6b2"
  static RegisteredENSSchema = this.BaseSchema + "string name, uint64 enscreationdate"
  static async addRegisteredENSAttestation(chain: Chain, attestation: RegisteredENSAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.name && attestation.enscreationdate) {

      const schemaEncoder = new SchemaEncoder(this.RegisteredENSSchema);
      const schemaItems : SchemaItem[] = [

          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'enscreationdate', value: attestation.enscreationdate, type: 'uint64' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.RegisteredENSSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }

    return attestation.entityId

  }
  static constructRegisteredENSAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let name : string | undefined
    let proof : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined) {
        //console.info("set to org attestation with name: ", name)
        const att : RegisteredENSAttestation = {
          displayName: name,
          entityId: entityId,
          class: "organization",
          category: "identity",
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          vcid: vcid,
          proof: proof,
          name: name
        }

        return att
      }



    return undefined
  }


  static StateRegistrationSchemaUID = "0x3d1a1b62328b2161cd15c71ada653f08dc92644707a3321af21067746729335c"
  static StateRegistrationSchema = this.BaseSchema + "string name, string idnumber, string status, uint64 formationdate, string locationaddress"
  static async addStateRegistrationAttestation(chain: Chain, attestation: StateRegistrationAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.name) {

      //console.info("adding attestation: ", attestation)
      const schemaEncoder = new SchemaEncoder(this.StateRegistrationSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'idnumber', value: attestation.idnumber, type: 'string' },
          { name: 'status', value: attestation.status, type: 'string' },
          { name: 'formationdate', value: issuedate, type: 'uint64' },
          { name: 'locationaddress', value: attestation.locationaddress, type: 'string' },
        ];


        const encodedData = schemaEncoder.encodeData(schemaItems);

        console.info("store state registration ... attestation")
        await AttestationService.storeAttestation(chain, this.StateRegistrationSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);


    }

    return attestation.entityId

  }
  static constructStateRegistrationAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let name : string | undefined
    let idnumber : string | undefined
    let status : string | undefined
    let formationdate : number | undefined
    let locationaddress : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
      if (fieldName == "status") {
        status = field["value"].value as string
      }
      if (fieldName == "idnumber") {
        idnumber = field["value"].value as string
      }
      if (fieldName == "formationdate") {
        formationdate = field["value"].value as number
      }
      if (fieldName == "locationaddress") {
        locationaddress = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && proof != undefined && name != undefined && idnumber && status && formationdate && locationaddress) {
      //console.info("set to social attestation with name: ", name)
      const att : StateRegistrationAttestation = {
        displayName: name,
        entityId: entityId,
        class: "organization",
        category: "compliance",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        name: name,
        idnumber: idnumber,
        status: status,
        formationdate: formationdate,
        locationaddress: locationaddress
      }

      return att
    }



    return undefined
  }


  static EmailSchemaUID = "0x6726283e51f9967cce55736a73082ef5e0d653f77fed99c255e9a150217d059a"
  static EmailSchema = this.BaseSchema + "string type, string email"
  static async addEmailAttestation(chain: Chain, attestation: EmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof) {

      //console.info("add email attestation: ", attestation)
      const schemaEncoder = new SchemaEncoder(this.EmailSchema);
      const schemaItems : SchemaItem[] = [

          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'email', value: attestation.email, type: 'string' },

        ];



      const encodedData = schemaEncoder.encodeData(schemaItems);
              await AttestationService.storeAttestation(chain, this.EmailSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, verifyAttestationAvailability)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);


    }

    return attestation.entityId
  }
  static constructEmailAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let type : string | undefined
    let email : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "type") {
        type = field["value"].value as string
      }
      if (fieldName == "email") {
        email = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type && email) {
      //console.info("set to social attestation with name: ", name)
      const att : EmailAttestation = {
        displayName: email,
        entityId: entityId,
        class: "organization",
        category: "identity",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        type: type,
        email: email
      }

      return att
    }



    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "type") {
        type = field["value"].value as string
      }
      if (fieldName == "email") {
        email = field["value"].value as string
      }

    }


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type != undefined && email != undefined) {
      const att : EmailAttestation = {
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        attester: attester,
        hash: hash,
        type: type,
        email: email,
      }

      return att
    }

    return undefined
  }

  static WebsiteSchemaUID = "0x5afa13313c6ba5a36ff495105bcd15106fc7c706ba7a58911d90d0ea412b3d6f"
  static WebsiteSchema = this.BaseSchema + "string type, string url"
  static async addWebsiteAttestation(chain: Chain, attestation: WebsiteAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof && attestation.type && attestation.url) {
      const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'url', value: attestation.url, type: 'string' },
        ];

      const encodedData = schemaEncoder.encodeData(schemaItems);
              await AttestationService.storeAttestation(chain, this.WebsiteSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, true)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);


    }


    return attestation.entityId
  }
  static constructWebsiteAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let url : string | undefined
    let type : string | undefined



    //console.info("attestation id: ", uid)
    //console.info("attester id: ", attester)
    //console.info("schema id: ", schemaId)
    //console.info("entity id: ", entityId)

    //console.info("construct website attestation: ", decodedData)
    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "url") {
        url = field["value"].value as string
      }
      if (fieldName == "type") {
        type = field["value"].value as string
      }
    }


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && vccomm != undefined && vcsig != undefined && vcid != undefined && vciss != undefined  && url != undefined && type != undefined) {

      const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      const att : WebsiteAttestation = {
        displayName: url,
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        class: "organization",
        category: "identity",
        attester: attesterDid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        type: type,
        url: url,
      }

      return att
    }

    return undefined
  }



  static InsuranceSchemaUID = "0xc953d1ea2c3802bee32b482c89c62eb4c41782f3f6dc02bcac06ae8ebab72abd"
  static InsuranceSchema = this.BaseSchema + "string type, string policy"
  static async addInsuranceAttestation(chain: Chain, attestation: InsuranceAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof) {

      const schemaEncoder = new SchemaEncoder(this.InsuranceSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'policy', value: attestation.policy, type: 'string' },
        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.InsuranceSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain, undefined, true)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }

    return attestation.entityId
  }
  static constructInsuranceAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let policy : string | undefined = ""
    let type : string | undefined = ""

    /*
    console.info("attestation id: ", uid)
    console.info("attester id: ", attester)
    console.info("schema id: ", schemaId)
    console.info("entity id: ", entityId)
    */

    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    //console.info("construct insurance attestation with data: ", decodedData)
    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "policy") {
        policy = field["value"].value as string
      }
      if (fieldName == "type") {
        type = field["value"].value as string
      }
    }


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && vccomm != undefined && vcsig != undefined && vcid != undefined && vciss != undefined  && policy != undefined && type != undefined) {
      const att : InsuranceAttestation = {
        displayName: entityId,
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        class: "organization",
        category: "compliance",
        attester: attesterDid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        type: type,
        policy: policy,
      }

      return att
    }

    return undefined
  }



  static IndivEmailSchemaUID = "0x78169438b35b97515fdb9d53e942b90bb380c0c56319a88ff2862425dc4bed20"
  static IndivEmailSchema = this.BaseSchema + "string class, string email"
  static async addIndivEmailAttestation(chain: Chain, attestation: IndivEmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, burnerAccountClient: MetaMaskSmartAccount, verifyAttestationAvailability: boolean = true): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2027-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.vcid && attestation.proof) {

      //console.info("add email attestation: ", attestation)
      const schemaEncoder = new SchemaEncoder(this.IndivEmailSchema);
      const schemaItems : SchemaItem[] = [

          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          { name: 'vcid', value: attestation.vcid, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'class', value: attestation.type, type: 'string' },
          { name: 'email', value: attestation.email, type: 'string' },

        ];



      const encodedData = schemaEncoder.encodeData(schemaItems);
              await AttestationService.storeAttestation(chain, this.IndivEmailSchemaUID, encodedData, indivAccountClient, burnerAccountClient, delegationChain, undefined, verifyAttestationAvailability)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);


    }

    return attestation.entityId
  }
  static constructIndivEmailAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let vcid : string | undefined
    let proof : string | undefined
    let type : string | undefined
    let email : string | undefined


    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "hash") {
        hash = field["value"].value as string
      }
      if (fieldName == "vccomm") {
        vccomm = field["value"].value as string
      }
      if (fieldName == "vcsig") {
        vcsig = field["value"].value as string
      }
      if (fieldName == "vciss") {
        vciss = field["value"].value as string
      }
      if (fieldName == "vcid") {
        vcid = field["value"].value as string
      }
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "class") {
        type = field["value"].value as string
      }
      if (fieldName == "email") {
        email = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type && email) {
      //console.info("set to social attestation with name: ", name)
      const att : EmailAttestation = {
        displayName: email,
        entityId: entityId,
        class: "individual",
        category: "identity",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        vcid: vcid,
        proof: proof,
        type: type,
        email: email
      }

      return att
    }



    for (const field of decodedData) {
      let fieldName = field["name"]

      if (fieldName == "type") {
        type = field["value"].value as string
      }
      if (fieldName == "email") {
        email = field["value"].value as string
      }

    }


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type != undefined && email != undefined) {
      const att : IndivEmailAttestation = {
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        attester: attester,
        hash: hash,
        type: type,
        email: email,
      }

      return att
    }

    return undefined
  }


  static deepCopyChatMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => ({
      ...msg,
      fileDataRef: msg.fileDataRef?.map(fileRef => ({
        ...fileRef,
        fileData: fileRef.fileData ? { ...fileRef.fileData } : null,
      }))
    }));
  }

  static async deleteIssuerAttestation(uid: string, schemaId: string, signer: ethers.JsonRpcSigner, burnerAccountClient: MetaMaskSmartAccount): Promise<void> {

    eas.connect(signer)

    if (burnerAccountClient) {

      //let att = atts[0]
      let txs : any[] = []

      const tx = await eas.revoke({ schema: schemaId, data: { uid: uid }})
      txs.push(tx.data)

      console.info("send transactions: ", schemaId, uid)
      const delTx = await burnerAccountClient.sendTransaction(txs, {
        paymasterServiceData: {
          mode: 'SPONSORED',
        },
      })
      const delResp = await delTx.wait()
      console.info("delete done: ", delResp)

    }


  }

  static async deleteAttestations(chain: Chain, atts: Attestation[], signer: ethers.JsonRpcSigner, delegationChain: Delegation[], delegateClient: MetaMaskSmartAccount): Promise<void> {

    eas.connect(signer)

    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      //entryPoint: { address: ENTRY_POINT_ADDRESS, version: '0.7' },
    });
    const bundlerClient = createBundlerClient({
                    transport: http(BUNDLER_URL),
                    paymaster: createPaymasterClient({
                      transport: http(PAYMASTER_URL),
                    }),
                    chain: chain,
                    paymasterContext: {
                      // at minimum this must be an object; for Biconomy you can use:
                      mode:             'SPONSORED',
                      //calculateGasLimits: true,
                      //expiryDuration:  300,
                    },
                  });

    const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
    let userOpHash: Hex;

    let calls = []

    for (const att of atts) {
      if (att.schemaId && att.uid) {

        const tx = await eas.revoke({ schema: att.schemaId, data: { uid: att.uid }})

        let execution = [
          {
            target: tx.data.to,
            value: 0n,
            callData: tx.data.data,
          },
        ];

        console.info("redeemDelegations ........")
        const data = DelegationFramework.encode.redeemDelegations({
          delegations: [ delegationChain ],
          modes: [SINGLE_DEFAULT_MODE],
          executions: [execution]
        });

        const call = {
          to: delegateClient.address,
          data,
        }

        console.info("delete attestation: ", att.schemaId, att.uid)
        calls.push(call)
      }
    }


    console.info("################# sendUserOperation ........")
    userOpHash = await bundlerClient.sendUserOperation({
      account: delegateClient,
      calls: calls,
      ...fee,
    });


    const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.info("################# delete result: ", userOperationReceipt)

    console.info("################# delete successful")


    let event: AttestationChangeEvent = {action: 'delete-all', entityId: ""};
    attestationsEmitter.emit('attestationChangeEvent', event);

  }

  static async deleteAllAttestations(): Promise<void> {
    await FileDataService.deleteAllFileData();
    let event: AttestationChangeEvent = {action: 'delete-all', entityId: ""};
    attestationsEmitter.emit('attestationChangeEvent', event);
  }

  static async loadAttestationCategories(): Promise<AttestationCategory[]> {
    let attestationCategories : AttestationCategory[] = [
      {
        class: "organization",
        name: "wallet",
        id: "1"
      },
      {
        class: "organization",
        name: "identity",
        id: "10"
      },
      {
        class: "organization",
        name: "leadership",
        id: "20"
      },
      {
        class: "organization",
        name: "finance",
        id: "30"
      },
      {
        class: "organization",
        name: "compliance",
        id: "40"
      },
      {
        class: "organization",
        name: "account access",
        id: "50"
      },

      {
        class: "organization",
        name: "delegations",
        id: "80"
      },
      {
        class: "individual",
        name: "wallet",
        id: "10"
      },
      {
        class: "individual",
        name: "identity",
        id: "90"
      },
      {
        class: "individual",
        name: "finance",
        id: "92"
      }
    ]

    return attestationCategories
  }

  static async loadRecentAttestationsTitleOnly(chain: Chain, orgDid: string, indivDid: string, currentWalletAddress?: string): Promise<Attestation[]> {

    const orgAddress = orgDid.replace("did:pkh:eip155:" + chain?.id + ":", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:"  + chain?.id + ":", "")

    // Determine which addresses to query based on the currently connected wallet
    let addressesToQuery: string[] = [];

    if (currentWalletAddress) {
      // If we have a current wallet address, only query attestations from addresses
      // that belong to this specific wallet session

      // For now, we'll still query both addresses but add more specific filtering later
      // This is a conservative approach to ensure we don't miss any attestations
      addressesToQuery = [orgAddress, indivAddress];
    } else {
      // Fallback to the original behavior if no current wallet address is provided
      addressesToQuery = [orgAddress, indivAddress];
    }

    try {

      //console.info("load attestations for: ", indivAddress)
      let exists = false
      const query = gql`
        query {
          attestations(
            where: {
              attester: { in: [${addressesToQuery.map(addr => `"${addr}"`).join(", ")}] }
              revoked: { equals: false }
            }
          ) {
            id
            attester
            schemaId
            data
          }
        }`;


      const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });

      const attestations : Attestation[] = []
      let processedCount = 0;
      let skippedCount = 0;

      for (const item of data.attestations) {

          let schema
          for (const entity of AttestationService.DefaultEntities) {
            //console.info("item: ", item, entity.schemaId)
            if (entity.schemaId == item.schemaId) {
              schema = entity.schema
              break
            }
          }


          if (schema) {

            let entityId = "entityId"
            let hash = ""

            let decodedData : SchemaDecodedItem[] = []

            try {
              const schemaEncoder = new SchemaEncoder(schema);
              decodedData = schemaEncoder.decodeData(item.data);
              for (const field of decodedData) {
                if (field["name"] == "entityid") {
                  if (typeof field["value"].value === "string") {
                    entityId = field["value"].value
                  }
                }
                if (field["name"] == "hash") {
                  if (typeof field["value"].value === "string") {
                    hash = field["value"].value
                  }
                }
              }
            }
            catch (error) {
              console.info("error uid: ", item.id)
              console.info("error schemaId: ", item.schemaId)
            }

            // Additional filtering: Only process attestations that belong to the current user's context
            let shouldProcessAttestation = true;

            

            // For organization-related attestations, check if they belong to the current org
            if (entityId.includes("(org)") && item.attester.toLowerCase() === orgAddress.toLowerCase()) {
              // This is an org attestation, verify it belongs to current org
              shouldProcessAttestation = true;
            }
            // For individual-related attestations, check if they belong to the current individual
            else if (entityId.includes("(indiv)") && item.attester.toLowerCase() === indivAddress.toLowerCase()) {
              // This is an individual attestation, verify it belongs to current individual
              shouldProcessAttestation = true;
            }
            // If attestation is from a different address than expected, skip it
            else if (item.attester.toLowerCase() !== orgAddress.toLowerCase() &&
                     item.attester.toLowerCase() !== indivAddress.toLowerCase()) {
              shouldProcessAttestation = false;
            }

            // Additional filtering: If we have a current wallet address, ensure attestations belong to this wallet's context
            if (currentWalletAddress && shouldProcessAttestation) {
              // The currentWalletAddress is the EOA address of the connected wallet
              // We need to check if this attestation was created by smart accounts that belong to this EOA
              // This is a more sophisticated check that could be enhanced with additional context

              // For now, we'll use the existing logic but add more detailed logging
              const attestationBelongsToCurrentWallet =
                item.attester.toLowerCase() === orgAddress.toLowerCase() ||
                item.attester.toLowerCase() === indivAddress.toLowerCase();

              if (!attestationBelongsToCurrentWallet) {
                shouldProcessAttestation = false;
              } else {
              }
            }

            if (!shouldProcessAttestation) {
              skippedCount++;
              continue;
            }

            processedCount++;

            // construct correct attestation
            let att : Attestation | undefined

            if (entityId == "indiv(indiv)") {
              att = this.constructIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "agent(agent)") {
              att = this.constructAIAgentAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account(indiv)") {
              att = this.constructIndivAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account-org(org)") {
              att = this.constructAccountOrgDelAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account-indiv(org)") {
              att = this.constructAccountIndivDelAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account(org)") {
              att = this.constructOrgAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org(org)") {
              att = this.constructOrgAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org-indiv(org)") {
              att = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "linkedin(indiv)") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "x(indiv)") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "shopify(org)") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "insurance(org)") {
              att = this.constructInsuranceAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "state-registration(org)") {
              att = this.constructStateRegistrationAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "ens(org)") {
              att = this.constructRegisteredENSAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "domain(org)") {
              att = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "website(org)") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email(org)") {
              att = this.constructEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email(indiv)") {
              att = this.constructIndivEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }


            if (att == undefined) {
              //console.info("att is undefined: ", att, item.id)
              att = {
                uid: item.id,
                attester: "did:pkh:eip155:" + chain?.id + ":" + item.attester,
                schemaId: item.schemaId,
                entityId: entityId,
                url: "https://www.richcanvas3.com",
                hash: hash,
              }
            }
            else {
              //console.info("att: ", att.displayName, item.id)
              att.uid = item.id,
              att.attester = "did:pkh:eip155:" + chain?.id + ":" + item.attester,
              att.schemaId = item.schemaId,
              entityId = entityId

              attestations.push(att)
            }

            //console.info("push att on list: ", att)

          }

      }
      return attestations;

    } catch (error) {
      console.error("Error loading recent attestations:", error);
      throw error;
    }
  }

  static async saveBlacklist(payload: any)  {
    /*
    const filename = "blacklist"

    const res = await fetch(`${STORE_URL}?filename=${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    */

  };



  static Blacklisted =  [
    {'did': 'did:pkh:eip155:10:0x478df0535850b01cBE24AA2DAd295B2968d24B67'},
    {'did': 'did:pkh:eip155:10:0x89AA108af44d340Be28034965c760Dd1Bb289189'},
    {'did': 'did:pkh:eip155:10:0x64b10fC4001023f2Be205eD83b7bf05f1bC2716C'},
    {'did': 'did:pkh:eip155:10:0xccEF79B6B5d5db30DaB7fd8759B4953c1923da12'},
    {'did': 'did:pkh:eip155:10:0x97D9d517A2948ae4eF9076b01492c7981e787B81'},
    {'did': 'did:pkh:eip155:10:0xb201929847147A25B5701F6f2c4058f3d3836c57'},
    {'did': 'did:pkh:eip155:10:0xd07ad34308111AC10EC883326A7DB9e77b4Da5A9'},
    {'did': 'did:pkh:eip155:10:0xd07ad34308111AC10EC883326A7DB9e77b4Da5A9'},
    {'did': 'did:pkh:eip155:10:0x547329A545144379D1DA8aB6D61003b63AB2dcb2'},
    {'did': 'did:pkh:eip155:10:0x3c7fBd352C116C1d1453592073d0e8c9470142e7'},
    {'did': 'did:pkh:eip155:10:0x367D2330bf05DF35cF5E9d8866aCcCfA2cB52761'},
    {'did': 'did:pkh:eip155:10:0x1fe5E70A1E6927a70998e37673786DC04608BC80'},
  ]


  static isBlacklisted(did: string) : boolean {



    for (const item of AttestationService.Blacklisted) {
      if (item.did.toLowerCase() == did.toLowerCase()) {
        return true
      }
    }

    return false
  }


  static async loadOrganizations(chain: Chain): Promise<Organization[]> {
    try {

      let exists = false
      const schemaId = AttestationService.OrgSchemaUID
      const query = gql`
        query {
          attestations(
            where: {
              schemaId: { equals: "${schemaId}" }
              revoked: { equals: false }
            }
          ) {
            id
            schemaId
            attester
            data
          }
        }`;


      const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });

      const organizations : Organization[] = []

      let id = 1

      for (const item of data.attestations) {

        let schema = this.OrgSchema

        if (schema) {

          let name = ""
          let orgDid = ""
          let issuedate = ""
          let hash = ""

          const schemaEncoder = new SchemaEncoder(schema);
          const decodedData = schemaEncoder.decodeData(item.data);

          //console.info("data: ", decodedData)

          orgDid = "did:pkh:eip155:" + chain?.id + ":" + item.attester

          if (this.isBlacklisted(orgDid) == false) {

            for (const field of decodedData) {

              //console.info("name: ", field["name"])
              //console.info("type of value: ", typeof field["value"].value)
              //console.info("value: ", field["value"].value)
              if (field["name"] == "name") {
                if (typeof field["value"].value === "string") {
                  name = field["value"].value
                }
              }

              if (field["name"] == "attester") {
                if (typeof field["value"].value === "string") {
                  orgDid = field["value"].value
                }
              }

              if (field["name"] == "issuedate") {
                if (typeof field["value"].value === "bigint") {
                  const issuedateVal = field["value"].value as bigint
                  issuedate = new Date(Number(issuedateVal) * 1000).toISOString().split('T')[0];
                }
              }
            }

            //console.info("name: ", name)
            //console.info("orgDid: ", orgDid)
            //console.info("issuedate: ", issuedate)

            if (name && name != "") {
              let org : Organization = {
                id: id,
                name: name,
                hash: hash,
                orgDid: orgDid,
                issuedate: issuedate
              }
              id = id + 1
              organizations.push(org)
            }
          }

        }

      }
      return organizations;

    } catch (error) {
      console.error("Error loading recent attestations:", error);
      throw error;
    }
  }

  static async loadOrgAccounts(chain: Chain, orgDid: string, coaCategory: string): Promise<Account[]> {


    const allAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "")

    const accounts : Account[] = [];


    for (const att of allAttestations) {
      if (att.entityId === "account-org(org)") {
        const accountAtt = att as AccountOrgDelAttestation;
        const acct: Account = {
          id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
          code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
          name: accountAtt.accountName,
          did: accountAtt.accountDid,
          type: ACCOUNT_TYPES.Asset,
          attestation: att as AccountOrgDelAttestation,
          balance: 0,
          level: 4,
          parentId: accountAtt.coaCategory,
          children: [],
        };

        if (acct.parentId == coaCategory) {
          accounts.push(acct);
        }

      }
    }

    return accounts;
  }
  static async loadIndivAccounts(chain: Chain, orgDid: string, indivDid: string, coaCategory: string): Promise<IndivAccount[]> {


    const allAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "")

    const accounts : IndivAccount[] = [];


    for (const att of allAttestations) {
      if (att.entityId === "account-indiv(org)") {
        const accountAtt = att as AccountIndivDelAttestation;
        if (accountAtt.indivDid == indivDid) {

          const acct: IndivAccount = {
            id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
            code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
            name: accountAtt.accountName,
            did: accountAtt.accountDid,
            type: ACCOUNT_TYPES.Asset,
            attestation: att as AccountIndivDelAttestation,
            balance: 0,
            level: 4,
            parentId: accountAtt.coaCategory,
            children: [],
          };


          console.info("@@@@@@@@@@@@@ accountAtt found: ", coaCategory, acct.parentId)

          if (acct.parentId == coaCategory) {
            accounts.push(acct);
          }
        }


      }
    }

    return accounts;
  }

  static checkEntity(entityId: string, decodedData: SchemaDecodedItem[]): boolean {
    for (const field of decodedData) {
      let fieldName = field["name"]
      let fieldValue = field["value"].value as string

      if (fieldName == "entityid") {
        if (fieldValue == entityId) {
          return true
        }
      }
    }

    return false
  }

  static async getAttestationByDidAndSchemaId(chain: Chain, did: string, schemaId: string, entityId: string, displayName: string): Promise<Attestation | undefined> {

    //console.info("get attestation by address and schemaId and entityId: ", address, schemaId, entityId)
    let rtnAttestation : Attestation | undefined

    const address = did.replace("did:pkh:eip155:" + chain?.id + ":", "")


    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            attester: { equals: "${address}" }
            schemaId: { equals: "${schemaId}" }
            revoked: { equals: false }
          }
        ) {
          id
          schemaId
          data
        }
      }`;

    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });
    //console.info(">>>>>>>>>>>>>>>>>>> data: ", data)

    // cycle through aes attestations and update entity with attestation info
    for (const item of data.attestations) {

      //console.info("reading attestations: ", item.id, data.attestations.length)
      if (schemaId == this.IndivSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.IndivSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          rtnAttestation = this.constructIndivAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.AIAgentSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.AIAgentSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          rtnAttestation = this.constructAIAgentAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.OrgIndivSchemaUID) {

        const schemaEncoder = new SchemaEncoder(this.OrgIndivSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct org indiv attestation")
          rtnAttestation = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.OrgSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.OrgSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          rtnAttestation = this.constructOrgAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.IndivAccountSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.IndivAccountSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct account attestation")
          rtnAttestation = this.constructIndivAccountAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.AccountOrgDelSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.AccountOrgDelSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct account org del attestation")
          rtnAttestation = this.constructAccountOrgDelAttestation(chain, item.id, item.schemaId, entityId, address, displayName, decodedData)
        }
      }
      if (schemaId == this.AccountIndivDelSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.AccountIndivDelSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct account indiv del attestation")
          rtnAttestation = this.constructAccountIndivDelAttestation(chain, item.id, item.schemaId, entityId, address, displayName, decodedData)
        }
      }
      if (schemaId == this.OrgAccountSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.OrgAccountSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct org account attestation")
          rtnAttestation = this.constructOrgAccountAttestation(chain, item.id, item.schemaId, entityId, address, displayName, decodedData)
        }
      }
      if (schemaId == this.StateRegistrationSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.StateRegistrationSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info("construct state reg attestation")
          rtnAttestation = this.constructStateRegistrationAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.RegisteredDomainSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          rtnAttestation = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.RegisteredENSSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.RegisteredENSSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          rtnAttestation = this.constructRegisteredENSAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.SocialSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.SocialSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info(">>>>>>>>>>>>>>> construct social attestation: ", entityId)
          rtnAttestation = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.WebsiteSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info(">>>>>>>>>>>>>>> construct website attestation: ", entityId)
          rtnAttestation = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.InsuranceSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info(">>>>>>>>>>>>>>> construct insurance attestation: ", entityId)
          rtnAttestation = this.constructInsuranceAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.EmailSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.EmailSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info(">>>>>>>>>>>>>>> construct email attestation: ", entityId)
          rtnAttestation = this.constructEmailAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }
      if (schemaId == this.IndivEmailSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.IndivEmailSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          console.info(">>>>>>>>>>>>>>> construct indiv email attestation: ", entityId)
          rtnAttestation = this.constructIndivEmailAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
        }
      }

      if (rtnAttestation && rtnAttestation.displayName == displayName) {
        break
      }
      else if (rtnAttestation && displayName && displayName != "") {
        console.info("@@@@@@@@@@@@@ rtnAttestation not found: ", rtnAttestation?.displayName, displayName)
        rtnAttestation = undefined
      }
    }




    return rtnAttestation;
  }

  static async getRegisteredDomainAttestations(chain: Chain, domain: string, schemaId: string, entityId: string): Promise<Attestation[] | undefined> {

    //console.info("get attestation by address and schemaId and entityId: ", address, schemaId, entityId)
    let rtnAttestation : Attestation | undefined

    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            schemaId: { equals: "${schemaId}" }
            revoked: { equals: false }
          }
        ) {
          id
          attester
          schemaId
          data
        }
      }`;

    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });
    //console.info(">>>>>>>>>>>>>>>>>>> data: ", data)

    // cycle through aes attestations and update entity with attestation info
    let rtnAttestations : Attestation[] = []
    for (const item of data.attestations) {
      if (schemaId == this.RegisteredDomainSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          const orgAddress = item.attester
          const att = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, orgAddress, "", decodedData)
          if ((att as RegisteredDomainAttestation).domain.toLowerCase() == domain.toLowerCase()) {
            rtnAttestations.push(att as RegisteredDomainAttestation)
          }
        }
      }

    }

    console.info("return attestations array b: ", rtnAttestations)
    return rtnAttestations;
}

static async getIndivsNotApprovedAttestations(chain: Chain, orgDid: string): Promise<IndivAttestation[] | undefined> {

  const entityId = "indiv(indiv)"
  const schemaId = AttestationService.IndivSchemaUID

  //console.info("get attestation by address and schemaId and entityId: ", address, schemaId, entityId)
  let rtnAttestations : IndivAttestation[] = []

  let exists = false
  const query = gql`
    query {
      attestations(
        where: {
          schemaId: { equals: "${schemaId}" }
          revoked: { equals: false }
        }
      ) {
        id
        attester
        schemaId
        data
      }
    }`;

  const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });

  // cycle through aes attestations and update entity with attestation info
  for (const item of data.attestations) {
    const schemaEncoder = new SchemaEncoder(this.IndivSchema);
    const decodedData = schemaEncoder.decodeData(item.data);
    if (this.checkEntity(entityId, decodedData)) {
      const indAtt = this.constructIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, "", decodedData)
      if (indAtt && (indAtt as IndivAttestation).orgDid.toLowerCase() == orgDid.toLowerCase()) {
        const indivDid = indAtt.attester


        const indOrgAtt = await this.getOrgIndivAttestation(chain, indivDid, this.OrgIndivSchemaUID, "org-indiv")
        if (!indOrgAtt) {
          rtnAttestations.push(indAtt as IndivAttestation)
        }
      }

    }

  }

  return rtnAttestations;
}

  static async getOrgIndivAttestation(chain: Chain, indivDid: string, schemaId: string, entityId: string): Promise<Attestation | undefined> {

    let rtnAttestation : Attestation | undefined

    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            schemaId: { equals: "${schemaId}" }
            revoked: { equals: false }
          }
        ) {
          id
          attester
          schemaId
          data
        }
      }`;

    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });


    // cycle through aes attestations and update entity with attestation info
    for (const item of data.attestations) {
      if (schemaId == this.OrgIndivSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.OrgIndivSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          const orgAddress = item.attester
          const att = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, orgAddress, "", decodedData)
          if ((att as OrgIndivAttestation).indivDid.toLowerCase() == indivDid.toLowerCase()) {
            rtnAttestation = att
            break
          }
        }
      }

    }

    return rtnAttestation;
  }



  static DefaultEntities : Entity[] = [
    {
      name: "indiv(indiv)",
      schemaId: this.IndivSchemaUID,
      schema: this.IndivSchema,
      priority: 10
    },
    {
      name: "agent(agent)",
      schemaId: this.AIAgentSchemaUID,
      schema: this.AIAgentSchema,
      priority: 10
    },
    {
      name: "account(indiv)",
      schemaId: this.IndivAccountSchemaUID,
      schema: this.IndivAccountSchema,
      priority: 10
    },
    {
      name: "account-org(org)",
      schemaId: this.AccountOrgDelSchemaUID,
      schema: this.AccountOrgDelSchema,
      priority: 10
    },
    {
      name: "account-indiv(org)",
      schemaId: this.AccountIndivDelSchemaUID,
      schema: this.AccountIndivDelSchema,
      priority: 10
    },
    {
      name: "account(org)",
      schemaId: this.OrgAccountSchemaUID,
      schema: this.OrgAccountSchema,
      priority: 10
    },
    {
      name: "org-indiv(org)",
      schemaId: this.OrgIndivSchemaUID,
      schema: this.OrgIndivSchema,
      priority: 10
    },
    {
      name: "email(indiv)",
      schemaId: this.IndivEmailSchemaUID,
      schema: this.IndivEmailSchema,
      priority: 1000
    },
    {
      name: "org(org)",
      schemaId: this.OrgSchemaUID,
      schema: this.OrgSchema,
      priority: 100,
      introduction: "What is your company name?",
      instruction: "ask user to enter their business",
      tools: [{
        type: "function",
        function: {
          name: "validateOrg",
          description: "Returns the company name.",
          parameters: {
            type: "object",
            properties: {
              orgName: {
                type: "string",
                description: "The name of the company or organization (e.g., IBM, Apple).",
              }
            },
            required: ["orgName"],
          },
        },
      }]
    },
    {
      name: "state-registration(org)",
      schemaId: this.StateRegistrationSchemaUID,
      schema: this.StateRegistrationSchema,
      priority: 101,
      introduction: "What state is [org] registered in?",
      instruction: "ask user to enter what state they formed [org] in",
      tools: [{
        type: "function",
        function: {
          name: "validateOrgStateRegistration",
          description: "Returns state",
          parameters: {
            type: "object",
            properties: {
              state: {
                type: "string",
                description: "The state is (e.g., California, Colorado).",
              },
            },
            required: ["state"],
          },
        },
      }]
    },
    {
      name: "domain(org)",
      schemaId: this.RegisteredDomainSchemaUID,
      schema: this.RegisteredDomainSchema,
      priority: 200,
      introduction: "What is the domain name for [org] so we can verify it",
      instruction: "ask user if they can enter domain for [org] for verification",
      tools: [{
        type: "function",
        function: {
          name: "validateOrgDomain",
          description: "Returns domain of the company where domain will not have https in it",
          parameters: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "The domain for the company.",
              },
            },
            required: ["domain"],
          },
        },
      }]
    },
    {
      name: "ens(org)",
      schemaId: this.RegisteredENSSchemaUID,
      schema: this.RegisteredENSSchema,
      priority: 200,
      introduction: "What is the ENS name for [org] so we can verify it",
      instruction: "ask user if they can enter ENS name for [org] for verification",
    },
    {
      name: "linkedin(indiv)",
      schemaId: this.SocialSchemaUID,
      schema: this.SocialSchema,
      priority: 1000,
      introduction: "Can we verify your linkedin (yes/no)",
      instruction: "ask user if we can verify their linkedin (yes/no)"
    },
    {
      name: "x(indiv)",
      schemaId: this.SocialSchemaUID,
      schema: this.SocialSchema,
      priority: 2000,
      introduction: "Can we verify your x formally twitter account (yes/no)",
      instruction: "ask user if we can verify their x formally twitter account (yes/no)"
    },
    {
      name: "insurance(org)",
      schemaId: this.InsuranceSchemaUID,
      schema: this.InsuranceSchema,
      priority: 3000,
      introduction: "Can we verify your organizations certificate of insurance (yes/no)",
      instruction: "ask user if we can verify their organizations certificate of insurance (yes/no)",
    },
    {
      name: "shopify(org)",
      schemaId: this.WebsiteSchemaUID,
      schema: this.WebsiteSchema,
      priority: 3000,
      introduction: "Can we verify your shopify account (yes/no)",
      instruction: "ask user if we can verify their shopify account (yes/no)"
    },

    {
      name: "website(org)",
      schemaId: this.WebsiteSchemaUID,
      schema: this.WebsiteSchema,
      priority: 3000,
      introduction: "What is your your company website url",
      instruction: "ask user if they can enter their company website url",
      tools: [{
        type: "function",
        function: {
          name: "validateOrgWebsite",
          description: "Returns website url of the company where a website will have https in it",
          parameters: {
            type: "object",
            properties: {
              website: {
                type: "string",
                description: "The website url for the company.",
              },
            },
            required: ["website(org)"],
          },
        },
      }]
    },
    {
      name: "email(org)",
      schemaId: this.EmailSchemaUID,
      schema: this.EmailSchema,
      priority: 3000,
      introduction: "What is your company contact email?",
      instruction: "ask user if they can enter their contact email",
      tools: [{
        type: "function",
        function: {
          name: "validateOrgEmail",
          description: "Returns contact email for the company",
          parameters: {
            type: "object",
            properties: {
              email: {
                type: "string",
                description: "The contact email for the company.",
              },
            },
            required: ["email"],
          },
        },
      }]
    },

  ]

  static async revokeAttestation(uid: string, orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount, delegationChain: Delegation[]): Promise<void> {
    try {
      console.info("Revoking attestation:", uid);

      // TODO: Implement actual revocation using EAS
      // This will need to be implemented using the EAS SDK
      // const revoke = await eas.revoke({
      //   uid: uid,
      // });

      // Emit event to update UI
      let event: AttestationChangeEvent = {
        action: 'revoke',
        entityId: uid
      };
      attestationsEmitter.emit('attestationChangeEvent', event);

    } catch (error) {
      console.error("Error revoking attestation:", error);
      throw error;
    }
  }
}




export const attestationsEmitter = new EventEmitter<AttestationChangeEvent>();
export default AttestationService;



