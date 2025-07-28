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
   * Save a credential to Web3.Storage via server
   */
  async saveCredential(credential: VerifiableCredential): Promise<string> {
    try {
      const credentials = []
      const newCredential: CredentialInfo = {
        data: credential,
        id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        meta: {
          id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          store: ['web3Storage']
        }
      };
      
      credentials.push(newCredential);
      const cid = await this.saveCredentialsToServer(credentials);
      console.log('******************** saveCredential cid: ', cid);
      
      return cid;
    } catch (error) {
      console.error('Error saving credential via server:', error);
      return '';
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

  async getCredentialWithVcid(vcId: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('******************** getCredential via server vcid', vcId);
      
      const result = await this.downloadFromServer(vcId);
      if (result && result.length > 0) {
        const cred = result[0].data
        return cred
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
    return []
  }

  /**
   * Save credentials to Web3.Storage via server
   */
  private async saveCredentialsToServer(credentials: CredentialInfo[]): Promise<string> {
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
      console.log('Credentials saved via server with cid:', result.cid); 
      return result.cid;
    } catch (error) {
      console.error('Error saving credentials via server:', error);
      throw error;
    }
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