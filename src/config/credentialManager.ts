import { CredentialManagerType } from '../service/CredentialManagerFactory';

/**
 * Configuration for credential management
 * 
 * Set VITE_CREDENTIAL_MANAGER_TYPE in your .env file to:
 * - 'masca' for MetaMask credential storage
 * - 'localStorage' for browser localStorage (default)
 */
export const CREDENTIAL_MANAGER_CONFIG = {
  // Default type if not specified in environment
  DEFAULT_TYPE: 'localStorage' as CredentialManagerType,
  
  // Environment variable name
  ENV_VAR_NAME: 'VITE_CREDENTIAL_MANAGER_TYPE',
  
  // Get the current type from environment or use default
  getCurrentType(): CredentialManagerType {
    const envType = import.meta.env.VITE_CREDENTIAL_MANAGER_TYPE;
    if (envType === 'masca' || envType === 'localStorage') {
      return envType;
    }
    return this.DEFAULT_TYPE;
  },
  
  // Check if using localStorage
  isLocalStorage(): boolean {
    return this.getCurrentType() === 'localStorage';
  },
  
  // Check if using masca
  isMasca(): boolean {
    return this.getCurrentType() === 'masca';
  }
};

/**
 * Helper function to get credential manager type
 */
export function getCredentialManagerType(): CredentialManagerType {
  return CREDENTIAL_MANAGER_CONFIG.getCurrentType();
} 