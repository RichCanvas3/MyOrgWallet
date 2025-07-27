import type { VerifiableCredential } from '@veramo/core';

export interface DIDInfo {
  data: string;
  did: string;
}

export interface CredentialInfo {
  data: VerifiableCredential;
  id: string;
  meta: {
    id: string;
    store: string[];
  };
}

export interface InfuraIPFSConfig {
  projectId: string;
  projectSecret: string;
  endpoint?: string;
}

export class InfuraIPFSCredentialManager {
  private did: string;
  private config: InfuraIPFSConfig;
  private credentialsCache: CredentialInfo[] | null = null;

  constructor(did?: string, config?: InfuraIPFSConfig) {
    this.did = did || 'local-did';
    
    // Get Infura IPFS configuration from environment variables
    this.config = config || {
      projectId: import.meta.env.VITE_INFURA_IPFS_PROJECT_ID || '',
      projectSecret: import.meta.env.VITE_INFURA_IPFS_PROJECT_SECRET || '',
      endpoint: import.meta.env.VITE_INFURA_IPFS_ENDPOINT || 'https://ipfs.infura.io:5001'
    };

    if (!this.config.projectId || !this.config.projectSecret) {
      console.warn('Infura IPFS credentials not configured. Please set VITE_INFURA_IPFS_PROJECT_ID and VITE_INFURA_IPFS_PROJECT_SECRET');
    }
  }

  /**
   * Get the current DID
   */
  async getDID(): Promise<DIDInfo> {
    return {
      data: this.did,
      did: this.did
    };
  }

  /**
   * Set the DID for this manager
   */
  setDID(did: string): void {
    this.did = did;
  }

  /**
   * Get the storage key for this DID
   */
  private getStorageKey(): string {
    return `myorgwallet_credentials_${this.did}`;
  }

  /**
   * Upload data to Infura IPFS
   */
  private async uploadToIPFS(data: any): Promise<string> {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      formData.append('file', blob, 'credentials.json');

      const response = await fetch(`${this.config.endpoint}/api/v0/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.projectId}:${this.config.projectSecret}`)}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.Hash; // Return the IPFS hash
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  /**
   * Download data from Infura IPFS
   */
  private async downloadFromIPFS(hash: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/v0/cat?arg=${hash}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.projectId}:${this.config.projectSecret}`)}`,
        }
      });

      if (!response.ok) {
        throw new Error(`IPFS download failed: ${response.statusText}`);
      }

      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Error downloading from IPFS:', error);
      throw error;
    }
  }

  /**
   * Get the IPFS hash for this DID's credentials
   */
  private async getCredentialsHash(): Promise<string | null> {
    try {
      // Store a mapping of DID to IPFS hash in localStorage as a fallback
      const hashKey = `ipfs_hash_${this.did}`;
      const hash = localStorage.getItem(hashKey);
      return hash || null;
    } catch (error) {
      console.error('Error getting credentials hash:', error);
      return null;
    }
  }

  /**
   * Store the IPFS hash for this DID's credentials
   */
  private async storeCredentialsHash(hash: string): Promise<void> {
    try {
      const hashKey = `ipfs_hash_${this.did}`;
      localStorage.setItem(hashKey, hash);
    } catch (error) {
      console.error('Error storing credentials hash:', error);
    }
  }

  /**
   * Save a credential to IPFS
   */
  async saveCredential(credential: VerifiableCredential): Promise<{ success: boolean }> {
    try {
      const credentials = await this.getAllCredentials();
      const newCredential: CredentialInfo = {
        data: credential,
        id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        meta: {
          id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          store: ['infuraIPFS']
        }
      };
      
      credentials.push(newCredential);
      await this.saveCredentialsToIPFS(credentials);
      
      return { success: true };
    } catch (error) {
      console.error('Error saving credential to IPFS:', error);
      return { success: false };
    }
  }

  /**
   * Query all credentials from IPFS
   */
  async queryCredentials(): Promise<{ data: VerifiableCredential[] }> {
    console.log('******************** queryCredentials from IPFS');
    try {
      const credentials = await this.getAllCredentials();
      console.log('******************** queryCredentials', credentials);
      return {
        data: credentials.map(cred => cred.data)
      };
    } catch (error) {
      console.error('Error querying credentials from IPFS:', error);
      return { data: [] };
    }
  }

  /**
   * Get a specific credential by entityId and displayName
   */
  async getCredential(entityId: string, displayName: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('******************** getCredential from IPFS', entityId, displayName);
      const credentials = await this.getAllCredentials();
      console.log('******************** getCredential', credentials);
      
      for (const cred of credentials) {
        const subject = cred.data.credentialSubject as any;
        if (subject?.provider?.toLowerCase() === entityId.toLowerCase()) {
          if (subject?.displayName?.toLowerCase() === displayName.toLowerCase()) {
            return cred.data;
          } else if (subject?.displayName === undefined) {
            return cred.data;
          }
        }
      }
      
      return undefined;
    } catch (error) {
      console.error('Error getting credential from IPFS:', error);
      return undefined;
    }
  }

  /**
   * Delete a credential by ID
   */
  async deleteCredential(credentialId: string): Promise<{ success: boolean }> {
    try {
      const credentials = await this.getAllCredentials();
      const filteredCredentials = credentials.filter(cred => cred.id !== credentialId);
      await this.saveCredentialsToIPFS(filteredCredentials);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting credential from IPFS:', error);
      return { success: false };
    }
  }

  /**
   * Clear all credentials
   */
  async clearAllCredentials(): Promise<{ success: boolean }> {
    try {
      await this.saveCredentialsToIPFS([]);
      return { success: true };
    } catch (error) {
      console.error('Error clearing credentials from IPFS:', error);
      return { success: false };
    }
  }

  /**
   * Get all credentials from IPFS
   */
  private async getAllCredentials(): Promise<CredentialInfo[]> {
    // Return cached credentials if available
    if (this.credentialsCache !== null) {
      return this.credentialsCache;
    }

    try {
      const hash = await this.getCredentialsHash();
      if (!hash) {
        this.credentialsCache = [];
        return [];
      }

      const data = await this.downloadFromIPFS(hash);
      this.credentialsCache = Array.isArray(data) ? data : [];
      return this.credentialsCache;
    } catch (error) {
      console.error('Error getting credentials from IPFS:', error);
      this.credentialsCache = [];
      return [];
    }
  }

  /**
   * Save credentials to IPFS
   */
  private async saveCredentialsToIPFS(credentials: CredentialInfo[]): Promise<void> {
    try {
      const hash = await this.uploadToIPFS(credentials);
      await this.storeCredentialsHash(hash);
      this.credentialsCache = credentials; // Update cache
      console.log('Credentials saved to IPFS with hash:', hash);
    } catch (error) {
      console.error('Error saving credentials to IPFS:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): { totalCredentials: number; storageSize: number } {
    const credentials = this.credentialsCache || [];
    const storageSize = JSON.stringify(credentials).length;
    
    return {
      totalCredentials: credentials.length,
      storageSize
    };
  }

  /**
   * Get the current IPFS hash
   */
  async getCurrentHash(): Promise<string | null> {
    return await this.getCredentialsHash();
  }

  /**
   * Clear the credentials cache
   */
  clearCache(): void {
    this.credentialsCache = null;
  }
}

/**
 * Factory function to create an Infura IPFS Credential Manager
 */
export function createInfuraIPFSCredentialManager(did?: string, config?: InfuraIPFSConfig): InfuraIPFSCredentialManager {
  return new InfuraIPFSCredentialManager(did, config);
} 