import { VcZkProof, VcRevokeZkProof } from "../models/ZkProof"

import { getCachedResponse, putCachedResponse, putCachedValue } from "../service/CachedService"
const encoder = new TextEncoder();

const SNARK_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');


const BASE_URL_PROVER = import.meta.env.VITE_PROVER_API_URL || 'http://localhost:3051';

class ZkProofService {

    static async getVcZkProof(proof: string, vccomm: string, issuerDid: string, orgDid: string): Promise<VcZkProof> {

      const resp1 = await fetch('/verification_key.json')
      const verificationKey = await resp1.json()

      function hashText(txt: string) {
        const encodedDID = Buffer.from(encoder.encode(txt)).toString('hex');
        const didBigInt = BigInt('0x' + encodedDID);
        return didBigInt
      }

      let zkProof : VcZkProof =  JSON.parse(proof)

      const issuerDidHash = hashText(issuerDid)
      const modIssuerDidHash = issuerDidHash % SNARK_FIELD

      const orgDidHash = hashText(orgDid)
      const modOrgDidHash = orgDidHash % SNARK_FIELD

      const validateWith = [modOrgDidHash.toString(), modIssuerDidHash.toString(), vccomm]


      if (zkProof.proof) {
        const zkProofJson = JSON.parse(zkProof.proof)
        
      
        const cacheKey = modOrgDidHash.toString() + modIssuerDidHash.toString() + vccomm
        const cached = await getCachedResponse(cacheKey);
        if (cached) {
          const cachedData = await cached.json()
          zkProof.isValid = cachedData 
          //console.info("get from cache: ", cachedData )
        }
        else {

          //console.info("run proof: ", modOrgDidHash.toString(), modIssuerDidHash.toString(), vccomm)

          const res = await fetch(`${BASE_URL_PROVER}/api/proof/checkproof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verificationKey: verificationKey, publicSignals: validateWith, zkProofJson: zkProofJson
            }),
          })
          const cachedData = await res.json()
          putCachedValue(cacheKey, cachedData)
          zkProof.isValid = cachedData 
        }
    

      }


      //console.info(">>>>>>>>>>>  end of zkProof: ", zkProof.isValid, vccomm)
      return zkProof
    }


    static async getVcRevokeZkProof(proof: string, vccomm: string): Promise<VcRevokeZkProof> {

      const resp = await fetch('/revoke_verification_key.json')
      const revokeVerificationKey = await resp.json()


      let zkProof : VcRevokeZkProof =  JSON.parse(proof)
      

      if (zkProof.proof && zkProof.publicSignals) {

        const zkProofJson = JSON.parse(zkProof.proof)

        const cacheKey = zkProofJson
        const cached = await getCachedResponse(cacheKey);
        if (cached) {
          const cachedData = await cached.json()
          zkProof.isValid = cachedData 
        }
        else {
          //console.info("run proof: ")
          
          const res = await fetch(`${BASE_URL_PROVER}/api/proof/checkproof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verificationKey: revokeVerificationKey, publicSignals: zkProof.publicSignals, zkProofJson: zkProofJson
            }),
          })
          //const cachedData = await snarkjs.groth16.verify(revokeVerificationKey, zkProof.publicSignals, zkProofJson)
          const cachedData = await res.json()
          
          putCachedValue(cacheKey, cachedData)
          zkProof.isValid = cachedData 
        }


        if (zkProof.isValid) {
          zkProof.isValid = true
          console.info("================ REVOKED ================")
        }
  
      }

      return zkProof
    }

}
export default ZkProofService;