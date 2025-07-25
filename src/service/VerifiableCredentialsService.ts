import { VerifiableCredential } from "../models/VerifiableCredential"
import { WalletClient, verifyMessage, hexToBytes, bytesToHex } from "viem";
import { ethers, hashMessage } from 'ethers'
import { recoverPublicKey } from "@ethersproject/signing-key";
import { privateKeyToAccount, PrivateKeyAccount, generatePrivateKey } from "viem/accounts";

import { vs } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Buffer } from 'buffer';

import { Resolver } from 'did-resolver';
import { createAgent,  } from '@veramo/core';
import type {
  W3CVerifiableCredential,
} from '@veramo/core';

import { CredentialPlugin } from '@veramo/credential-w3c';

import { KeyManagementSystem } from '@veramo/kms-local';
import { getResolver as ethrDidResolver } from 'ethr-did-resolver';

import { CredentialStatusPlugin } from '@veramo/credential-status';
import { DIDResolverPlugin } from '@veramo/did-resolver';


// @ts-ignore
window.Buffer = Buffer;

class VerifiableCredentialsService {

    static credentials : VerifiableCredential[] | undefined
    //static snapId : string = "local:http://localhost:8080"

    static async createWebsiteOwnershipVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      websiteType: string,
      websiteUrl: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "WebsiteOwnershipCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          type: websiteType,
          url: websiteUrl,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createInsuranceVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      insuranceId: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "InsuranceCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          insuranceId: insuranceId,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createSocialVC(
      entityId: string,
      did: string,
      issuerDid: string,
      socialId: string,
      socialUrl: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "SocialCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: did,
          socialId: socialId,
          socialUrl: socialUrl,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createRegisteredDomainVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      domainname: string,
      domaincreationdate: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "RegisteredDomainCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          domainName: domainname,
          createdOn: domaincreationdate,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createIndivVC(
      entityId: string,
      indivDid: string,
      issuerDid: string,
      orgDid: string,
      indivName: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: indivDid,
          org: orgDid,
          name: indivName,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createOrgVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      orgName: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          name: orgName,
          verifiedMethod: "OAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createAccountVC(
      entityId: string,
      issuerDid: string,
      accountDid: string,
      indivDid: string,
      accountName: string,
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: accountDid,
          indivDid: indivDid,
          accountName: accountName,
          accountDid: accountDid,
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createAccountOrgDelVC(
      entityId: string,
      issuerDid: string,
      accountDid: string,
      orgDid: string,
      accountName: string,
      coaCode: string,
      coaCategory: string,
      delegation: string,
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          accountDid: accountDid,
          orgDid: orgDid,
          accountName: accountName,
          coaCode: coaCode,
          coaCategory: coaCategory,
          delegation: delegation,
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }


    static async createAccountIndivDelVC(
      entityId: string,
      issuerDid: string,
      accountDid: string,
      indivDid: string,
      accountName: string,
      coaCode: string,
      coaCategory: string,
      orgDelegation: string,
      indivDelegation: string,
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          accountDid: accountDid,
          indivDid: indivDid,
          accountName: accountName,
          coaCode: coaCode,
          coaCategory: coaCategory,
          orgDelegation: orgDelegation,
          indivDelegation: indivDelegation,
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    

    static async createOrgAccountVC(
      entityId: string,
      issuerDid: string,
      accountDid: string,
      orgDid: string,
      accountName: string,
      coaCode: string,
      coaCategory: string,
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          accountDid: accountDid,
          orgDid: orgDid,
          accountName: accountName,
          coaCode: coaCode,
          coaCategory: coaCategory,
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createStateRegistrationVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      idNumber: string,
      orgName: string, 
      status: string, 
      formationDate: string, 
      state: string, 
      locationAddress: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "OrgStateRegistrationCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          name: orgName,
          status: status,
          formationDate: formationDate,
          state: state,
          locationAddress: locationAddress,
          verifiedMethod: "State",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async createEmailVC(
      entityId: string,
      orgDid: string,
      issuerDid: string,
      emailType: string,
      email: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "EmailCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: orgDid,
          type: emailType,
          email: email,
          verifiedMethod: "oAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    
    static async createIndivEmailVC(
      entityId: string,
      indivDid: string,
      issuerDid: string,
      emailType: string,
      email: string
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "EmailCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: indivDid,
          type: emailType,
          email: email,
          verifiedMethod: "oAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }


    
    static async createOrgIndivVC(
      entityId: string,
      orgDid: string,
      indivDid: string,
      indName: string,
      delegation: string,
      issuerDid: string,
    ): Promise<VerifiableCredential> {
      let vc : VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "EmailCredential"],
        issuer: issuerDid, 
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          orgId: orgDid,
          indivId: indivDid,
          indivName: indName,
          delegation: delegation,
          issuerDid: issuerDid,
          verifiedMethod: "oAuth",
          platform: "richcanvas",
          provider: entityId
        }
      }
    
      return vc;
    }

    static async saveCredential(credentialManager: any, credential: VerifiableCredential, entityId: string, displayName: string) {
        
         const cred : W3CVerifiableCredential = {
          ...credential,
          proof: {
            ...credential.proof,
            //jwt: credential.proof.jwt,
          },
        };
        

        // using credential manager (masca or localStorage)
        const result = await credentialManager?.saveCredential(cred)

        const did = await credentialManager.getDID() 
        const key = entityId + "-" + displayName + "-" + did.data

        const credentialJSON = JSON.stringify(cred);
        localStorage.setItem(key, credentialJSON)


    }

    static async getCredential(credentialManager: any, entityId: string, displayName: string): Promise<VerifiableCredential | undefined> {


      const did = await credentialManager.getDID() 
      const key = entityId + "-" + displayName + "-" + did.data

      console.log("******************** getCredential from localStorage using key", key)
      const existingCredentialJSON = localStorage.getItem(key)
      if (existingCredentialJSON) {
        const existingCredential = JSON.parse(existingCredentialJSON)
        console.info("found existing credential: ", existingCredential)
        return existingCredential
      }


      console.log("getCredential from credentialManager")
      const vcs = await credentialManager.queryCredentials();

      console.info("entityId 1: ", entityId)
      console.info("vcs.data 1: ", vcs.data)
      for (const vc of vcs.data) {

        // adjust to account for differences in data being received
        let data
        if (vc.data) {
          data = vc.data
        }
        else {
          data = vc
        }

        console.info("vc 3: ", data)
        console.info("vc.data.credentialSubject?.provider: ", data.credentialSubject?.provider, data.credentialSubject)
        if (data.credentialSubject?.provider?.toLowerCase() == entityId.toLowerCase()) {
          console.info("found vc: ", data.credentialSubject, displayName)
          if (data.credentialSubject?.displayName?.toLowerCase() == displayName.toLowerCase()) {
            const credentialJSON = JSON.stringify(data);
            localStorage.setItem(key, credentialJSON)
            return data
          }
          else if (data.credentialSubject?.displayName === undefined) {
            const credentialJSON = JSON.stringify(data);
            localStorage.setItem(key, credentialJSON)
            return data 
          }
        } 
      }

      console.info("************** no credential found")
      return undefined

    }

    static async createCredential(
      vc: VerifiableCredential,
      entityId: string,
      displayName: string,
      did: string, 
      credentialManager: any,
      privateIssuerAccount: PrivateKeyAccount, 
      burnerAccountClient: any,
      veramoAgent: any): Promise<any | undefined> {

      let veramoVC : any | undefined

      const BASE_URL_PROVER = import.meta.env.VITE_PROVER_API_URL  || 'http://localhost:3051';
      const encoder = new TextEncoder();

      let proof = ""


      // Hash the subject DID
      function hashDID(did: string) {
        const encodedDID = Buffer.from(encoder.encode(did)).toString('hex');
        const didBigInt = BigInt('0x' + encodedDID);
        return didBigInt
      }


      

      const issuerDid = vc.issuer


      const addr = privateIssuerAccount.address
      if (addr && issuerDid && did && vc.credentialSubject) {

        // this section is going to be replaced with veramo create verifiable credential and then stored in masca metamask snap
        // the code is working in proof of concept

        const credentialSubject = vc.credentialSubject
        if (credentialSubject) {
          credentialSubject.entityId = entityId
          credentialSubject.displayName = displayName
        }

        const credentialSubjectJSON = JSON.stringify(credentialSubject);
        const credentialSubjectHash = hashMessage(credentialSubjectJSON)

        console.info(">>>>>>>>>>>>> did: ", did)
        const issuerDidHash = hashDID(issuerDid)
        const didHash = hashDID(did)

        const commitmentResponse = await fetch(`${BASE_URL_PROVER}/api/proof/commitment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issuerDidHash: issuerDidHash.toString(),
            didHash: didHash.toString(), 
            vcHash: credentialSubjectHash.toString()
          }),
        })
        const commitment = await commitmentResponse.json()

        // construct zkProof associated with credential subject, issuerDid and subjectDid
        console.info("-----------> create zk proof")
        const proofResp = await fetch(`${BASE_URL_PROVER}/api/proof/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: { 
              didHash: didHash.toString(), 
              issuerDidHash: issuerDidHash.toString(), 
              vcHash: credentialSubjectHash.toString(), 
              commitment: commitment.toString()
            }, // Example inputs
            did: did,
            commitment: commitment.toString()
          }),
        })


        const proofResults = await proofResp.json()
        proof = proofResults.proofJson


        // lets add the commitment and commitment signature to credential and then sign it
        const commitmenthHex = '0x' + BigInt(commitment as any).toString(16)
        const commitmenthHexHash = hashMessage(commitmenthHex)
        const commitmentSignature = await privateIssuerAccount.signMessage({message: commitment.toString()})

        if (commitmentSignature) {

          console.info("^^^^^^^^^^^^^^^^^^ signature: ", commitmentSignature)
          vc.credentialSubject.commitment = commitment.toString()
          vc.credentialSubject.commitmentSignature = commitmentSignature

          console.info("create veramoAgent: ", veramoAgent);
          veramoVC = await veramoAgent.createVerifiableCredential({
              //proofFormat: 'jwt',
              proofFormat: 'EthereumEip712Signature2021',
              credential: {
                issuer: issuerDid,
                credentialSubject: vc.credentialSubject,
              },
            });


          // save vc to credential manager (masca or localStorage)
          if (credentialManager) {
            console.info("save credential: ", veramoVC)
            await VerifiableCredentialsService.saveCredential(credentialManager, veramoVC, entityId, displayName)
          }
          
        }
        


      }

      console.info("done creating vc and return")
      return { vc: veramoVC, proof: proof }
    }

}
export default VerifiableCredentialsService;