import { WEB3_AUTH_CLIENT_ID, WEB3_AUTH_NETWORK } from '../config';
import { Web3Auth } from '@web3auth/modal';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { createWalletClient, custom, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_URL,  ETHERSCAN_API_KEY, ETHERSCAN_URL, EAS_URL } from "../config";

class Web3AuthService {
  private static web3Auth: Web3Auth | null = null;
  private static isInitialized = false;

  /**
   * Initialize Web3Auth
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if Web3Auth is properly configured
      if (!WEB3_AUTH_CLIENT_ID || WEB3_AUTH_CLIENT_ID === 'undefined') {
        throw new Error('Web3Auth client ID not configured');
      }

      if (!WEB3_AUTH_NETWORK || WEB3_AUTH_NETWORK === 'undefined') {
        throw new Error('Web3Auth network not configured');
      }

      // Validate network configuration
      const validNetworks = ['mainnet', 'sapphire_mainnet', 'sapphire_devnet', 'testnet', 'cyan', 'aqua'];
      if (!validNetworks.includes(WEB3_AUTH_NETWORK)) {
        throw new Error(`Invalid Web3Auth network: ${WEB3_AUTH_NETWORK}. Valid options are: ${validNetworks.join(', ')}`);
      }

      // Network validation (warning removed for development)
      if (WEB3_AUTH_NETWORK === 'sapphire_devnet') {
        // Warning suppressed for development environment
      }

      // Log the chain configuration for Sepolia
      console.log('🌐 Web3Auth configured for Sepolia testnet (Chain ID: 0xaa36a7)');

      // Initialize Web3Auth
      this.web3Auth = new Web3Auth({
        clientId: WEB3_AUTH_CLIENT_ID,
        web3AuthNetwork: WEB3_AUTH_NETWORK as any,
        chainConfig: {
          chainNamespace: 'eip155',
          chainId: '0xaa36a7', // Sepolia testnet
          rpcTarget: RPC_URL,
        },
        privateKeyProvider: new EthereumPrivateKeyProvider({
          config: {
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: '0xaa36a7', // Sepolia testnet
              rpcTarget: RPC_URL,
            },
          },
        }),
      });

      await this.web3Auth.initModal();
      this.isInitialized = true;
      console.log('Web3Auth initialized successfully with network:', WEB3_AUTH_NETWORK);
    } catch (error) {
      console.error('Failed to initialize Web3Auth:', error);
      throw error;
    }
  }

  /**
   * Connect using email/password authentication (sign in or sign up)
   */
  static async connectWithEmailPassword(email: string, password: string, isSignUp: boolean = false): Promise<any> {

      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.web3Auth) {
        throw new Error('Web3Auth not initialized');
      }

