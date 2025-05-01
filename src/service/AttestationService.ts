
import {EventEmitter} from "./EventEmitter";
import FileDataService from './FileDataService';
import { ChatMessage } from '../models/ChatCompletion';
import { Entity } from '../models/Entity';
import { Attestation, AttestationCategory, IndivAttestation, IndivOrgAttestation, OrgAttestation, SocialAttestation, RegisteredDomainAttestation, WebsiteAttestation, InsuranceAttestation, EmailAttestation, StateRegistrationAttestation, IndivEmailAttestation} from '../models/Attestation';
import { Organization } from '../models/Organization';
import { ethers, formatEther, Interface } from "ethers"; // install alongside EAS
import { EAS, SchemaEncoder, SchemaDecodedItem, SchemaItem } from '@ethereum-attestation-service/eas-sdk';
import { WalletClient } from "viem";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

import { encodeNonce } from "permissionless/utils"

import { error } from "console";

import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, BUNDLER_URL, PAYMASTER_URL} from "../config";


import { optimism } from "viem/chains";

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

export interface AttestationChangeEvent {
  action: 'add' | 'edit' | 'delete' | 'delete-all',
  entityId: string,
  attestation?: Attestation, // not set on delete
}



const OPTIMISM_EAS_GRAPHQL_URL = "https://optimism.easscan.org/graphql";
  


const easApolloClient = new ApolloClient({
  uri: OPTIMISM_EAS_GRAPHQL_URL,
  cache: new InMemoryCache(),
});


