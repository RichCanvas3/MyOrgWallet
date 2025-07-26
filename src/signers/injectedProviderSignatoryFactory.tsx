import { createWalletClient, custom, toHex, type Address } from "viem";
import { createConfig } from 'wagmi'
import { optimism, linea, sepolia } from "viem/chains";
import { ethers } from "ethers";

import {
  UnconfiguredSignatory,
  type SignatoryFactoryConfig,
  type SignatoryFactoryConfigurator,
} from "./SignatoryTypes";

export const createInjectedProviderSignatoryFactory: SignatoryFactoryConfigurator =
  (config: SignatoryFactoryConfig) => {

    const { chain } = config;
    const provider = (window as any).ethereum;

    if (!provider) {
      return UnconfiguredSignatory;
    }

    const login = async () => {
      console.info("*********** login ****************");
      const selectedNetwork = await provider.request({ method: "eth_chainId" });
      if (chain && parseInt(selectedNetwork) !== chain.id) {
        console.info("wrong chain selected, switching to: ", chain.id);
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [
              {
                chainId: toHex(chain.id),
              },
            ],
          });
        } catch (switchError: any) {
          // If the network doesn't exist (error code 4902), add it
          if (switchError.code === 4902) {
            console.info("Chain not found, adding to MetaMask");
            
            let chainConfig;
            if (chain.id === optimism.id) {
              chainConfig = {
                chainId: toHex(optimism.id),
                chainName: optimism.name,
                nativeCurrency: optimism.nativeCurrency,
                rpcUrls: [optimism.rpcUrls.default.http[0]],
                blockExplorerUrls: [optimism.blockExplorers?.default.url],
              };
            } else if (chain.id === linea.id) {
              chainConfig = {
                chainId: toHex(linea.id),
                chainName: linea.name,
                nativeCurrency: linea.nativeCurrency,
                rpcUrls: [linea.rpcUrls.default.http[0]],
                blockExplorerUrls: [linea.blockExplorers?.default.url],
              };
            } else if (chain.id === sepolia.id) {
              chainConfig = {
                chainId: toHex(sepolia.id),
                chainName: sepolia.name,
                nativeCurrency: sepolia.nativeCurrency,
                rpcUrls: [sepolia.rpcUrls.default.http[0]],
                blockExplorerUrls: [sepolia.blockExplorers?.default.url],
              };
            } else {
              throw new Error(`Unsupported chain: ${chain.id}`);
            }

            await provider.request({
              method: "wallet_addEthereumChain",
              params: [chainConfig],
            });
          } else {
            throw switchError;
          }
        }
      }

      const [owner] = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];

      const walletClient = createWalletClient({
        chain,
        transport: custom(provider),
        account: owner,
      });

      // Create ethers signer from MetaMask provider
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      console.info("***************** injectedProviderSignatoryFactory login done: ", owner, signer)

      return {
        owner,
        signatory: { 
          walletClient,
          signer
        },
      };
    };

    const logout = async () => {
      // For MetaMask, the actual disconnect is handled by wagmi's useDisconnect in the wallet context
      console.info("MetaMask logout - handled by wagmi disconnect in wallet context");
    };

    return { 
      login, 
      logout,
      canLogout: () => true 
    };
  };
