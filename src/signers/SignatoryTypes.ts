import { HybridSignatoryConfig } from "@metamask/delegation-toolkit";
import { WEB3AUTH_NETWORK } from "@web3auth/base";
import { Address, Chain } from "viem";
import { JsonRpcSigner, BrowserProvider } from "ethers";

export type SignatoryFactoryConfig = {
  web3AuthClientId: string;
  web3AuthNetwork: any;
  chain?: Chain;
  rpcUrl: string;
};

// Extended signatory config that includes a signer
export type ExtendedSignatoryConfig = HybridSignatoryConfig & {
  signer?: JsonRpcSigner;
};

export type SignatoryLoginFunction = () => Promise<{
  signatory: ExtendedSignatoryConfig;
  owner: Address;
}>;

export type SignatoryLogoutFunction = () => Promise<void>;

export type SignatoryFactory = {
  login: SignatoryLoginFunction;
  canLogout: () => boolean;
  isDisabled?: boolean;
  logout?: SignatoryLogoutFunction;
};

export type SignatoryFactoryConfigurator = (
  config: SignatoryFactoryConfig
) => SignatoryFactory;

// Helper function to get signer from any signatory
export const getSignerFromSignatory = async (signatory: any): Promise<JsonRpcSigner | undefined> => {
  // If signatory already has a signer, return it
  if (signatory.signer) {
    return signatory.signer;
  }

  // For Web3Auth: create signer from walletClient transport
  if (signatory.walletClient?.transport?.value) {
    const provider = signatory.walletClient.transport.value;
    const ethersProvider = new BrowserProvider(provider);
    return await ethersProvider.getSigner();
  }

  // For MetaMask: create signer from window.ethereum
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    const provider = new BrowserProvider((window as any).ethereum);
    return await provider.getSigner();
  }

  // For burner accounts or other cases, return undefined
  return undefined;
};

export const UnconfiguredSignatory: SignatoryFactory = {
  login: () => {
    throw new Error("Signatory not configured");
  },
  canLogout: () => false,
  isDisabled: true,
};
