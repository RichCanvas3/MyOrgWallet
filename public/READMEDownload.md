# MyOrgWallet Web Application

## Description

MyOrgWallet is a cutting-edge Web3 digital wallet designed for organizations, empowering seamless and secure interactions in decentralized ecosystems. For this hackathon, build innovative applications leveraging MyOrgWallet’s advanced features:

### Account Abstraction (AA): 

Utilize ERC-4337 to enable smart contract wallets, supporting gasless transactions and flexible user experiences without traditional private key management. Simplify onboarding with paymasters and bundled transactions.

### Delegation: 

Implement delegated authority, allowing myOrgWallet users to define and publish verifiable credentials, attestations, zero-knowledge proof on the blockchain under a single deligated metamask signed delegation.

### Verifiable Credentials (VCs): 

Issue and verify fraud-proof digital credentials (e.g., certifications, memberships) using W3C standards, stored securely in user MetaMask wallets. Enable selective disclosure for privacy-preserving identity verification.

### Published Attestations: 

MyOrgWallet empowers business to publish business attestations, associated with their verifiable credentials. Attestations are discoverable on-chain and linked to verifiable zero-knowledge-proofs.

### Zero-Knowledge Proofs (ZKPs): 

Integrate ZKPs to prove attributes (e.g., website ownership, compliance) without revealing sensitive data, enhancing privacy in eCommerce and trust frameworks.

### AI Chatbot: 

Develop an AI-powered chatbot within MyOrgWallet to assist users, answer queries, and guide credential management, leveraging natural language processing for intuitive interactions.

### Agentic AI Web Scraping: 

Build autonomous AI agents that traverse the web data (e.g., verify state registration or domain ownership) to inform decision-making, integrating with MyOrgWallet for secure data handling and credential issuance.

### Credential Issuer: 
Create tools for organizations to issue VCs (e.g., employee badges, supplier certifications) via MyOrgWallet, using blockchain for immutability and cryptographic signatures for trust.

### Challenge: 
Design a solution showcasing these features, such as a decentralized eCommerce platform where MyOrgWallet verifies supplier credentials, delegates transaction authority to AI agents, and uses ZKPs for privacy. Compete for prizes by demonstrating scalability, user experience, and Web3 innovation!

## Explanation, Functions, and Features

### Organization Smart Wallet (AA) and Individuals Smart Wallet (AA) linked to EOA account (no funds required)
- Connect to Individuals EOA that has no funds (newly create metamask account within metmask wallet)
- Generate and Deploy Individual Smart Wallet (AA) that is driven from (owned by) an individuals EOA
- Generate and Deploy Organization Smart Wallet (AA) that is associated with the first Individual's Smart Wallet (AA)
### Organization (AA) to Individual (AA) Delegation -  give Individuals (AA) rights to create attestations for Organization
- Create a Delegation "from" the Oranization Smart Wallet (AA) "to" the Individuals Smart Wallet (AA)
- Save that this Indiv-to-Org Delegation for future use.  Stored in Indiv-to-Org on-chain attestation
- Create chained Delegation from Indiv-to-Org Delegation to Burner Account and store it in browser for subsequent smart wallet Org user
### Org-to-Indiv Delegation chained to Burner Delegation - support multiple user-operations to creating Organization and Individual Attestations
- Create a burner Account
- Create a stored Chained Delegation from Ind-Org Delegation to Burner Account in support of Organization level smart wallet user operations
- Create a stored Delegation from  Individual Smart Wallet (AA) to support Individual level smart wallet user operations
### Issue Verifiable Credentials (VC) associated with Individuals (AA) and Organization (AA), DID references
- Create a set of Verifiable Credentials for the Individual Smart Wallet (AA).  Similar to Humanity Protocol use-case
- Create a set of Verifiable Credentials for the Organization Smart Wallet (AA).  Unique to Org Wallet Company Goals
- Credential sets created with the use of an Agentic AI model (OpenAI) which scraped publically available company information through the web.
- Company information includes name, id number, form, status, formation date, state, and address.
- Agentic AI model is given direction through the use of an app-inbedded chatbot
### Publish VC related Attestations (on-chain Organization and Individual) and associated Zero Knowledge Proofs
- Generate a Zero Knowledge Proof for each Verifiable Credential (associated with Smart Wallets) and attach to attestation.
- Create Attestations using entry point user op to EAS Contract.  Using Paymaster, Bundler and delegationChain RedeemDelegation.
### Link second Individuals (AA) to Organization (AA)
- Second Individual domain name link to published Organization (AA) attestation domain name
- Second Individual create Individual (AA) only with domain name Attestation
- First Individual is prompted with new associated Individual (AA) accounts and they create a Delegation from Org AA to Second Indiv AA
- Second Individual now has rights to add attestations to Organization AA.  This is done via burner chained delegation when they connect in
### All published Individual and Organization attestations and zero-knowledge proofs are on-chain
- 3rd Party can search and explore an Organizations attestations and leadership information
### Multi-User Operations via Bundler and Paymaster
- Bundle/batch multiple EAS Contract Users Operations in single Bundled request
### Individuals fully control their account and attestations.  Individuals jointly manage Organizations Attestations

<img src="delegation.jpeg" width="600px">

## Goals

* Provide an organization a digital wallet (Account Abstraction) to manage their organizational attestations.
* Use a modern web stack of ReactJS, Tailwind CSS, and Typescript.
* Vite client and server.
* Intuitive AI chat driven UI.
* No metamask permission popups within main application (one time permission popups during initial onboarding)
* Role based (via delegation) security.  On-chain based on domain and leveraged by all dApps

## Architecture

<img src="architecture.jpeg" width='750px'>

## Technology

* React
* Wagmi
* Viem
* Ethers
* Metamask/Delegation-Toolkit
* Hyrbid Signatory/Factory
* Pimlico (bundler, paymaster)
* Apollo
* EAS
* Openai
* Python
* Django
* Selenium
* Lavague
* Veramo
* Masca Snap

## Requirements

* [NodeJS](https://nodejs.dev/en/)
* [npm](https://www.npmjs.com/)
* [OpenAI API Account](https://openai.com/blog/openai-api)
* LinkedIn

## Setup

### 1. Create Environment Variable File (If Absent)

```sh
cd MyOrgWallet

touch .env
```

### 2. Install Dependencies

When installing dependencies, make sure the node version is up-to-date. Check the current node version with `node -v`. Update note with `nvm install node`.

```sh
npm install
```

### 3. Run Client

```sh
open http://localhost:5173

npm run dev
```

### 4. Run Server

```sh
open http://localhost:8080

npm run start
```

## DID's used by application

```
RichCanvas Organization
RichCanvas EAO Owner DID:
    did:pkh:eip155:10:0x9cfc7e44757529769a28747f86425c682fe64653
RichCanvas Org (Abstract Account, Smart Wallet) DID:
    did:pkh:eip155:10:...
```

## Contributions

This project is based on elebitzero, openai-react-chat, licensed under the MIT License. Substantial changes have been made. See elebitzero openai-react-chat MIT License.txt for the original license.

```
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
```

