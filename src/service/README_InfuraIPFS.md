# Infura IPFS Credential Manager

The Infura IPFS Credential Manager provides the same capabilities as the LocalStorageCredentialManager but stores credentials on IPFS via Infura's IPFS service.

## Configuration

To use the Infura IPFS Credential Manager, you need to set the following environment variables in your `.env` file:

```env
# Credential Manager Type
VITE_CREDENTIAL_MANAGER_TYPE=infuraIPFS

# Infura IPFS Configuration
VITE_INFURA_IPFS_PROJECT_ID=your_infura_project_id
VITE_INFURA_IPFS_PROJECT_SECRET=your_infura_project_secret
VITE_INFURA_IPFS_ENDPOINT=https://ipfs.infura.io:5001
```

## Getting Infura IPFS Credentials

1. Go to [Infura](https://infura.io/)
2. Create an account or sign in
3. Create a new project
4. Go to the project settings
5. Navigate to the IPFS tab
6. Copy your Project ID and Project Secret
7. Add them to your `.env` file

## Features

- **Persistent Storage**: Credentials are stored on IPFS and persist across sessions
- **Decentralized**: No single point of failure
- **Caching**: Local caching for improved performance
- **Fallback**: Uses localStorage to store IPFS hashes for quick access
- **Same Interface**: Compatible with existing credential manager interface

## Usage

The Infura IPFS Credential Manager provides the same interface as the LocalStorageCredentialManager:

```typescript
import { createInfuraIPFSCredentialManager } from './InfuraIPFSCredentialManager';

const manager = createInfuraIPFSCredentialManager('did:example:123');

// Save a credential
await manager.saveCredential(verifiableCredential);

// Query all credentials
const result = await manager.queryCredentials();

// Get a specific credential
const credential = await manager.getCredential('entityId', 'displayName');

// Delete a credential
await manager.deleteCredential('credentialId');

// Clear all credentials
await manager.clearAllCredentials();
```

## Error Handling

The manager includes comprehensive error handling:

- Network errors are logged and handled gracefully
- Missing configuration shows a warning but doesn't break the application
- Failed operations return appropriate error responses
- Local caching helps with offline scenarios

## Performance Considerations

- Credentials are cached locally for faster access
- IPFS operations are asynchronous and may take time
- Large credential sets may impact performance
- Consider implementing pagination for large datasets

## Security

- Credentials are encrypted in transit
- Infura IPFS uses HTTPS for all communications
- Project credentials should be kept secure
- Consider using environment-specific credentials for different environments

## Troubleshooting

### Common Issues

1. **"Infura IPFS credentials not configured"**
   - Ensure `VITE_INFURA_IPFS_PROJECT_ID` and `VITE_INFURA_IPFS_PROJECT_SECRET` are set
   - Verify your Infura project is active

2. **"IPFS upload failed"**
   - Check your network connection
   - Verify your Infura project has IPFS enabled
   - Ensure your project has sufficient quota

3. **"IPFS download failed"**
   - The hash may be invalid or the data may have been removed
   - Check if the IPFS node is accessible
   - Verify the hash is correct

### Debug Mode

Enable debug logging by setting:

```env
VITE_DEBUG_IPFS=true
```

This will log detailed information about IPFS operations. 