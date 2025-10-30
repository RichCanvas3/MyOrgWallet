

import {CustomError} from "./CustomError";

import axios from 'axios'

//const BASE_URL = 'https://myorgwallet-service-f3ffgehta2ecbsea.westus2-01.azurewebsites.net/'; 
const BASE_URL = import.meta.env.VITE_ORGSERVICE_API_URL || 'http://localhost:8501';

export class OrgService {

  static abortController: AbortController | null = null;



  static async getOrgWithCompanyName(name: string, state: string): Promise<any> {
    let endpoint = `${BASE_URL}/creds/good-standing/company?company=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}`;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from company name: ", res)
    return JSON.stringify(res);
  }


  static async getOrgWithEmail(email: string): Promise<any> {
    let endpoint = `${BASE_URL}/creds/good-standing/email?email=${encodeURIComponent(email)}`;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from email: ", res)
    return JSON.stringify(res);
  }


  static async checkDomain(domain: string): Promise<any> {
    let endpoint = `${BASE_URL}/creds/good-standing/domain?domain=${encodeURIComponent(domain)}`;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from domain: ", res)
    return JSON.stringify(res);
  }

  static async checkWebsite(website: string): Promise<any> {
    let endpoint = `${BASE_URL}/creds/good-standing/website?website=${encodeURIComponent(website)}`;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    return JSON.stringify(res);
  }

  /*
  static async checkStateRegistrationLink(veramoAgent: any, mascaApi: any): Promise<any> {

    // 1.  client send intent without VP (asks for server to send back a challenge response)
    // 2.  server responds with challenge (challenge is string that is used to sign request)
    // 3.  client sends request with VP signed with challege
    // 4.  server verifies that client is valid and then responds to request
    // 5.  client gets response

    // 1. client sent intent without VP

    const webDidList = await veramoAgent.didManagerFind({
        alias: "my-web-did",
      })
    console.info("webDidList: ", webDidList)
    const holderDid = webDidList[0].did

    const issuerDidList = await veramoAgent.didManagerFind({
        alias: "my-issuer-did",
      })
    console.info("issuerDidList: ", issuerDidList)

    const intentMessage = {
      "from": "did:key:z6MkClient...",
      "type": "PresentationRequest",
      "intent": {
        "action": "FindStateRegistration",
        "filters": {
          "name": "Lawn Care"
        }
      }
    }

    let endpoint = `${BASE_URL}/creds/mcp`;
    let headers = {
      "Content-Type": "application/json"
    };

    const result = await axios.post(endpoint, intentMessage)
    console.info("challenge result: ", result)


    const challenge = result.data.challege


    // 1. Issue VC
    const vc = await veramoAgent.createVerifiableCredential({
      credential: {
        issuer: { id: holderDid },
        credentialSubject: {
          id: holderDid,
          name: 'Alice',
          role: 'MCP Explorer',
        },
        type: ['VerifiableCredential', 'ProfileCredential'],
        '@context': ['https://www.w3.org/2018/credentials/v1'],
      },
      proofFormat: 'jwt',
    })

    // 2. Package VC into VP
    const vp = await veramoAgent.createVerifiablePresentation({
      presentation: {
        holder: holderDid,
        verifiableCredential: [vc],
      },
      proofFormat: 'jwt',
      challenge: challenge
    })

    console.info("........ vp: ", JSON.stringify(vp))

  // 3. Send VP to server
  const response = await axios.post(endpoint, vp)



  }
  */
}

