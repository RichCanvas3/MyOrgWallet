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

export class LocalStorageCredentialManager {
  private did: string;
  private storagePrefix: string;

  constructor(did?: string) {
    this.did = did || 'local-did';
    this.storagePrefix = 'myorgwallet_credentials_';
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
   * Save a credential to localStorage
   */
  async saveCredential(credential: VerifiableCredential): Promise<string> {
    try {
      const credentials = this.getAllCredentials();
      const newCredential: CredentialInfo = {
        data: credential,
        id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        meta: {
          id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          store: ['localStorage']
        }
      };
      
      credentials.push(newCredential);
      this.saveCredentialsToStorage(credentials);

      const vcId = credential.credentialSubject.provider + "-" + credential.credentialSubject.displayName + "-" + this.did;
      
      return vcId;
    } catch (error) {
      console.error('Error saving credential to localStorage:', error);
      return '';
    }
  }

  /**
   * Query all credentials from localStorage
   */
  async queryCredentials(): Promise<{ data: VerifiableCredential[] }> {
    console.log('******************** queryCredentials');
    try {
      const credentials = this.getAllCredentials();
      console.log('******************** queryCredentials', credentials);
      return {
        data: credentials.map(cred => cred.data)
      };
    } catch (error) {
      console.error('Error querying credentials from localStorage:', error);
      return { data: [] };
    }
  }

  async getCredentialWithVcid(vcId: string): Promise<VerifiableCredential | undefined> {
    try {
      const credentials = this.getAllCredentials();
      console.log('******************** getCredentialWithVcid', credentials);
    }
  }

  /**
   * Get a specific credential by entityId and displayName
   */
  async getCredential(entityId: string, displayName: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('******************** getCredential', entityId, displayName);
      const credentials = this.getAllCredentials();
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
      console.error('Error getting credential from localStorage:', error);
      return undefined;
    }
  }

  /**
   * Delete a credential by ID
   */
  async deleteCredential(credentialId: string): Promise<{ success: boolean }> {
    try {
      const credentials = this.getAllCredentials();
      const filteredCredentials = credentials.filter(cred => cred.id !== credentialId);
      this.saveCredentialsToStorage(filteredCredentials);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting credential from localStorage:', error);
      return { success: false };
    }
  }

  /**
   * Clear all credentials for this DID
   */
  async clearAllCredentials(): Promise<{ success: boolean }> {
    try {
      localStorage.removeItem(`${this.storagePrefix}${this.did}`);
      return { success: true };
    } catch (error) {
      console.error('Error clearing credentials from localStorage:', error);
      return { success: false };
    }
  }

  /**
   * Get all credentials from localStorage for this DID
   */
  private getAllCredentials(): CredentialInfo[] {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}${this.did}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading credentials from localStorage:', error);
      return [];
    }
  }

  /**
   * Save credentials to localStorage for this DID
   */
  private saveCredentialsToStorage(credentials: CredentialInfo[]): void {
    try {
      localStorage.setItem(`${this.storagePrefix}${this.did}`, JSON.stringify(credentials));
    } catch (error) {
      console.error('Error saving credentials to localStorage:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): { totalCredentials: number; storageSize: number } {
    const credentials = this.getAllCredentials();
    const storageKey = `${this.storagePrefix}${this.did}`;
    const storageSize = localStorage.getItem(storageKey)?.length || 0;
    
    return {
      totalCredentials: credentials.length,
      storageSize
    };
  }
}

/**
 * Factory function to create a LocalStorageCredentialManager
 */
export function createLocalStorageCredentialManager(did?: string): LocalStorageCredentialManager {
  return new LocalStorageCredentialManager(did);
} 