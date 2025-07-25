# Credential Manager System

This system provides a unified interface for managing verifiable credentials with support for both MetaMask (masca) and localStorage storage backends.

## Features

- **Unified Interface**: Same API regardless of storage backend
- **Configurable**: Switch between storage types via environment variable
- **Fallback Support**: Automatically falls back to localStorage if masca fails
- **Type Safety**: Full TypeScript support

## Usage

### Configuration

Set the environment variable in your `.env` file:

```bash
# For localStorage (default)
VITE_CREDENTIAL_MANAGER_TYPE=localStorage

# For MetaMask masca
VITE_CREDENTIAL_MANAGER_TYPE=masca
```

### In Components

```typescript
import { useWallectConnectContext } from '../context/walletConnectContext';

function MyComponent() {
  const { credentialManager } = useWallectConnectContext();
  
  const saveCredential = async () => {
    if (credentialManager) {
      await credentialManager.saveCredential(myCredential);
    }
  };
  
  const getCredentials = async () => {
    if (credentialManager) {
      const result = await credentialManager.queryCredentials();
      console.log('Credentials:', result.data);
    }
  };
}
```

### Direct Usage

```typescript
import { CredentialManagerFactory } from './CredentialManagerFactory';
import { createLocalStorageCredentialManager } from './LocalStorageCredentialManager';

// Create a localStorage manager
const localStorageManager = createLocalStorageCredentialManager('did:example:123');

// Or use the factory
const manager = await CredentialManagerFactory.createDefaultCredentialManager(
  'localStorage',
  'did:example:123'
);

// Use the manager
await manager.saveCredential(credential);
const credentials = await manager.queryCredentials();
```

## API Reference

### LocalStorageCredentialManager

- `getDID()`: Returns current DID
- `setDID(did)`: Sets the DID for this manager
- `saveCredential(credential)`: Saves a credential
- `queryCredentials()`: Returns all credentials
- `getCredential(entityId, displayName)`: Gets specific credential
- `deleteCredential(id)`: Deletes a credential
- `clearAllCredentials()`: Clears all credentials
- `getStorageStats()`: Returns storage statistics

### CredentialManagerFactory

- `createCredentialManager(config, mascaApi)`: Creates manager with config
- `createDefaultCredentialManager(type, did, mascaApi)`: Creates with defaults
- `getDefaultCredentialManagerType()`: Gets type from environment

## Storage Format

### localStorage Structure

```json
{
  "myorgwallet_credentials_did:example:123": [
    {
      "data": {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": ["VerifiableCredential"],
        "issuer": "did:example:issuer",
        "credentialSubject": {
          "id": "did:example:subject",
          "provider": "entityId",
          "displayName": "displayName"
        }
      },
      "id": "cred_1234567890_abc123",
      "meta": {
        "id": "cred_1234567890_abc123",
        "store": ["localStorage"]
      }
    }
  ]
}
```

## Migration

To migrate from masca to localStorage:

1. Set `VITE_CREDENTIAL_MANAGER_TYPE=localStorage` in your `.env`
2. The system will automatically use localStorage
3. Existing credentials in MetaMask will need to be re-exported if needed

## Error Handling

The system includes comprehensive error handling:

- Automatic fallback to localStorage if masca fails
- Graceful handling of localStorage errors
- Console logging for debugging

## Performance

- localStorage is faster for read/write operations
- No network requests required
- Limited by browser storage quotas
- Data persists across sessions 