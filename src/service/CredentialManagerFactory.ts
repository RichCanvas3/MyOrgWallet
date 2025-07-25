import { LocalStorageCredentialManager, createLocalStorageCredentialManager } from './LocalStorageCredentialManager';

export type CredentialManagerType = 'masca' | 'localStorage';

export interface CredentialManagerConfig {
  type: CredentialManagerType;
  did?: string;
  ownerAddress?: string;
}

export interface CredentialManager {
  getDID(): Promise<{ data: string; did: string }>;
  saveCredential(credential: any): Promise<{ success: boolean }>;
  queryCredentials(): Promise<{ data: any[] }>;
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
        return mascaApi;
        
      case 'localStorage':
        const localStorageManager = createLocalStorageCredentialManager(config.did);
        if (config.did) {
          localStorageManager.setDID(config.did);
        }
        return localStorageManager;
        
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
    if (envType === 'masca' || envType === 'localStorage') {
      return envType;
    }
    return 'localStorage'; // Default to localStorage
  }
} 