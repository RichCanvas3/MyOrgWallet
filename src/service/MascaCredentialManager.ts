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

export interface MascaCredentialManagerConfig {
  did?: string;
}

export class MascaCredentialManager {
  private did: string;
  private mascaApi: any;
  private config: MascaCredentialManagerConfig;

  constructor(mascaApi: any, did?: string, config?: MascaCredentialManagerConfig) {
    this.mascaApi = mascaApi;
    this.did = did || 'local-did';
    this.config = config || {};
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
   * Save a credential using Masca API
   */
  async saveCredential(credential: VerifiableCredential): Promise<string> {
    try {
      console.log('📝 Saving credential via Masca API...');
      
      // Use Masca API to save the credential
      const result = await this.mascaApi.saveCredential(credential);
      
      // Generate a consistent vcId like other managers
      const vcId = (credential.credentialSubject as any).provider + "-" + 
                   (credential.credentialSubject as any).displayName + "-" + 
                   this.did;
      
      console.log('✅ Credential saved via Masca API with vcId:', vcId);
      return vcId;
    } catch (error) {
      console.error('Error saving credential via Masca API:', error);
      return '';
    }
  }

  /**
   * Query all credentials using Masca API
   */
  async queryCredentials(): Promise<{ data: VerifiableCredential[] }> {
    console.log('🔍 Querying credentials via Masca API...');
    try {
      // Use Masca API to query credentials
      const credentials = await this.mascaApi.queryCredentials();
      console.log('✅ Credentials queried via Masca API:', credentials);
      return {
        data: credentials || []
      };
    } catch (error) {
      console.error('Error querying credentials via Masca API:', error);
      return { data: [] };
    }
  }

  /**
   * Get a specific credential by vcId
   */
  async getCredentialWithVcid(vcId: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('🔍 Getting credential via Masca API with vcId:', vcId);
      
      // Parse vcId to get provider and displayName
      const parts = vcId.split('-');
      if (parts.length >= 3) {
        const provider = parts[0];
        const displayName = parts[1];
        return await this.getCredential(provider, displayName);
      }
      
      console.log('❌ Invalid vcId format:', vcId);
      return undefined;
    } catch (error) {
      console.error('Error getting credential via Masca API with vcId:', error);
      return undefined;
    }
  }

  /**
   * Get a specific credential by entityId and displayName
   */
  async getCredential(entityId: string, displayName: string): Promise<VerifiableCredential | undefined> {
    try {
      console.log('🔍 Getting credential via Masca API:', entityId, displayName);
      
      // Use Masca API to get specific credential
      const credential = await this.mascaApi.getCredential(entityId, displayName);
      
      if (credential) {
        console.log('✅ Credential found via Masca API');
        return credential;
      }
      
      console.log('❌ Credential not found via Masca API');
      return undefined;
    } catch (error) {
      console.error('Error getting credential via Masca API:', error);
      return undefined;
    }
  }

  /**
   * Delete a credential by ID
   */
  async deleteCredential(credentialId: string): Promise<{ success: boolean }> {
    try {
      console.log('🗑️ Deleting credential via Masca API:', credentialId);
      
      // Use Masca API to delete credential
      await this.mascaApi.deleteCredential(credentialId);
      
      console.log('✅ Credential deleted via Masca API');
      return { success: true };
    } catch (error) {
      console.error('Error deleting credential via Masca API:', error);
      return { success: false };
    }
  }

  /**
   * Clear all credentials
   */
  async clearAllCredentials(): Promise<{ success: boolean }> {
    try {
      console.log('🧹 Clearing all credentials via Masca API...');
      
      // Use Masca API to clear all credentials
      await this.mascaApi.clearAllCredentials();
      
      console.log('✅ All credentials cleared via Masca API');
      return { success: true };
    } catch (error) {
      console.error('Error clearing credentials via Masca API:', error);
      return { success: false };
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): { totalCredentials: number; storageSize: number } {
    // Masca doesn't provide direct storage stats, so we'll return estimates
    return {
      totalCredentials: 0, // Would need to query to get actual count
      storageSize: 0 // Masca storage size is not directly accessible
    };
  }

  /**
   * Get current hash (not applicable for Masca)
   */
  async getCurrentHash(): Promise<string | null> {
    // Masca doesn't use hashes in the same way
    return null;
  }

  /**
   * Clear cache (not applicable for Masca)
   */
  clearCache(): void {
    // Masca handles caching internally
    console.log('🔄 Cache cleared for Masca API');
  }

  /**
   * Check if Masca API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to access a basic Masca API method
      await this.mascaApi.getSnapSettings();
      return true;
    } catch (error) {
      console.error('Masca API not available:', error);
      return false;
    }
  }

  /**
   * Get Masca API info
   */
  async getInfo(): Promise<any> {
    try {
      const settings = await this.mascaApi.getSnapSettings();
      return {
        type: 'masca',
        available: true,
        settings: settings
      };
    } catch (error) {
      console.error('Error getting Masca info:', error);
      return {
        type: 'masca',
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the underlying Masca API instance
   */
  getMascaApi(): any {
    return this.mascaApi;
  }
}

/**
 * Factory function to create a MascaCredentialManager
 */
export function createMascaCredentialManager(
  mascaApi: any, 
  did?: string, 
  config?: MascaCredentialManagerConfig
): MascaCredentialManager {
  return new MascaCredentialManager(mascaApi, did, config);
} 