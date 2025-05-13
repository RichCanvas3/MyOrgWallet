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
- Credential sets created with the use of an Agentic AI model (OpenAI) which accessed and obtained publically available company information through the web.
- Company information includes name, id number, form, status, formation date, state, and address. 
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
### Individuals fully control their account and attestations.  Individuals jointly manage Organizations Attestations

Try me!
