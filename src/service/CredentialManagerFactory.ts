import { LocalStorageCredentialManager, createLocalStorageCredentialManager } from './LocalStorageCredentialManager';
import { InfuraIPFSCredentialManager, createInfuraIPFSCredentialManager } from './InfuraIPFSCredentialManager';
import { ServerWeb3StorageCredentialManager, createServerWeb3StorageCredentialManager } from './ServerWeb3StorageCredentialManager';
import { MascaCredentialManager, createMascaCredentialManager } from './MascaCredentialManager';

export type CredentialManagerType = 'masca' | 'localStorage' | 'infuraIPFS' | 'serverWeb3Storage';

export interface CredentialManagerConfig {
  type: CredentialManagerType;
  did?: string;
  ownerAddress?: string;
}

export interface CredentialManager {
  getDID(): Promise<{ data: string; did: string }>;
  setDID(did: string): void;
  saveCredential(credential: any): Promise<string>;
  queryCredentials(): Promise<{ data: any[] }>;
  getCredential(entityId: string, displayName: string): Promise<any | undefined>;
  getCredentialWithVcid(vcId: string): Promise<any | undefined>;
  deleteCredential(credentialId: string): Promise<{ success: boolean }>;
  clearAllCredentials(): Promise<{ success: boolean }>;
  getStorageStats(): { totalCredentials: number; storageSize: number };
  getCurrentHash(): Promise<string | null>;
  clearCache(): void;
}

/**
 * Factory class to create credential managers
 */
export class CredentialManagerFactory {
  /**
   * Create a credential manager based on configuration
   */
  static async createCredentialManager(
    config: CredentialManagerConfig,
    mascaApi?: any
  ): Promise<CredentialManager> {
    switch (config.type) {
      case 'masca':
        if (!mascaApi) {
          throw new Error('MascaApi is required for masca credential manager type');
        }
        return createMascaCredentialManager(mascaApi, config.did, config);
        
      case 'localStorage':
        const localStorageManager = createLocalStorageCredentialManager(config.did);
        if (config.did) {
          localStorageManager.setDID(config.did);
        }
        return localStorageManager;
        
      case 'infuraIPFS':
        const infuraIPFSManager = createInfuraIPFSCredentialManager(config.did);
        if (config.did) {
          infuraIPFSManager.setDID(config.did);
        }
        return infuraIPFSManager;
        

        
      case 'serverWeb3Storage':
        const serverWeb3StorageManager = createServerWeb3StorageCredentialManager(config.did);
        if (config.did) {
          serverWeb3StorageManager.setDID(config.did);
        }
        return serverWeb3StorageManager;
        
      default:
        throw new Error(`Unknown credential manager type: ${config.type}`);
    }
  }

  /**
   * Create a credential manager with default configuration
   */
  static async createDefaultCredentialManager(
    type: CredentialManagerType = 'localStorage',
    did?: string,
    mascaApi?: any
  ): Promise<CredentialManager> {
    return this.createCredentialManager({
      type,
      did
    }, mascaApi);
  }

  /**
   * Get the current credential manager type from environment or default to localStorage
   */
  static getDefaultCredentialManagerType(): CredentialManagerType {
    const envType = import.meta.env.VITE_CREDENTIAL_MANAGER_TYPE;
    if (envType === 'masca' || envType === 'localStorage' || envType === 'infuraIPFS' || envType === 'serverWeb3Storage') {
      return envType;
    }
    return 'localStorage'; // Default to localStorage
  }
} 