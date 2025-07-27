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

export interface ServerWeb3StorageConfig {
  serverUrl?: string;
}

export class ServerWeb3StorageCredentialManager {
  private did: string;
  private config: ServerWeb3StorageConfig;
  private credentialsCache: CredentialInfo[] | null = null;
  private serverUrl: string;

  constructor(did?: string, config?: ServerWeb3StorageConfig) {
    this.did = did || 'local-did';
    this.config = config || {};
    this.serverUrl = this.config.serverUrl || 'http://localhost:4000';
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
   * Upload data to Web3.Storage via server
   */
  private async uploadToServer(data: any): Promise<string> {
    try {
      const response = await fetch(`${this.serverUrl}/api/web3storage/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          filename: `credentials_${this.did}.json`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      return result.cid;
    } catch (error) {
      console.error('Error uploading to server:', error);
      throw error;
    }
  }

  /**
   * Download data from Web3.Storage via server
   */
  private async downloadFromServer(cid: string): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}/api/web3storage/download/${cid}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error downloading from server:', error);
      throw error;
    }
  }

  /**
   * Get the Web3.Storage hash for this DID's credentials
   */
  private async getCredentialsHash(): Promise<string | null> {
    try {
      console.log('******************** web3storage getCredentialsHash did: ', this.did);
      // Store a mapping of DID to Web3.Storage hash in localStorage as a fallback
      const hashKey = `web3storage_hash_${this.did}`;
      const hash = localStorage.getItem(hashKey);
      return hash || null;
    } catch (error) {
      console.error('Error getting credentials hash:', error);
      return null;
    }
  }

  /**
   * Store the Web3.Storage hash for this DID's credentials
   */
  private async storeCredentialsHash(hash: string): Promise<void> {
    try {
      const hashKey = `web3storage_hash_${this.did}`;
      localStorage.setItem(hashKey, hash);
    } catch (error) {
      console.error('Error storing credentials hash:', error);
    }
  }

  /**
   * Save a credential to Web3.Storage via server
   */
  async saveCredential(credential: VerifiableCredential): Promise<{ success: boolean }> {
    try {
      const credentials = await this.getAllCredentials();
      const newCredential: CredentialInfo = {
        data: credential,
        id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        meta: {
          id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          store: ['web3Storage']
        }
      };
      
      credentials.push(newCredential);
      await this.saveCredentialsToServer(credentials);
      
      return { success: true };
    } catch (error) {
      console.error('Error saving credential via server:', error);
      return { success: false };
    }
  }

  /**
   * Query all credentials from Web3.Storage via server
   */
  async queryCredentials(): Promise<{ data: VerifiableCredential[] }> {
    console.log('******************** queryCredentials via server');
    try {
      const credentials = await this.getAllCredentials();
      console.log('******************** queryCredentials', credentials);
      return {
        data: credentials.map(cred => cred.data)
      };
    } catch (error) {
      console.error('Error querying credentials via server:', error);
      return { data: [] };
    }
  }

  /**
   * Get a specific credential by entityId and displayName
   */
  async getCredential(entityId: string, displayName: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('******************** getCredential via server', entityId, displayName);
      
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
      console.error('Error getting credential via server:', error);
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
      await this.saveCredentialsToServer(filteredCredentials);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting credential via server:', error);
      return { success: false };
    }
  }

  /**
   * Clear all credentials
   */
  async clearAllCredentials(): Promise<{ success: boolean }> {
    try {
      await this.saveCredentialsToServer([]);
      return { success: true };
    } catch (error) {
      console.error('Error clearing credentials via server:', error);
      return { success: false };
    }
  }

  /**
   * Get all credentials from Web3.Storage via server
   */
  private async getAllCredentials(): Promise<CredentialInfo[]> {
    // Return cached credentials if available
    if (this.credentialsCache !== null) {
      return this.credentialsCache;
    }

    try {
      const hash = await this.getCredentialsHash();
      console.log('******************** web3storage getAllCredentials hash: ', hash);
      if (!hash) {
        this.credentialsCache = [];
        return [];
      }

      const data = await this.downloadFromServer(hash);
      console.log('******************** web3storage getAllCredentials data: ', data);
      this.credentialsCache = Array.isArray(data) ? data : [];
      return this.credentialsCache;
    } catch (error) {
      console.error('Error getting credentials via server:', error);
      this.credentialsCache = [];
      return [];
    }
  }

  /**
   * Save credentials to Web3.Storage via server
   */
  private async saveCredentialsToServer(credentials: CredentialInfo[]): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/web3storage/credentials/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentials,
          did: this.did
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }

      const result = await response.json();
      await this.storeCredentialsHash(result.cid);
      this.credentialsCache = credentials; // Update cache
      console.log('Credentials saved via server with hash:', result.cid);
    } catch (error) {
      console.error('Error saving credentials via server:', error);
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
   * Get the current Web3.Storage hash
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

  /**
   * Check if the server is available
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/`);
      return response.ok;
    } catch (error) {
      console.error('Server not available:', error);
      return false;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}/`);
      if (response.ok) {
        return { available: true, message: await response.text() };
      }
      return { available: false };
    } catch (error) {
      return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * Factory function to create a Server Web3.Storage Credential Manager
 */
export function createServerWeb3StorageCredentialManager(did?: string, config?: ServerWeb3StorageConfig): ServerWeb3StorageCredentialManager {
  return new ServerWeb3StorageCredentialManager(did, config);
} 