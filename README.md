# MyOrgWallet Web Application

## Description

MyOrgWallet is a cutting-edge Web3 digital wallet designed for organizations, empowering seamless and secure interactions in decentralized ecosystems.

[Watch the MyOrgWallet demo video](https://youtu.be/2WAkvM0JogA)

- [Add MetaMask Card to CoA within myOrgWallet](https://odysee.com/AddMetaMaskCardFinished:7)
- [Fund MetaMask Card with USDC using CCTP v2](https://odysee.com/FundMetaMaskCardFinished:4)

### Account Abstraction (AA):

Utilize ERC-4337 to enable smart contract wallets, supporting gasless transactions and flexible user experiences without traditional private key management. Simplify onboarding with paymasters and bundled transactions.

### Delegation:

Implement delegated authority, allowing myOrgWallet users to define and publish verifiable credentials, attestations, zero-knowledge proof on the blockchain under a single delegated metamask signed delegation.

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

- Connect to an individual'ss EOA that has no funds (newly create MetaMask account within MetaMask wallet).
- Generate and deploy individual smart wallet (AA) that is driven from (owned by) an individuals EOA.
- Generate and deploy organization smart wallet (AA) that is associated with the first individual's smart wallet (AA).

### Organization (AA) to Individual (AA) Delegation -  give Individuals (AA) rights to create attestations for Organization

- Create a delegation "from" the organization smart wallet (AA) "to" the individual's smart wallet (AA).
- Save that this indiv-to-org delegation for future use. Stored in indiv-to-org on-chain attestation.
- Create chained delegation from indiv-to-org delegation to burner Account. Store delegation in browser local storage for subsequent onchain smart wallet user operations.

### Org-to-Indiv Delegation chained to Burner Delegation - support multiple user-operations to creating Organization and Individual Attestations

- Create a burner Account.
- Create a stored chained delegation from Ind-Org delegation to burner account in support of organization level smart wallet user operations.
- Create a stored delegation from individual smart wallet (AA) to support individual level smart wallet user operations.

### Issue Verifiable Credentials (VC) associated with Individuals (AA) and Organization (AA), DID references

- Create a set of verifiable credentials for the individual smart wallet (AA). Similar to humanity protocol use-case.
- Create a set of verifiable credentials for the organization smart wallet (AA). Unique to org wallet company goals.
- Credential sets created with the use of an agentic AI model (OpenAI) which scraped publically available company information through the web.
- Company information includes name, id number, form, status, formation date, state, and address.
- Agentic AI model is given direction through the use of an app-embedded chatbot.

### Publish VC related Attestations (on-chain Organization and Individual) and associated Zero Knowledge Proofs

- Generate a ZKP for each verifiable credential (associated with smart wallets) and attach to attestation.
- Create attestations using entry point user op to EAS contract. Using Paymaster, Bundler and delegationChain RedeemDelegation.

### Link second Individuals (AA) to Organization (AA)

- Second individual domain name link to published organization (AA) attestation domain name.
- Second individual creates individual (AA) only with domain name attestation.
- First individual is prompted with new associated individual (AA) accounts and they create a delegation from org AA to second individual AA.
- Second individual now has rights to add attestations to organization AA. This is done via burner chained delegation when they connect in.

### All published Individual and Organization attestations and zero-knowledge proofs are on-chain

- 3rd party can search and explore an organizations attestations and leadership information.

### Multi-User Operations via Bundler and Paymaster

- Bundle/batch multiple EAS contract users operations in single bundled request.

### Individuals fully control their account and attestations. Individuals jointly manage Organizations Attestations

<img src="./public/delegation.jpeg" width="600px">

## Goals

* Provide an organization a digital wallet (Account Abstraction) to manage their organizational and individual attestations.
* Use a modern web3 stack and leverage latest MetaMask capabilities.
* Intuitive AI chat driven UI. No MetaMask permission popups within main application (one time permission popups during initial onboarding).
* Role based (via delegation) security. On-chain based on domain and leveraged by all dApps.

## Architecture

<img src="./public/architecture.jpeg" width='750px'>

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
* Veramo (future)
* Masca Snap (future)

## Prompts

* approve leader (first person creating organization is automatically given this capability)
    - delegation from org to individual (provide individuals with rights to post attestations on org)
    - create org leader verifiable credential which represents individuals role
    - post org leadership attestation which represents individuals role




* add savings account (category: 1110 - Main Savings)
    - create smart account and set CoA category
    - delegation from savings account to org (org has permission to move money)
    - create VC and attestation for savings account
    - create VC and attestation for from savings account to org delegation 

* approve account access
    - chain delegation from org to individual for access to savings account (extend access to savings account)
    - create VC and attestation for individual access to savings account

* add debit card (debit card on any chain)
    - capture debit card chain id and wallet address
    - create individual debit card VC, attestation and associated with CoA

* fund card
    - send USDC from selected Savings account to selected debit Card EOA



if (lastUserResponse.toLowerCase().includes("add savings account")) {
        console.info("add savings account ...")
        setAddSavingsModalVisible(true)
      }
      if (lastUserResponse.toLowerCase().includes("approve account access")) {
        console.info("approve account access ...")
        setApproveAccountAccessModalVisible(true)
      }
      if (lastUserResponse.toLowerCase().includes("add debit card")) {
        console.info("add debit card ...")
        setAddAccountModalVisible(true)
      }
      if (lastUserResponse.toLowerCase().includes("fund card")) {
        console.info("fund card ...")
        setFundCreditCardModalVisible(true)
      }



## Requirements

* [NodeJS](https://nodejs.dev/en/)
* [npm](https://www.npmjs.com/)
* [OpenAI API Account](https://openai.com/blog/openai-api)
* [metamask delegation toolkit]


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

