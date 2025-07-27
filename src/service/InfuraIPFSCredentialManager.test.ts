import { createInfuraIPFSCredentialManager } from './InfuraIPFSCredentialManager';
import type { VerifiableCredential } from '@veramo/core';

// Example usage of Infura IPFS Credential Manager
export async function testInfuraIPFSCredentialManager() {
  // Create a manager instance
  const manager = createInfuraIPFSCredentialManager('did:example:123');

  // Example verifiable credential
  const exampleCredential: VerifiableCredential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential'],
    issuer: 'did:example:issuer',
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: 'did:example:subject',
      provider: 'example-provider',
      displayName: 'Example Credential'
    },
    proof: {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFUzI1NksifQ...'
    }
  };

  try {
    // Save a credential
    console.log('Saving credential...');
    const saveResult = await manager.saveCredential(exampleCredential);
    console.log('Save result:', saveResult);

    // Query all credentials
    console.log('Querying credentials...');
    const queryResult = await manager.queryCredentials();
    console.log('Query result:', queryResult);

    // Get a specific credential
    console.log('Getting specific credential...');
    const specificCredential = await manager.getCredential('example-provider', 'Example Credential');
    console.log('Specific credential:', specificCredential);

    // Get storage stats
    console.log('Getting storage stats...');
    const stats = manager.getStorageStats();
    console.log('Storage stats:', stats);

    // Get current IPFS hash
    console.log('Getting current hash...');
    const hash = await manager.getCurrentHash();
    console.log('Current hash:', hash);

  } catch (error) {
    console.error('Error testing Infura IPFS Credential Manager:', error);
  }
}

// Example configuration
export const exampleConfig = {
  projectId: 'your_infura_project_id',
  projectSecret: 'your_infura_project_secret',
  endpoint: 'https://ipfs.infura.io:5001'
};

// Example with custom configuration
export async function testWithCustomConfig() {
  const manager = createInfuraIPFSCredentialManager('did:example:123', exampleConfig);
  
  // Use the manager as above...
  console.log('Manager created with custom config');
} 