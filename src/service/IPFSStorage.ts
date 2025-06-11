// src/IPFSStore.ts


import KeyResolver from 'key-did-resolver'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { fromString } from 'uint8arrays'

import { DID } from 'dids'
import { DIDSession } from 'did-session';


import * as Client from '@web3-storage/w3up-client';
import { CID } from 'multiformats/cid';


const uploadJSON = async (client: Client.Client, json: object) => {
  
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
  const file = new File([blob], 'data.json')

  const cid = await client.uploadFile(file, {
    shardSize: blob.size*2,
    concurrentRequests: 1
  })

  return 'https://' + cid + '.ipfs.w3s.link'

}

const revokeCid = async (client: Client.Client, url: string) => {
  const cid = url.replace("https://", "").replace(".ipfs.w3s.link", "")
  console.info("url: ", url)
  console.info("cid: ", cid)
  const rootCID = CID.parse(cid);
  //client.remove(rootCID)

}

const downloadJSON = async (url: string) => {
  const res = await fetch(url)
  return await res.json()
}


export class IPFSStorage {

  private session: DIDSession | undefined;

  private client: Client.Client | null = null;
  private clientPromise: Promise<Client.Client> | null = null;
  private readonly email: `${string}@${string}`;
  private readonly spaceDid: `did:${string}:${string}`;

  constructor(email: `${string}@${string}`, spaceDid: `did:${string}:${string}`) {
    this.email = email;
    this.spaceDid = spaceDid;
  }

  // Initialize Web3.Storage client
  private async initializeClient(): Promise<Client.Client> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      try {
        const client = await Client.create();
        // Check for existing session
        const spaces = await client.spaces();
        if (!spaces.find((s) => s.did() === this.spaceDid)) {
          console.info("********************** login and config space")
          await client.login(this.email);
          await client.setCurrentSpace(this.spaceDid);
        } else {
          console.info("********************** config space")
          await client.setCurrentSpace(this.spaceDid);
        }
        this.client = client;
        return client;
      } catch (err) {
        throw new Error(`Failed to initialize Web3.Storage client: ${err.message}`);
      }
    })();

    return this.clientPromise;
  }

  private replaceQuotes(obj: any): any {
      if (typeof obj === 'string') {
        // If it's a string, replace single quotes with double quotes
        return obj.replace(/'/g, '"');
      } else if (Array.isArray(obj)) {
        // If it's an array, process each element recursively
        return obj.map(item => this.replaceQuotes(item));
      } else if (typeof obj === 'object' && obj !== null) {
        // If it's an object, process each property recursively
        const result: { [key: string]: any } = {};
        forInstructions: for (const key in obj) {
          result[key] = this.replaceQuotes(obj[key]);
        }
        return result;
      }
      return obj; // Return unchanged if not a string, array, or object
    }

  // Store data in IPFS and return cid
  async storeJSON(json: any): Promise<string> {

    console.info("********** store data *********")
    const client = await this.initializeClient();


    const cid = await uploadJSON(client, json)
    console.info("*************** done cid: ", cid)

    return cid

  }
  async getProofJson(orgDid: string, vccomm: string, proofData: any): Promise<string> {

    console.info("********** store proof *********")
    const client = await this.initializeClient();

    let proofDataUpdated = {
      proof: JSON.stringify(this.replaceQuotes(proofData.proof)),
      publicSignals: this.replaceQuotes(proofData.publicSignals),
      createdAt: new Date().toISOString(),
      vccomm: vccomm,
      orgDid: orgDid
    };

    const json = JSON.stringify(proofDataUpdated)

    return json

  }

  async storeRemoveRevokes(proofUrl: string): Promise<boolean> {

    const client = await this.initializeClient();
    revokeCid(client, proofUrl)
    return true
  }

  async storeRevoke(vccomm: string, proofData: any): Promise<string> {
    const client = await this.initializeClient();

    console.info("store revoke")
    let proofDataUpdated = {
      proof: JSON.stringify(this.replaceQuotes(proofData.proof)),
      publicSignals: this.replaceQuotes(proofData.publicSignals),
      createdAt: new Date().toISOString(),
      vccomm: vccomm
    };

    const cid = await uploadJSON(client, proofDataUpdated)
    console.info("cid: ", cid)

    return cid
  }


  getDidId(): string {
    if (this.session) {
        return this.session.did.id;
    }
    return ""
  }

  serializeSession(): string {
    if (this.session) {
        return this.session.serialize();
    }
    return ""
  }


}




