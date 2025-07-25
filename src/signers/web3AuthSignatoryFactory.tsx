import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3Auth } from "@web3auth/modal";
import { createWalletClient, custom, toHex, type Address } from "viem";
import { ethers } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import type {
  SignatoryFactoryConfig,
  SignatoryFactoryConfigurator,
} from "./SignatoryTypes";

export const createWeb3AuthSignatoryFactory: SignatoryFactoryConfigurator = (
  config: SignatoryFactoryConfig
) => {
  const { chain, rpcUrl } = config;
  
  if (!chain) {
    throw new Error("Chain is required for Web3Auth signatory factory");
  }

  const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: toHex(chain.id),
    rpcTarget: rpcUrl,
  };

  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
  });

  const web3auth = new Web3Auth({
    clientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork,
    privateKeyProvider,
  });

  const isInitialised = web3auth.initModal();

  const login = async () => {
    await isInitialised;

    await web3auth.connect();

    if (!web3auth.connected) {
      throw new Error("Failed to connect web3auth");
    }

    console.info("************* web3auth.connected: ", web3auth.connected);
    const provider = web3auth.provider!;

    // Get the private key from Web3Auth provider
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

    // Ensure the private key has the correct format
    let formattedPrivateKey = privateKey;
    if (!privateKey.startsWith('0x')) {
      formattedPrivateKey = `0x${privateKey}`;
    }

    // Create viem account from private key
    const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
    const accountOwnerAddress = account.address;

    // Create a custom transport that uses Web3Auth provider directly
    const customTransport = custom(provider);

    const walletClient = createWalletClient({
      chain,
      transport: customTransport,
      account: accountOwnerAddress,
    });

    // Create ethers signer from the Web3Auth provider directly
    // Don't use BrowserProvider as it might interface with MetaMask
    const ethersProvider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(formattedPrivateKey, ethersProvider);

    return {
      owner: accountOwnerAddress, 
      signatory: { 
        walletClient,
        signer
      },
    };
  };

  const logout = async () => {
    await web3auth.logout();
  };

  return {
    login,
    logout,
    canLogout: () => {
      console.info("************* canLogout: ", web3auth.connected);
      return web3auth.connected;
    },
  };
};
