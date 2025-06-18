import {EventEmitter} from "./EventEmitter";
import FileDataService from './FileDataService';
import { ChatMessage } from '../models/ChatCompletion';
import { Entity } from '../models/Entity';

import { Attestation, 
  AttestationCategory, 
  IndivAttestation, 
  OrgIndivAttestation, 
  OrgAttestation, 
  AccountAttestation, 
  OrgAccountAttestation,
  SocialAttestation, 
  RegisteredDomainAttestation, 
  WebsiteAttestation, 
  InsuranceAttestation, 
  EmailAttestation, 
  StateRegistrationAttestation, 
  IndivEmailAttestation} 
  from '../models/Attestation';

import { Organization } from '../models/Organization';
import { ethers, formatEther, Interface, ZeroAddress } from "ethers"; // install alongside EAS
import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem } from '@ethereum-attestation-service/eas-sdk';
import { WalletClient } from "viem";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

import { encodeNonce } from "permissionless/utils"

import { error } from "console";

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




  static async setEntityAttestations(chain: Chain, orgDid: string, indivDid: string) {

    let entities = this.DefaultEntities

    const orgAddress = orgDid.replace("did:pkh:eip155:" + chain?.id + ":", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:" + chain?.id + ":", "")


    let exists = false
    const query = gql`
      query {
        attestations(
          where: {
            attester: { in: ["${orgAddress}", "${indivAddress}"] }
            revoked: { equals: false }
          }
        ) {
          id
          schemaId
          data
        }
      }`;


    const { data } = await easApolloClient.query({ query: query, fetchPolicy: "no-cache", });
    //console.info("returned attestations: ", data.attestations.length)

    // cycle through aes attestations and update entity with attestation info
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


          // construct correct attestation
          if (entity != undefined) {
            //console.info("...... found entity: ", entity.name)
            if (entity.name == "org") {
              let att = this.constructOrgAttestation(chain, item.id, item.schemaId, entityId, orgAddress, hash, decodedData)
              if (att != undefined) {
                entity.attestation = att
              }

            }
            else {
              const att : Attestation = {
                entityId: entity.name,
                attester: "did:pkh:eip155:" + chain?.id + ":" + item.attester,
                uid: item.id,
                schemaId: item.schemaId,
                hash: "",
              }
              entity.attestation = att
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

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds

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


  static BaseSchema = "string entityid, bytes32 hash, uint64 issuedate, uint64 expiredate, string vccomm, string vcsig, string vciss, string proof, "



  static async storeAttestation(chain: Chain, schema: string, encodedData: any, delegator: MetaMaskSmartAccount, delegate: MetaMaskSmartAccount, delegationChain: Delegation[]) {
    
    const key1 = BigInt(Date.now())      // or some secure random
    const nonce1 = encodeNonce({ key: key1, sequence: 0n })

    let tx = await eas.attest({
      schema: schema,
      data: {
        recipient: delegator.address,
        expirationTime: 0n, // BigInt in v6
        revocable: true,
        data: encodedData
      }
    })

    
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

    const data = DelegationFramework.encode.redeemDelegations({
      delegations: [ delegationChain ],
      modes: [SINGLE_DEFAULT_MODE],
      executions: [executions]
    });

    
    const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
    let userOpHash: Hex;

    try {
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
    }
    catch (error) {
      console.info(">>>>>>>>>>>> error trying to save using delegate address: ", delegate.address)
      console.info(">>>>>>>>>>>>>> try saving with Delegation Manager")
      console.error("......... error: ", error)
    }


    const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.info("......... add attestation receipt ................: ", userOperationReceipt)

  }


  static IndivSchemaUID = "0x1212f2d47d77afd21f5fdb69e51c8d1898842b8e767417bc1681997bdf6900aa"
  static IndivSchema = this.BaseSchema + "string orgdid, string name"
  static async addIndivAttestation(chain: Chain, attestation: IndivAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, indivDelegateClient: MetaMaskSmartAccount): Promise<string> {

    console.info("....... add indiv attestation signer: ", signer)
    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    console.info("create attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.IndivSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'orgdid', value: attestation.orgDid, type: 'string' },
          { name: 'name', value: attestation.name, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.IndivSchemaUID, encodedData, indivAccountClient, indivDelegateClient, delegationChain)

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
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && orgdid != undefined && name != undefined) {
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
        proof: proof,
        orgDid: orgdid,
        name: name
      }

      return att
    }
    
    

    return undefined
  }

  //static OrgIndivSchemaUID = "0x637acc7b7b5b2868ba2a63c89396ac89b15b514ffe6c0ace6a47bb6d3f069871"
  static OrgIndivSchemaUID = "0x98cdf7e4974fd1fcb341a97759fb86047b467edd20640c1217e8175be0cb588f"
  static OrgIndivSchema = this.BaseSchema + "string indivdid, string name, string delegation"
  static async addOrgIndivAttestation(chain: Chain, attestation: OrgIndivAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name && attestation.delegation) {

      const schemaEncoder = new SchemaEncoder(this.OrgIndivSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'indivdid', value: attestation.indivDid, type: 'string' },
          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'delegation', value: attestation.delegation, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.OrgIndivSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

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
        category: "leaders",
        entityId: entityId,
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
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


  static OrgSchemaUID = "0xb868c40677eb842bcb2275dbaa311232ff8d57d594c15176e4e4d6f6df9902ea"
  static OrgSchema = this.BaseSchema + "string name"
  static async addOrgAttestation(chain: Chain, attestation: OrgAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    console.info("....... add org attestation signer: ", signer)
    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    //console.info("attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.OrgSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.OrgSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }
    


    return attestation.entityId

  }
  static constructOrgAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
          proof: proof,
          name: name
        }
  
        return att
      }
    
    

    return undefined
  }


  static AccountSchemaUID = "0xe837d6e7eb9595a57b901e3893132f892f8c62e6ba5502db753d9486c0f09462"
  static AccountSchema = this.BaseSchema + "string name, string coacode, string coacategory"
  static async addAccountAttestation(chain: Chain, attestation: AccountAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    console.info("....... add account attestation signer: ", signer)
    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    //console.info("attestation: ", attestation)

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.AccountSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'coacode', value: attestation.coaCode, type: 'string' },
          { name: 'coacategory', value: attestation.coaCategory, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.AccountSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }
    


    return attestation.entityId

  }
  static constructAccountAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let proof : string | undefined
    let name : string | undefined
    let coacode : string | undefined
    let coacategory : string | undefined

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
      if (fieldName == "proof") {
        proof = fieldValue
      }
      if (fieldName == "name") {
        name = fieldValue
      }
      if (fieldName == "coacode") {
        coacode = fieldValue
      }
      if (fieldName == "coacategory") {
        coacategory = fieldValue
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined && coacode != undefined && coacategory != undefined) {
        const att : AccountAttestation = {
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
          proof: proof,
          name: name,
          coaCode: coacode,
          coaCategory: coacategory
        }
  
        return att
      } else {
      }
    
    

    return undefined
  }

  static OrgAccountSchemaUID = "0xb63a03f537c5de8aff948d21a50f96f8831c6876733fe68d319a8432bbff10b6"
  static OrgAccountSchema = this.BaseSchema + "string accountdid, string name, string delegation"
  static async addOrgAccountAttestation(chain: Chain, attestation: OrgAccountAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name) {

      const schemaEncoder = new SchemaEncoder(this.OrgAccountSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'accountdid', value: attestation.accountDid, type: 'string' },
          { name: 'name', value: attestation.name, type: 'string' }, 
          { name: 'delegation', value: attestation.delegation, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain,this.OrgAccountSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }
    


    return attestation.entityId

  }
  static constructOrgAccountAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let proof : string | undefined
    let name : string | undefined
    let accountDid : string | undefined
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
      if (fieldName == "proof") {
        proof = field["value"].value as string
      }
      if (fieldName == "name") {
        name = field["value"].value as string
      }
      if (fieldName == "accountdid") {
        accountDid = field["value"].value as string
      }
      if (fieldName == "delegation") {
        delegation = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined && accountDid != undefined && delegation != undefined) {
        //console.info("set to org account attestation with name: ", name)
        const att : OrgAccountAttestation = {
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
          proof: proof,
          name: name,
          accountDid: accountDid,
          delegation: delegation
        }
  
        return att
      }
    
    

    return undefined
  }



  static SocialSchemaUID = "0xb05a2a08fd5afb49a338b27bb2e6cf1d8bd37992b23ad38a95f807d19c40782e"
  static SocialSchema = this.BaseSchema + "string name, string url"
  static async addSocialAttestation(chain: Chain, attestation: SocialAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, burnerAccountClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    
    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.name != undefined && attestation.url != undefined && attestation.proof != undefined) {

      const schemaEncoder = new SchemaEncoder(this.SocialSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },
          
          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'url', value: attestation.url, type: 'string' },
        ];

      const encodedData = schemaEncoder.encodeData(schemaItems);

      console.info("store attestation")
      await AttestationService.storeAttestation(chain, this.SocialSchemaUID, encodedData, indivAccountClient, burnerAccountClient, delegationChain )

      console.info("done")
      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);

    }
    else {
      console.info("parms: ", attestation.vccomm, attestation.vcsig, attestation.vciss, attestation.name, attestation.url, attestation.proof)


      throw error("social attestation info not complete")
    }

    return attestation.entityId
  }
  static async updateSocialAttestation(attestation: SocialAttestation, signer: ethers.JsonRpcSigner, orgAccountClient: MetaMaskSmartAccount, walletClient: WalletClient): Promise<void> {

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

    let result2 = await this.addSocialAttestation(attestation, signer, orgAccountClient)
  }
  static constructSocialAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {


    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
      const att : SocialAttestation = {
        displayName: name,
        entityId: entityId,
        class: "individual",
        category: "social",
        attester: attester,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        proof: proof,
        name: name,
        url: url
      }

      return att
    }
    

    return undefined
  }

  static RegisteredDomainSchemaUID = "0x46cef8b693d083d23a62f6ae9c58f88cbb8380ed3000d6f5a1af20c084dc82c9"
  static RegisteredDomainSchema = this.BaseSchema + "string domain, uint64 domaincreationdate"
  static async addRegisteredDomainAttestation(chain: Chain, attestation: RegisteredDomainAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vcsig && attestation.vciss && attestation.proof && attestation.domain && attestation.domaincreationdate) {

      const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
      const schemaItems : SchemaItem[] = [

          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },
  
          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },
          
          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'domain', value: attestation.domain, type: 'string' },
          { name: 'domaincreationdate', value: attestation.domaincreationdate, type: 'uint64' },
          
        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.RegisteredDomainSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
      
    }

    return attestation.entityId

  }
  static constructRegisteredDomainAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
          category: "domain",
          attester: attesterDid,
          schemaId: schemaId,
          uid: uid,
          hash: hash,
          vccomm: vccomm,
          vcsig: vcsig,
          vciss: vciss,
          proof: proof,
          domain: domain
        }
  
        return att
      }
    


    return undefined
  }

  static StateRegistrationSchemaUID = "0xbf0c8858b40faa691436c577b53a6cc4789a175268d230b7ea0c572b0f46c62b"
  static StateRegistrationSchema = this.BaseSchema + "string name, string idnumber, string status, uint64 formationdate, string locationaddress" 
  static async addStateRegistrationAttestation(chain: Chain, attestation: StateRegistrationAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name) {

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

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'name', value: attestation.name, type: 'string' },
          { name: 'idnumber', value: attestation.idnumber, type: 'string' },
          { name: 'status', value: attestation.status, type: 'string' },
          { name: 'formationdate', value: issuedate, type: 'uint64' },
          { name: 'locationaddress', value: attestation.locationaddress, type: 'string' },
        ];
      
      
        const encodedData = schemaEncoder.encodeData(schemaItems);

        console.info("store state registration ... attestation")
        await AttestationService.storeAttestation(chain, this.StateRegistrationSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId

  }
  static constructStateRegistrationAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
        category: "registration",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
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


  static EmailSchemaUID = "0x34c055dd7ac09404aa617dab38193f9fe80ab7f1abafb03cb7e38bee1589e2d0"
  static EmailSchema = this.BaseSchema + "string type, string email" 
  static async addEmailAttestation(chain: Chain, attestation: EmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof) {

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

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'email', value: attestation.email, type: 'string' },
          
        ];


      
      const encodedData = schemaEncoder.encodeData(schemaItems);
      await AttestationService.storeAttestation(chain, this.EmailSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId
  }
  static constructEmailAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
        category: "profile",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
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

  static WebsiteSchemaUID = "0x5c209bedd0113303dbdd2cda8e8f9aaca673a567cd6a031cbb8cdaecbe01642b"
  static WebsiteSchema = this.BaseSchema + "string type, string url" 
  static async addWebsiteAttestation(chain: Chain, attestation: WebsiteAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.type && attestation.url) {
      const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'url', value: attestation.url, type: 'string' },
        ];
            
      const encodedData = schemaEncoder.encodeData(schemaItems);
      await AttestationService.storeAttestation(chain, this.WebsiteSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  

    }
    

    return attestation.entityId
  }
  static constructWebsiteAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && vccomm != undefined && vcsig != undefined && vciss != undefined  && url != undefined && type != undefined) {
      
      const attesterDid = "did:pkh:eip155:" + chain?.id + ":" + attester
      const att : WebsiteAttestation = {
        displayName: url,
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        class: "organization",
        category: "profile",
        attester: attesterDid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        proof: proof,
        type: type,
        url: url,
      }

      return att
    }

    return undefined
  }



  static InsuranceSchemaUID = "0xcfca6622a02b4b1d7f49fc4edf63eff73b062b86c25b221e713ee8eea7d37b6f"
  static InsuranceSchema = this.BaseSchema + "string type, string policy" 
  static async addInsuranceAttestation(chain: Chain, attestation: InsuranceAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: MetaMaskSmartAccount, orgDelegateClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof) {

      const schemaEncoder = new SchemaEncoder(this.InsuranceSchema);
      const schemaItems : SchemaItem[] = [
          { name: 'entityid', value: attestation.entityId, type: 'string' },
          { name: 'hash', value: attestation.hash, type: 'bytes32' },
          { name: 'issuedate', value: issuedate, type: 'uint64' },
          { name: 'expiredate', value: expiredate, type: 'uint64' },

          { name: 'vccomm', value: attestation.vccomm, type: 'string' },
          { name: 'vcsig', value: attestation.vcsig, type: 'string' },
          { name: 'vciss', value: attestation.vciss, type: 'string' },

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'type', value: attestation.type, type: 'string' },
          { name: 'policy', value: attestation.policy, type: 'string' },
        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(chain, this.InsuranceSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
      
    }

    return attestation.entityId
  }
  static constructInsuranceAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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


    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && vccomm != undefined && vcsig != undefined && vciss != undefined  && policy != undefined && type != undefined) {
      const att : InsuranceAttestation = {
        displayName: entityId,
        uid: uid,
        schemaId: schemaId,
        entityId: entityId,
        class: "organization",
        category: "certificate",
        attester: attesterDid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
        proof: proof,
        type: type,
        policy: policy,
      }

      return att
    }

    return undefined
  }



  static IndivEmailSchemaUID = "0x0679112c62bedf14255c9b20b07486233f25e98505e1a8adb270e20c17893baf"
  static IndivEmailSchema = this.BaseSchema + "string class, string email" 
  static async addIndivEmailAttestation(chain: Chain, attestation: IndivEmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: MetaMaskSmartAccount, burnerAccountClient: MetaMaskSmartAccount): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds

    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof) {

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

          { name: 'proof', value: attestation.proof, type: 'string' },

          { name: 'class', value: attestation.type, type: 'string' },
          { name: 'email', value: attestation.email, type: 'string' },
          
        ];


      
      const encodedData = schemaEncoder.encodeData(schemaItems);
      await AttestationService.storeAttestation(chain, this.IndivEmailSchemaUID, encodedData, indivAccountClient, burnerAccountClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId
  }
  static constructIndivEmailAttestation(chain: Chain, uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
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
        category: "profile",
        attester: attesterDid,
        schemaId: schemaId,
        uid: uid,
        hash: hash,
        vccomm: vccomm,
        vcsig: vcsig,
        vciss: vciss,
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
      let txs : Transaction[] = []

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
        console.info("get tx")
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

        calls.push(call)
      }
    }


    console.info("sendUserOperation ........")
    userOpHash = await bundlerClient.sendUserOperation({
      account: delegateClient,
      calls: calls,
      ...fee,
    });


    const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.info("delete result: ", userOperationReceipt)

    console.info("delete successful")


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
        id: "10"
      },
      {
        class: "organization",
        name: "leaders",
        id: "20"
      },
      {
        class: "organization",
        name: "profile",
        id: "30"
      },
      {
        class: "organization",
        name: "social",
        id: "40"
      },
      {
        class: "organization",
        name: "domain",
        id: "50"
      },
      {
        class: "organization",
        name: "registration",
        id: "60"
      },
      {
        class: "organization",
        name: "certificate",
        id: "70"
      },
      {
        class: "individual",
        name: "wallet",
        id: "80"
      },
      {
        class: "individual",
        name: "profile",
        id: "90"
      },
      {
        class: "individual",
        name: "social",
        id: "100"
      },
    ]

    return attestationCategories
  }

  static async loadRecentAttestationsTitleOnly(chain: Chain, orgDid: string, indivDid: string): Promise<Attestation[]> {

    const orgAddress = orgDid.replace("did:pkh:eip155:" + chain?.id + ":", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:"  + chain?.id + ":", "")

    try {

      //console.info("load attestations for: ", indivAddress)
      let exists = false
      const query = gql`
        query {
          attestations(
            where: {
              attester: { in: ["${orgAddress}", "${indivAddress}"] }
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

      console.info("................... data: ", data)

      const attestations : Attestation[] = []
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

            //console.info("item: ", item)

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

            //console.info("attestation: ", entityId)

            // construct correct attestation
            let att : Attestation | undefined
            if (entityId == "indiv") {
              att = this.constructIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "account") {
              att = this.constructAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org-account") {
              att = this.constructOrgAccountAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org") {
              att = this.constructOrgAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org-indiv") {
              att = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "linkedin") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "x") {
              att = this.constructSocialAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "shopify") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "insurance") {
              att = this.constructInsuranceAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "state-registration") {
              att = this.constructStateRegistrationAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "domain") {
              att = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "website") {
              att = this.constructWebsiteAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email") {
              att = this.constructEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "indiv-email") {
              att = this.constructIndivEmailAttestation(chain, item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }


            if (att == undefined) {
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
              att.uid = item.id,
              att.attester = "did:pkh:eip155:" + chain?.id + ":" + item.attester,
              att.schemaId = item.schemaId,
              entityId = entityId
            }

            //console.info("push att on list: ", att)
            attestations.push(att)
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
  
  static async getAttestationByDidAndSchemaId(chain: Chain, did: string, schemaId: string, entityId: string): Promise<Attestation | undefined> {

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
        if (schemaId == this.OrgIndivSchemaUID) {
          console.info(">>>>>>>>>>> CONSTRUCT INDIV ORG ATTESTATION")
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
        if (schemaId == this.AccountSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.AccountSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct account attestation")
            rtnAttestation = this.constructAccountAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.OrgAccountSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.OrgAccountSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct org account attestation")
            rtnAttestation = this.constructOrgAccountAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
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
            console.info("construct domain attestation")
            rtnAttestation = this.constructRegisteredDomainAttestation(chain, item.id, item.schemaId, entityId, address, "", decodedData)
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

  const entityId = "indiv"
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

        console.info("********** getOrgIndivAttestation 15: ", indivDid)
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
    console.info(">>>>>>>>>>>>>>>>>>> data: ", data)
    console.info(">>>>>>>>>>>>>>>>>>> entityId: ", entityId)
    console.info(">>>>>>>>>>>>>>>>>>> indivDid: ", indivDid)

    // cycle through aes attestations and update entity with attestation info
    for (const item of data.attestations) {
      if (schemaId == this.OrgIndivSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.OrgIndivSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          const orgAddress = item.attester
          const att = this.constructOrgIndivAttestation(chain, item.id, item.schemaId, entityId, orgAddress, "", decodedData)
          console.info("********** att: ", att)
          if ((att as OrgIndivAttestation).indivDid.toLowerCase() == indivDid.toLowerCase()) {
            rtnAttestation = att
            break
          }
        }
      }
      
    }

    console.info("********** OrgIndivSchema rtnAttestation: ", rtnAttestation)
    return rtnAttestation;
  }



  static DefaultEntities : Entity[] = [
    {
      name: "indiv",
      schemaId: this.IndivSchemaUID,
      schema: this.IndivSchema,
      priority: 10
    },
    {
      name: "account",
      schemaId: this.AccountSchemaUID,
      schema: this.AccountSchema,
      priority: 10
    },
    {
      name: "org-account",
      schemaId: this.OrgAccountSchemaUID,
      schema: this.OrgAccountSchema,
      priority: 10
    },
    {
      name: "org-indiv",
      schemaId: this.OrgIndivSchemaUID,
      schema: this.OrgIndivSchema,
      priority: 10
    },
    {
      name: "indiv-email",
      schemaId: this.IndivEmailSchemaUID,
      schema: this.IndivEmailSchema,
      priority: 1000
    },
    {
      name: "org",
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
      name: "state-registration",
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
      name: "domain",
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
      name: "linkedin",
      schemaId: this.SocialSchemaUID,
      schema: this.SocialSchema,
      priority: 1000,
      introduction: "Can we verify your linkedin (yes/no)",
      instruction: "ask user if we can verify their linkedin (yes/no)"
    },
    {
      name: "x",
      schemaId: this.SocialSchemaUID,
      schema: this.SocialSchema,
      priority: 2000,
      introduction: "Can we verify your x formally twitter account (yes/no)",
      instruction: "ask user if we can verify their x formally twitter account (yes/no)"
    },
    {
      name: "insurance",
      schemaId: this.InsuranceSchemaUID,
      schema: this.InsuranceSchema,
      priority: 3000,
      introduction: "Can we verify your organizations certificate of insurance (yes/no)",
      instruction: "ask user if we can verify their organizations certificate of insurance (yes/no)",
    },
    {
      name: "shopify",
      schemaId: this.WebsiteSchemaUID,
      schema: this.WebsiteSchema,
      priority: 3000,
      introduction: "Can we verify your shopify account (yes/no)",
      instruction: "ask user if we can verify their shopify account (yes/no)"
    },
    
    {
      name: "website",
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
            required: ["website"],
          },
        },
      }]
    },
    {
      name: "email",
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




    /*
    const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"; // Sepolia v0.26 address
    const eas = new EAS(EAS_CONTRACT_ADDRESS);
    const provider = new ethers.JsonRpcProvider("https://mainnet.optimism.io");
    eas.connect(provider);

    const uid = "0x6547a0a10b5ab3c7bb7a40e08178a3cc7ae0be5b6d54cfcbc5de60468acc1758"
    
    try {
        const attestation = await eas.getAttestation(uid); // This function returns an attestation object


        console.info("...........EAS attestation")
        console.info(attestation);

        console.log('Attestation Details:');
        console.log('UID:', attestation.uid);
        console.log('Recipient:', attestation.recipient);
        console.log('Attester:', attestation.attester);
        console.log('Time:', attestation.time);
        console.log('Expiration Time:', attestation.expirationTime);
        console.log('Revocation Time:', attestation.revocationTime);
        console.log('Data:', attestation.data);

        const schemaUID = attestation.schema;
        //console.log('Schema UID:', schemaUID);

        const schemaString = 'string statement';
        const schemaEncoder = new SchemaEncoder(schemaString);
        const decodedData = schemaEncoder.decodeData(attestation.data);
        //console.info("....... decoded data: ", decodedData)


    } catch (error) {
        console.error("Error fetching attestation:", error);
    }
    */