const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"; 
const eas = new EAS(EAS_CONTRACT_ADDRESS);





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




  static async setEntityAttestations(orgDid: string, indivDid: string) {

    let entities = this.DefaultEntities

    const orgAddress = orgDid.replace("did:pkh:eip155:10:", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:10:", "")

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

              let att = this.constructOrgAttestation(item.id, item.schemaId, entityId, orgAddress, hash, decodedData)
              if (att != undefined) {
                entity.attestation = att
              }

            }
            else {
              const att : Attestation = {
                entityId: entity.name,
                attester: "did:pkh:eip155:10:" + item.attester,
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
  static async addRevokeAttestation(vccomm: string, proof: string, signer: ethers.JsonRpcSigner, issuerAccountClient: any): Promise<string> {

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
    let swa = await issuerAccountClient.getAddress()

    let tx = await eas.attest({
      schema: AttestationService.RevokeSchemaUID,
      data: {
        recipient: swa,
        expirationTime: 0n, // BigInt in v6
        revocable: true,
        data: encodedData
      }
    })

    let swTx = await issuerAccountClient.sendTransaction(tx.data, {
            paymasterServiceData: {
              mode: 'SPONSORED',
            },
          })

        
    let resp = await swTx.wait()

    return ""

  }
  static async getVcRevokedAttestation(orgDid: string, vccomm: string) {

    const address = orgDid.replace("did:pkh:eip155:10:", "")

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



  static async storeAttestation(schema: string, encodedData: any, delegator: any, delegate: any, delegationChain: Delegation[]) {
    
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


    console.info("pimlico client configruation for BUNDLER URL")
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
            //to: getDeleGatorEnvironment(optimism.id).DelegationManager.
            to: delegate.address,
            data,
          },
        ],
        nonce: nonce1,
        ...fee,
      });
    }
    catch (error) {
      console.info(">>>>>>>>>>>> error trying to save using delegate address: ", delegate.address)
      console.info(">>>>>>>>>>>>>> try saving with Delegation Manager")

      userOpHash = await bundlerClient.sendUserOperation({
        account: delegate,
        calls: [
          {
            to: getDeleGatorEnvironment(optimism.id).DelegationManager.
            data,
          },
        ],
        nonce: nonce1,
        ...fee,
      });
    }


    const userOperationReceipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.info("......... add attestation receipt ................: ", userOperationReceipt)

  }


  static IndivSchemaUID = "0x1212f2d47d77afd21f5fdb69e51c8d1898842b8e767417bc1681997bdf6900aa"
  static IndivSchema = this.BaseSchema + "string orgdid, string name"
  static async addIndivAttestation(attestation: IndivAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: any, indivDelegateClient: any): Promise<string> {

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
        await AttestationService.storeAttestation(this.IndivSchemaUID, encodedData, indivAccountClient, indivDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

        console.info("********************  done adding indiv attestation *********************")

    }
    


    return attestation.entityId

  }
  static constructIndivAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && orgdid != undefined && name != undefined) {
      //console.info("set to indiv attestation with name: ", name)
      const att : IndivAttestation = {
        class: "individual",
        category: "profile",
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

  static IndivOrgSchemaUID = "0x5c577b4315551f1b68e2a505e49545b447aef03befc0d0cfcb2a8bfac34dba3b"
  static IndivOrgSchema = this.BaseSchema + "string indivdid, string name, string rolecid"
  static async addIndivOrgAttestation(attestation: IndivOrgAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

    eas.connect(signer)

    const issuedate = Math.floor(new Date("2025-03-10").getTime() / 1000); // Convert to seconds
    const expiredate = Math.floor(new Date("2026-03-10").getTime() / 1000); // Convert to seconds


    if (attestation.vccomm && attestation.vcsig && attestation.vciss && attestation.proof && attestation.name && attestation.rolecid) {

      const schemaEncoder = new SchemaEncoder(this.IndivOrgSchema);
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
          { name: 'rolecid', value: attestation.rolecid, type: 'string' },

        ];

        const encodedData = schemaEncoder.encodeData(schemaItems);
        await AttestationService.storeAttestation(this.IndivOrgSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

        console.info("********************  done adding attestation *********************")

    }
    


    return attestation.entityId

  }
  static constructIndivOrgAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

    let vccomm : string | undefined
    let vcsig : string | undefined
    let vciss : string | undefined
    let proof : string | undefined
    let indivdid: string | undefined
    let name : string | undefined
    let rolecid : string | undefined


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
      if (fieldName == "rolecid") {
        rolecid = field["value"].value as string
      }
    }


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && indivdid != undefined && name != undefined && rolecid != undefined) {
      //console.info("set to indiv attestation with name: ", name)
      const att : IndivOrgAttestation = {
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
        rolecid: rolecid
      }

      return att
    }
    
    

    return undefined
  }


  static OrgSchemaUID = "0xb868c40677eb842bcb2275dbaa311232ff8d57d594c15176e4e4d6f6df9902ea"
  static OrgSchema = this.BaseSchema + "string name"
  static async addOrgAttestation(attestation: OrgAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
        await AttestationService.storeAttestation(this.OrgSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);

    }
    


    return attestation.entityId

  }
  static constructOrgAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined) {
        //console.info("set to org attestation with name: ", name)
        const att : OrgAttestation = {
          class: "organization",
          category: "profile",
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

  static SocialSchemaUID = "0xb05a2a08fd5afb49a338b27bb2e6cf1d8bd37992b23ad38a95f807d19c40782e"
  static SocialSchema = this.BaseSchema + "string name, string url"
  static async addSocialAttestation(attestation: SocialAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: any, issuerAccountClient: any): Promise<string> {

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
      await AttestationService.storeAttestation(this.SocialSchemaUID, encodedData, indivAccountClient, issuerAccountClient, delegationChain )

      console.info("done")
      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);

    }
    else {
      console.info("parms: ", attestation.vccomm, attestation.vcsig, attestation.vciss, attestation.name, attestation.url, attestation.proof)


      throw error("linkedin attestation info not complete")
    }

    return attestation.entityId
  }
  static async updateSocialAttestation(attestation: SocialAttestation, signer: ethers.JsonRpcSigner, orgAccountClient: any, walletClient: WalletClient): Promise<void> {

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
  static constructSocialAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {


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


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && name != undefined) {
      //console.info("set to social attestation with name: ", name)
      const att : SocialAttestation = {
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

  static RegisteredDomainSchemaUID = "0x6a4f62a76d14e37a9885e66fbec0f37562a371ba6eb2e9907a65849ebe4f04f8"
  static RegisteredDomainSchema = this.BaseSchema + "string domain, uint64 domaincreationdate"
  static async addRegisteredDomainAttestation(attestation: RegisteredDomainAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
        await AttestationService.storeAttestation(this.RegisteredDomainSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
      
    }

    return attestation.entityId

  }
  static constructRegisteredDomainAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
      if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && domain != undefined) {
        //console.info("set to org attestation with name: ", name)
        const att : RegisteredDomainAttestation = {
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
  static async addStateRegistrationAttestation(attestation: StateRegistrationAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
        await AttestationService.storeAttestation(this.StateRegistrationSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId

  }
  static constructStateRegistrationAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && proof != undefined && name != undefined && idnumber && status && formationdate && locationaddress) {
      //console.info("set to social attestation with name: ", name)
      const att : StateRegistrationAttestation = {
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
  static async addEmailAttestation(attestation: EmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
      await AttestationService.storeAttestation(this.EmailSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId
  }
  static constructEmailAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type && email) {
      //console.info("set to social attestation with name: ", name)
      const att : EmailAttestation = {
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
  static async addWebsiteAttestation(attestation: WebsiteAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
      await AttestationService.storeAttestation(this.WebsiteSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  

    }
    

    return attestation.entityId
  }
  static constructWebsiteAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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
      
      const attesterDid = "did:pkh:eip155:10:" + attester
      const att : WebsiteAttestation = {
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
  static async addInsuranceAttestation(attestation: InsuranceAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], orgAccountClient: any, orgDelegateClient: any): Promise<string> {

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
        await AttestationService.storeAttestation(this.InsuranceSchemaUID, encodedData, orgAccountClient, orgDelegateClient, delegationChain)
  
        let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
        attestationsEmitter.emit('attestationChangeEvent', event);
      
    }

    return attestation.entityId
  }
  static constructInsuranceAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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

    const attesterDid = "did:pkh:eip155:10:" + attester
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
  static async addIndivEmailAttestation(attestation: IndivEmailAttestation, signer: ethers.JsonRpcSigner, delegationChain: Delegation[], indivAccountClient: any, issuerAccountClient: any): Promise<string> {

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
      await AttestationService.storeAttestation(this.IndivEmailSchemaUID, encodedData, indivAccountClient, issuerAccountClient, delegationChain)

      let event: AttestationChangeEvent = {action: 'add', entityId: attestation.entityId, attestation: attestation};
      attestationsEmitter.emit('attestationChangeEvent', event);
  
      
    }

    return attestation.entityId
  }
  static constructIndivEmailAttestation(uid: string, schemaId: string, entityId : string, attester: string, hash: string, decodedData: SchemaDecodedItem[]) : Attestation | undefined {

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


    const attesterDid = "did:pkh:eip155:10:" + attester
    if (uid != undefined && schemaId != undefined && entityId != undefined && hash != undefined && type && email) {
      //console.info("set to social attestation with name: ", name)
      const att : EmailAttestation = {
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

  static async deleteIssuerAttestation(uid: string, schemaId: string, signer: ethers.JsonRpcSigner, issuerAccountClient: any): Promise<void> {

    eas.connect(signer)

    if (issuerAccountClient) {

      //let att = atts[0]
      let txs : Transaction[] = []

      const tx = await eas.revoke({ schema: schemaId, data: { uid: uid }})
      txs.push(tx.data)

      console.info("send transactions: ", schemaId, uid)
      const delTx = await issuerAccountClient.sendTransaction(txs, {
        paymasterServiceData: {
          mode: 'SPONSORED',
        }, 
      })
      const delResp = await delTx.wait()
      console.info("delete done: ", delResp)

    }
      

  }

  static async deleteAttestations(atts: Attestation[], signer: ethers.JsonRpcSigner, delegationChain: Delegation[], delegateClient: any): Promise<void> {

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
                    chain: optimism,
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
          //to: getDeleGatorEnvironment(optimism.id).DelegationManager.
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
        name: "leaders",
        id: "0"
      },
      {
        class: "organization",
        name: "profile",
        id: "1"
      },
      {
        class: "organization",
        name: "social",
        id: "2"
      },
      {
        class: "organization",
        name: "domain",
        id: "3"
      },
      {
        class: "organization",
        name: "registration",
        id: "4"
      },
      {
        class: "organization",
        name: "certificate",
        id: "5"
      },
      {
        class: "individual",
        name: "profile",
        id: "6"
      },
      {
        class: "individual",
        name: "social",
        id: "7"
      },
    ]

    return attestationCategories
  }

  static async loadRecentAttestationsTitleOnly(orgDid: string, indivDid: string): Promise<Attestation[]> {

    const orgAddress = orgDid.replace("did:pkh:eip155:10:", "")
    const indivAddress = indivDid.replace("did:pkh:eip155:10:", "")

    try {

      console.info("load attestations for: ", indivAddress)
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
              att = this.constructIndivAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "indiv-org") {
              att = this.constructIndivOrgAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "org") {
              att = this.constructOrgAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "linkedin") {
              att = this.constructSocialAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "x") {
              att = this.constructSocialAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "shopify") {
              att = this.constructWebsiteAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "insurance") {
              att = this.constructInsuranceAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "state-registration") {
              att = this.constructStateRegistrationAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "domain") {
              att = this.constructRegisteredDomainAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "website") {
              att = this.constructWebsiteAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "email") {
              att = this.constructEmailAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }
            if (entityId == "indiv-email") {
              att = this.constructIndivEmailAttestation(item.id, item.schemaId, entityId, item.attester, hash, decodedData)
            }


            if (att == undefined) {
              att = {
                uid: item.id,
                attester: "did:pkh:eip155:10:" + item.attester,
                schemaId: item.schemaId,
                entityId: entityId,
                url: "https://www.richcanvas3.com",
                hash: hash,
              }
            }
            else {
              att.uid = item.id,
              att.attester = "did:pkh:eip155:10:" + item.attester,
              att.schemaId = item.schemaId,
              entityId = entityId
            }

            attestations.push(att)
          }
      
      }
      console.info("return attestations: ", attestations)
      return attestations;
      
    } catch (error) {
      console.error("Error loading recent attestations:", error);
      throw error;
    }
  }

  
  static async loadOrganizations(): Promise<Organization[]> {
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

      //console.info(".... query: ", query)
      //console.info("..... execute query .......")
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

          orgDid = "did:pkh:eip155:10:" + item.attester

          

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

          if (item.schemaId == this.OrgSchemaUID) {

          }

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
  
  static async getAttestationByAddressAndSchemaId(did: string, schemaId: string, entityId: string): Promise<Attestation | undefined> {

    //console.info("get attestation by address and schemaId and entityId: ", address, schemaId, entityId)
    let rtnAttestation : Attestation | undefined

    const address = did.replace("did:pkh:eip155:10:", "")


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
            console.info("construct indiv attestation")
            rtnAttestation = this.constructIndivAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.IndivOrgSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.IndivSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct indiv org attestation")
            rtnAttestation = this.constructIndivOrgAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.OrgSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.OrgSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct org attestation")
            rtnAttestation = this.constructOrgAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
          
        }
        if (schemaId == this.StateRegistrationSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.StateRegistrationSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct state reg attestation")
            rtnAttestation = this.constructStateRegistrationAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.RegisteredDomainSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info("construct domain attestation")
            rtnAttestation = this.constructRegisteredDomainAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.SocialSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.SocialSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info(">>>>>>>>>>>>>>> construct social attestation: ", entityId)
            rtnAttestation = this.constructSocialAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.WebsiteSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info(">>>>>>>>>>>>>>> construct website attestation: ", entityId)
            rtnAttestation = this.constructWebsiteAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.InsuranceSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.WebsiteSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info(">>>>>>>>>>>>>>> construct insurance attestation: ", entityId)
            rtnAttestation = this.constructInsuranceAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.EmailSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.EmailSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info(">>>>>>>>>>>>>>> construct email attestation: ", entityId)
            rtnAttestation = this.constructEmailAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
        if (schemaId == this.IndivEmailSchemaUID) {
          const schemaEncoder = new SchemaEncoder(this.IndivEmailSchema);
          const decodedData = schemaEncoder.decodeData(item.data);
          if (this.checkEntity(entityId, decodedData)) {
            console.info(">>>>>>>>>>>>>>> construct indiv email attestation: ", entityId)
            rtnAttestation = this.constructIndivEmailAttestation(item.id, item.schemaId, entityId, address, "", decodedData)
          }
        }
      }


      

    return rtnAttestation;
  }

  static async getRegisteredDomainAttestation(domain: string, schemaId: string, entityId: string): Promise<Attestation | undefined> {

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
    for (const item of data.attestations) {
      if (schemaId == this.RegisteredDomainSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.RegisteredDomainSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          const orgAddress = item.attester
          const att = this.constructRegisteredDomainAttestation(item.id, item.schemaId, entityId, orgAddress, "", decodedData)
          if ((att as RegisteredDomainAttestation).domain.toLowerCase() == domain.toLowerCase()) {
            rtnAttestation = att
            break
          }
        }
      }
      
    }

    return rtnAttestation;
}
  
static async getIndivsNotApprovedAttestations(orgDid: string): Promise<IndivAttestation[] | undefined> {

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
      const indAtt = this.constructIndivAttestation(item.id, item.schemaId, entityId, item.attester, "", decodedData)
      if (indAtt && (indAtt as IndivAttestation).orgDid.toLowerCase() == orgDid.toLowerCase()) {
        const indivDid = indAtt.attester
        const indOrgAtt = await this.getIndivOrgAttestation(indivDid, this.IndivOrgSchemaUID, "indiv-org")
        if (!indOrgAtt) {
          rtnAttestations.push(indAtt as IndivAttestation)
        }
      }
      
    }
    
  }

  return rtnAttestations;
}

  static async getIndivOrgAttestation(indivDid: string, schemaId: string, entityId: string): Promise<Attestation | undefined> {

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
    for (const item of data.attestations) {
      if (schemaId == this.IndivOrgSchemaUID) {
        const schemaEncoder = new SchemaEncoder(this.IndivOrgSchema);
        const decodedData = schemaEncoder.decodeData(item.data);
        if (this.checkEntity(entityId, decodedData)) {
          const orgAddress = item.attester
          const att = this.constructIndivOrgAttestation(item.id, item.schemaId, entityId, orgAddress, "", decodedData)
          if ((att as IndivOrgAttestation).indivDid.toLowerCase() == indivDid.toLowerCase()) {
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
      name: "indiv",
      schemaId: this.IndivSchemaUID,
      schema: this.IndivSchema,
      priority: 10
    },
    {
      name: "indiv-org",
      schemaId: this.IndivOrgSchemaUID,
      schema: this.IndivOrgSchema,
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