      try {
        // Connect using email/password
        await this.web3Auth.connect();
        
        if (!this.web3Auth.connected) {
          throw new Error('Failed to connect to Web3Auth');
        }

        const provider = this.web3Auth.provider;
        if (!provider) {
          throw new Error('Web3Auth provider not available');
        }

        // Get the private key using the correct Web3Auth method
        let privateKey: string;
        try {
          privateKey = await provider.request({ method: 'private_key' }) as string;
        } catch (error) {
          console.log('Failed to get private key with "private_key" method, trying "eth_private_key"...');
          try {
            privateKey = await provider.request({ method: 'eth_private_key' }) as string;
          } catch (error2) {
            console.log('Failed to get private key with "eth_private_key" method, trying "getPrivateKey"...');
            try {
              privateKey = await provider.request({ method: 'getPrivateKey' }) as string;
            } catch (error3) {
              console.error('All private key methods failed:', { error, error2, error3 });
              throw new Error('Failed to get private key from Web3Auth provider');
            }
          }
        }
        
        console.log('Raw private key from Web3Auth:', privateKey);
        console.log('Private key type:', typeof privateKey);
        console.log('Private key length:', privateKey.length);
        
                // Ensure the private key has the correct format
        let formattedPrivateKey = privateKey;
        if (!privateKey.startsWith('0x')) {
          formattedPrivateKey = `0x${privateKey}`;
        }
        
        // Validate the private key format
        if (formattedPrivateKey.length !== 66) { // 0x + 64 hex characters
          console.error('Invalid private key length:', formattedPrivateKey.length);
          console.error('Expected 66 characters (0x + 64 hex), got:', formattedPrivateKey.length);
          throw new Error(`Invalid private key length: ${formattedPrivateKey.length}. Expected 66 characters.`);
        }
        
        // Validate that it's a valid hex string
        if (!/^0x[0-9a-fA-F]{64}$/.test(formattedPrivateKey)) {
          console.error('Invalid private key format. Expected hex string with 64 characters after 0x.');
          throw new Error('Invalid private key format. Expected hex string.');
        }
        
        console.log('Formatted private key:', formattedPrivateKey);
        console.log('Formatted private key length:', formattedPrivateKey.length);
        console.log('Private key format validation passed');
        
        // Create viem account from private key
        try {
          const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
          
          // Create wallet client
          const walletClient = createWalletClient({
            account,
            transport: custom(provider),
          });

          // Get the address
          const address = account.address;
          
          console.log('Successfully created viem account:', address);

                    const action = isSignUp ? 'created' : 'connected';
          console.log(`Web3Auth ${action} successfully with email/password`);
          console.log('Address:', address);

          // Get user information including email
          let userInfo = null;
          try {
            userInfo = await this.web3Auth.getUserInfo();
            console.log('Web3Auth user info:', userInfo);
          } catch (error) {
            console.log('Could not retrieve user info from Web3Auth:', error);
          }

          return {
            address,
            provider,
            walletClient,
            account,
            privateKey: formattedPrivateKey,
            isNewAccount: isSignUp,
            userInfo
          };
        } catch (accountError) {
          console.error('Error creating viem account from private key:', accountError);
          console.error('Private key that caused the error:', formattedPrivateKey);
          throw new Error(`Failed to create viem account: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
        }
    } catch (error) {
      console.error('Web3Auth email/password connection error:', error);
      throw error;
    }
  }

  /**
   * Check if an account exists for the given email
   */
  static async checkAccountExists(email: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.web3Auth) {
      throw new Error('Web3Auth not initialized');
    }

    try {
      // This is a simplified check - in a real implementation, you might want to
      // check against your backend or Web3Auth's user management
      // For now, we'll assume the account doesn't exist and let Web3Auth handle it
      return false;
    } catch (error) {
      console.error('Error checking account existence:', error);
      return false;
    }
  }

  /**
   * Connect using social login (Google, etc.)
   */
  static async connect(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.web3Auth) {
      throw new Error('Web3Auth not initialized');
    }

    try {
      console.log('Attempting to connect to Web3Auth...');
      console.log('Web3Auth instance:', this.web3Auth);
      
      // Open the Web3Auth modal
      console.log('About to call web3Auth.connect()...');
      
      // Check if already connected
      if (this.web3Auth.connected) {
        console.log('Web3Auth already connected');
      } else {
        console.log('Web3Auth not connected, attempting to connect...');
        await this.web3Auth.connect();
        console.log('Web3Auth connect() called');
      }
      
      console.log('Web3Auth modal call completed');
      
      console.log('Web3Auth connect() called, checking connection status...');
      
      if (!this.web3Auth.connected) {
        throw new Error('Failed to connect to Web3Auth');
      }

      const provider = this.web3Auth.provider;
      if (!provider) {
        throw new Error('Web3Auth provider not available');
      }

      // Get the private key using the correct Web3Auth method
      const privateKey = await provider.request({ method: 'private_key' }) as string;
      
      // Ensure the private key has the correct format
      let formattedPrivateKey = privateKey;
      if (!privateKey.startsWith('0x')) {
        formattedPrivateKey = `0x${privateKey}`;
      }
      
      // Create viem account from private key
      const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
      
      // Create wallet client
      const walletClient = createWalletClient({
        account,
        transport: custom(provider),
      });

      // Get the address
      const address = account.address;

      console.log('Web3Auth connected successfully');
      console.log('Address:', address);

      // Get user information including email
      let userInfo = null;
      try {
        userInfo = await this.web3Auth.getUserInfo();
        console.log('Web3Auth user info:', userInfo);
      } catch (error) {
        console.log('Could not retrieve user info from Web3Auth:', error);
      }

      return {
        address,
        provider,
        walletClient,
        account,
        privateKey: formattedPrivateKey,
        userInfo
      };
    } catch (error) {
      console.error('Web3Auth connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Web3Auth
   */
  static async disconnect(): Promise<void> {
    if (this.web3Auth && this.web3Auth.connected) {
      await this.web3Auth.logout();
      console.log('Web3Auth disconnected');
    }
  }

  /**
   * Check if connected
   */
  static isConnected(): boolean {
    return this.web3Auth?.connected || false;
  }

  /**
   * Get the connected address
   */
  static getAddress(): string | null {
    if (!this.web3Auth?.connected) {
      return null;
    }
    
    // This would need to be implemented based on how you store the address
    // For now, return null
    return null;
  }
}

export default Web3AuthService; 