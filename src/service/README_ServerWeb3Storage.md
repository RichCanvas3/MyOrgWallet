# Server-Based Web3.Storage Credential Manager

The Server-Based Web3.Storage Credential Manager provides the same capabilities as the LocalStorageCredentialManager but stores credentials on Web3.Storage via a server-side API. This approach solves browser compatibility issues and provides better security.

## Architecture

```
Client (Browser) ←→ Server (Node.js) ←→ Web3.Storage (IPFS)
```

## Benefits

### 1. **No Browser Compatibility Issues**
- Web3.Storage w3up client runs on the server where Node.js is available
- No need for complex polyfills or bundling workarounds
- Clean separation between client and storage logic

### 2. **Better Security**
- Web3.Storage credentials stay on the server
- No exposure of API keys in client-side code
- Centralized credential management

### 3. **Improved Performance**
- Server can cache Web3.Storage operations
- Reduced client-side bundle size
- Better error handling and retry logic

### 4. **Easier Maintenance**
- Single point of configuration
- Consistent behavior across all clients
- Easier to update Web3.Storage integration

## Server Configuration

### 1. **Install Dependencies**

Add to your `server.js` dependencies:

```bash
npm install @web3-storage/w3up-client
```

### 2. **Environment Variables**

Add to your server's `.env` file:

```env
# Web3.Storage Configuration
WEB3_STORAGE_EMAIL=your_email@example.com
WEB3_STORAGE_SPACE_DID=did:key:your_space_did_here
```

### 3. **Server Integration**

The server already includes the Web3.Storage integration with these endpoints:

- `POST /api/web3storage/upload` - Upload data to Web3.Storage
- `GET /api/web3storage/download/:cid` - Download data from Web3.Storage
- `POST /api/web3storage/credentials/save` - Save credentials
- `GET /api/web3storage/credentials/:did` - Get credentials for a DID
- `DELETE /api/web3storage/credentials/:did` - Delete credentials for a DID

## Client Configuration

### 1. **Environment Variables**

Add to your client's `.env` file:

```env
# Credential Manager Type
VITE_CREDENTIAL_MANAGER_TYPE=serverWeb3Storage

# Server URL (optional, defaults to http://localhost:4000)
VITE_SERVER_URL=http://localhost:4000
```

### 2. **Usage**

The client automatically uses the server-based manager when configured:

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

## API Endpoints

### Upload Data
```http
POST /api/web3storage/upload
Content-Type: application/json

{
  "data": { "your": "data" },
  "filename": "credentials.json"
}
```

**Response:**
```json
{
  "success": true,
  "cid": "bafybeih...",
  "url": "https://bafybeih....ipfs.w3s.link"
}
```

### Download Data
```http
GET /api/web3storage/download/:cid
```

**Response:**
```json
{
  "success": true,
  "data": { "your": "data" }
}
```

### Save Credentials
```http
POST /api/web3storage/credentials/save
Content-Type: application/json

{
  "credentials": [...],
  "did": "did:example:123"
}
```

**Response:**
```json
{
  "success": true,
  "cid": "bafybeih...",
  "url": "https://bafybeih....ipfs.w3s.link"
}
```

## Features

- **Server-Side Web3.Storage**: All Web3.Storage operations happen on the server
- **Client-Side Caching**: Local caching for improved performance
- **Hash Management**: localStorage stores IPFS hashes for quick access
- **Same Interface**: Compatible with existing credential manager interface
- **Error Handling**: Comprehensive error handling and fallbacks
- **Server Health Checks**: Built-in server availability checking

## Error Handling

The manager includes comprehensive error handling:

- Network errors are logged and handled gracefully
- Server unavailability is detected and logged
- Failed operations return appropriate error responses
- Local caching helps with offline scenarios
- Automatic retry logic for transient failures

## Performance Considerations

- Credentials are cached locally for faster access
- Server operations are asynchronous and may take time
- Large credential sets may impact performance
- Consider implementing pagination for large datasets
- Server-side caching can improve performance

## Security

- Credentials are encrypted in transit
- Web3.Storage credentials stay on the server
- HTTPS is used for all communications
- Server-side validation prevents malicious requests
- Centralized access control

## Troubleshooting

### Common Issues

1. **"Server not available"**
   - Ensure the server is running on the correct port
   - Check the server URL configuration
   - Verify network connectivity

2. **"Web3.Storage not available"**
   - Check server environment variables
   - Verify Web3.Storage credentials
   - Check server logs for initialization errors

3. **"Upload failed"**
   - Check server logs for detailed error messages
   - Verify Web3.Storage account has sufficient quota
   - Ensure data format is correct

4. **"Download failed"**
   - The hash may be invalid or the data may have been removed
   - Check if the Web3.Storage gateway is accessible
   - Verify the hash is correct

### Debug Mode

Enable debug logging by setting:

```env
VITE_DEBUG_SERVER_WEB3STORAGE=true
```

This will log detailed information about server communications.

## Migration from Other Storage Options

To migrate from other storage options to server-based Web3.Storage:

1. **Update environment variable**:
   ```env
   VITE_CREDENTIAL_MANAGER_TYPE=serverWeb3Storage
   ```

2. **Configure server environment variables**:
   ```env
   WEB3_STORAGE_EMAIL=your_email@example.com
   WEB3_STORAGE_SPACE_DID=did:key:your_space_did
   ```

3. **Restart both client and server**

4. **Verify functionality**:
   ```typescript
   const { credentialManager } = useWallectConnectContext();
   console.log('Manager type:', credentialManager.constructor.name);
   ```

## Comparison with Other Storage Options

| Feature | localStorage | Infura IPFS | Server Web3.Storage |
|---------|-------------|-------------|-------------------|
| Browser Compatibility | ✅ | ✅ | ✅ |
| Security | Medium | High | High |
| Setup Complexity | Low | Medium | Medium |
| Performance | Fast | Medium | Fast |
| Reliability | High | High | High |
| Server Required | No | No | Yes |

## API Reference

### ServerWeb3StorageCredentialManager

- `getDID()`: Returns current DID
- `setDID(did)`: Sets the DID for this manager
- `saveCredential(credential)`: Saves a credential via server
- `queryCredentials()`: Returns all credentials via server
- `getCredential(entityId, displayName)`: Gets specific credential
- `deleteCredential(id)`: Deletes a credential
- `clearAllCredentials()`: Clears all credentials
- `getStorageStats()`: Returns storage statistics
- `getCurrentHash()`: Returns current Web3.Storage hash
- `clearCache()`: Clears local cache
- `isServerAvailable()`: Checks if server is available
- `getServerInfo()`: Gets server information 