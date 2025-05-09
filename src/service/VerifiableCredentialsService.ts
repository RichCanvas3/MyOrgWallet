import { VerifiableCredential } from "../models/VerifiableCredential"
import { WalletClient, verifyMessage, hexToBytes, bytesToHex } from "viem";
import { ethers, hashMessage } from 'ethers'
import { recoverPublicKey } from "@ethersproject/signing-key";


import { vs } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Buffer } from 'buffer';


import { createPimlicoClient } from "permissionless/clients/pimlico";
import { MessageHashUtils } from "@metamask/delegation-toolkit";

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
          platform: "richcanvas-" + entityId
        }
      }
    
      return vc;
    }

    static async createInsuranceVC(
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
          platform: "richcanvas-insurance"
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
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
          platform: "richcanvas-" + entityId
        }
      }
    
      return vc;
    }


    
    static async createIndivOrgVC(
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
          platform: "richcanvas-" + entityId
        }
      }
    
      return vc;
    }

    static async saveCredential(walletClient: WalletClient, credential: VerifiableCredential, entityId: string) {
        
        const credentialJSON = JSON.stringify(credential);

        localStorage.setItem(entityId, credentialJSON)

        /*
        const snapVC = { id: entityId, credential: credentialJSON}

        walletClient.request({
          method: 'wallet_invokeSnap',
          params: {
            snapId: VerifiableCredentialsService.snapId,
            request: { method: "storeVC", params: { snapVC } }
          },
        }).then((resp) => {
          //console.info("save call successful, ", resp)
        })
          */

    }

    static async getCredential(walletClient: WalletClient, entityId: string): Promise<VerifiableCredential | undefined> {

        let credential : VerifiableCredential | undefined

        const credStr = localStorage.getItem(entityId)

        if (credStr) {
          const credJson = JSON.parse(credStr)
          credential = {
              '@context': credJson['@context'],
              id: credJson['id'],
              type: credJson['type'],
              issuer: credJson['issuer'],
              issuanceDate: credJson['issuanceDate'],
              expirationDate: credJson['expirationDate'],
              credentialSubject: credJson['credentialSubject'],
              proof: credJson['proof']
          }
        }

        /*
        const response : any = await walletClient.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId: VerifiableCredentialsService.snapId,
                request: { method: "getVC", params: {id: entityId}},
            },
        })

        if (response?.id && response?.id == entityId) {
            if (response?.credential) {

                const credStr = response?.credential
                const credJson = JSON.parse(credStr)

                credential = {
                    '@context': credJson['@context'],
                    id: credJson['id'],
                    type: credJson['type'],
                    issuer: credJson['issuer'],
                    issuanceDate: credJson['issuanceDate'],
                    expirationDate: credJson['expirationDate'],
                    credentialSubject: credJson['credentialSubject'],
                    proof: credJson['proof']
                }

            }
        }
        */

        return credential

    }

    static async createCredential(
      vc: VerifiableCredential,
      entityId: string,
      did: string, 
      walletClient: WalletClient, 
      issuerAccountClient: any): Promise<any | undefined> {


      let proofUrl = ""

      
      const encoder = new TextEncoder();

      // Hash the subject DID
      function hashDID(did: string) {
        const encodedDID = Buffer.from(encoder.encode(did)).toString('hex');
        const didBigInt = BigInt('0x' + encodedDID);
        return didBigInt
      }


      async function verifyMessageDirect(smartAccountAddress: string, messageHash: string, signature: string) {

        const rpcUrl = "https://opt-mainnet.g.alchemy.com/v2/UXKG7nGL5a0mdDhvP-2ScOaLiRIM0rsW"
        const provider = new ethers.JsonRpcProvider(rpcUrl);
      
        const abi = ["function isValidSignature(bytes32 _hash, bytes _signature) external view returns (bytes4)"];
        const contract = new ethers.Contract(smartAccountAddress, abi, provider);

        console.info("******* contract *****: ", contract)
        const result = await contract.isValidSignature(messageHash, signature);
        return result.startsWith("0x1626ba7e");
      }



      // create verifiable credential to represent
      //   - organization DID
      //   - organization domain
      //   - commitment
      //   - verifier DID (richcanvas)

      const issuerDid = vc.issuer
      const credentialJSON = JSON.stringify(vc);

      // Hash data according to EIP-712
      const credentialHash = hashMessage(credentialJSON)

      console.info("issuerAccountClient: ", issuerAccountClient)
      const signature = await issuerAccountClient?.signMessage({message: credentialHash})

      const addr = await issuerAccountClient?.getAddress()
      if (addr && signature) {

        //const validSignature = await verifyMessageDirect(addr, credentialHash, signature)
        //console.info("is valid issuer signature: ", validSignature)

        var sig = "'" + signature + "'"

        // complete vc proof that holds commitmentHash hex in subject
        vc.proof = {
          type: 'EthereumEip712Signature2021',
          created: vs.issuanceDate,
          proofPurpose: 'assertionMethod',
          verificationMethod: issuerDid,
          // issuer signed a string of the vc without proof section
          signature: sig
        }


        const BASE_URL_PROVER = process.env.PROVER_API_URL || 'http://localhost:3051';
        
        if (issuerDid && did) {

          console.info(">>>>>>>>>>>>> did: ", did)
          const issuerDidHash = hashDID(issuerDid)
          const didHash = hashDID(did)


          const res = await fetch(`${BASE_URL_PROVER}/api/proof/commitment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issuerDidHash: issuerDidHash.toString(),
              didHash: didHash.toString(), 
              vcHash: credentialHash.toString()
            }),
          })
          const commitment = await res.json()

          // construct zkProof associated with verifiable credential
          const commitmenthHex = '0x' + BigInt(commitment as any).toString(16)
          const commitmenthHexHash = hashMessage(commitmenthHex)

          const commitmentSignature = await issuerAccountClient?.signMessage({message: commitment.toString()})
          if (commitmentSignature && vc.credentialSubject) {

            console.info("^^^^^^^^^^^^^^^^^^ signature: ", commitmentSignature)
            //const abc = normalizeSignature(commitmentSignature)
            //const isValid = await verifyMessage({ address: issuerAccountClient.address, message: commitment.toString(), signature: abc })
            //console.info("^^^^^^^^^^^^^^^^^^^ isValid: ", isValid)


            vc.credentialSubject.commitment = commitment.toString()
            vc.credentialSubject.commitmentSignature = commitmentSignature

            console.info("addr: ", addr)
            console.info("hash: ", commitmenthHexHash)
            console.info("signature: ", commitmentSignature)
            //const validCommitment = await verifyMessageDirect(addr, commitmenthHexHash, commitmentSignature)

            // console.info("is valid signature for commitment: ", valid)
            // generate Proof
  

            //console.info("issuerDid: ", issuerDid)
            //console.info("issuerDidHash: ", issuerDidHash) 

            //console.info("orgDid: ", orgDid)
            //console.info("orgDidHash: ", orgDidHash) 

            //console.info("credentialHash: ", credentialHash)

            //console.info("commitment: ", commitment)
            //console.info("commitmenthHex (can get back to commitment): ", commitmenthHex)
            //console.info("commitmenthHexHash: ", commitmenthHexHash)

            //console.info("commitmentSignature: ", commitmentSignature)

            // save vc to metamask snap storage
            if (walletClient) {
              await VerifiableCredentialsService.saveCredential(walletClient, vc, entityId)
            }

            console.info("-----------> create proof")
            const proofResp = await fetch(`${BASE_URL_PROVER}/api/proof/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inputs: { issuerDidHash: issuerDidHash.toString(), didHash: didHash.toString(), vcHash: credentialHash.toString(), commitment: commitment.toString(), commitmentSignature: commitmentSignature.toString() }, // Example inputs
                commitment: commitment.toString(),
                did: did
              }),
            })

            console.info("get json ", proofResp)
            const proofResults = await proofResp.json()
            console.info(" get proof url: ", proofResults)
            proofUrl = proofResults.proofUrl

            console.info("proof done: ", proofUrl)

            // verify if we have access to accountclient
            //const validSigData = await issuerAccountClient?.getIsValidSignatureData(commitmenthHexHash as `0x${string}`, commitmentSignature)
            //if (validSigData) {
            //  const valid = validSigData.startsWith("0x1626ba7e"); // ERC-1271 magic value
            //}

            
          }
          
        }

      }

      console.info("done creating vc and return")
      return { vc: vc, proofUrl: proofUrl }
    }
        
    static async verifyIssuerCredentialHashSignature(smartAccountAddress: string, messageHash: string, signature: string) {

      //   PRIVATE DATA
      const rpcUrl = "https://opt-mainnet.g.alchemy.com/v2/UXKG7nGL5a0mdDhvP-2ScOaLiRIM0rsW"
      const provider = new ethers.JsonRpcProvider(rpcUrl);
    
      const abi = ["function isValidSignature(bytes32 _hash, bytes _signature) external view returns (bytes4)"];
      const contract = new ethers.Contract(smartAccountAddress, abi, provider);
      const result = await contract.isValidSignature(messageHash, signature);
      return result.startsWith("0x1626ba7e");
    }

}
export default VerifiableCredentialsService;