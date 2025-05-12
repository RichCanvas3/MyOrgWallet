# MyOrgWallet Web Application

## Goals

* Provide an organization a digital wallet (Account Abstraction) to manage their organizational attestations.
* Use a modern web stack of ReactJS, Tailwind CSS, and Typescript.
* Vite client and server.

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