# MyOrgWallet Web Application

## Goals
* 
* Provide an organization a digital wallet (Account Abstraction) to manage their organizational attestation
* 


* Use a modern web stack of React, Tailwind CSS, and Typescript.
* Vite client and server



## Requirements

* [Node.JS](https://nodejs.dev/en/)
* [npm](https://www.npmjs.com/)
* [OpenAI API Account](https://openai.com/blog/openai-api)
*
* Linkedin 


## Setup

npm install

* start client http://localhost5173
npm run dev

* start server http://localhost:4000
npm run start


## DID's used by application

RichCanvas Organization
RichCanvas EAO Owner DID:  
    did:pkh:eip155:10:0x9cfc7e44757529769a28747f86425c682fe64653
RichCanvas Org (Abstract Account, Smart Wallet) DID: 
    did:pkh:eip155:10:0x478df0535850b01cBE24AA2DAd295B2968d24B67


## Contributions

This project is based on elebitzero, openai-react-chat, licensed under the MIT License. Substantial changes have been made. See elebitzero openai-react-chat MIT License.txt for the original license.





query GetAllZkProofs {
  zkProofIndex(first: 100) {
    edges {
      node {
        issuer {
          id
        }
        id
        proof
        publicSignals
        createdAt
        orgDid
        hash
      }
    }
  }
}