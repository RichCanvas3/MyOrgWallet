import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3Auth } from "@web3auth/modal";
import { createWalletClient, custom, toHex, type Address } from "viem";
import { ethers } from "ethers";
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

    const provider = web3auth.provider!;

    const [owner] = (await provider.request({
      method: "eth_accounts",
    })) as Address[];

    const walletClient = createWalletClient({
      chain,
      transport: custom(provider),
      account: owner,
    });

    // Create ethers signer from the Web3Auth provider
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();

    return {
      owner,
      signatory: { 
        walletClient,
        signer, // Add the signer to the signatory
      },
    };
  };

  const logout = async () => {
    await web3auth.logout();
  };

  return {
    login,
    logout,
    canLogout: () => web3auth.connected,
  };
};
