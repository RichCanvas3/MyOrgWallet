import { createWalletClient, custom, toHex, type Address } from "viem";
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
      console.info("request eth chainid");
      const selectedNetwork = await provider.request({ method: "eth_chainId" });
      console.info("request eth chainid selectedNetwork: ", selectedNetwork);
      if (parseInt(selectedNetwork) !== chain.id) {
        console.info("wrong chain selected, switching to: ", chain.id);
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: toHex(chain.id),
            },
          ],
        });
      }

      const [owner] = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];

      const walletClient = createWalletClient({
        chain,
        transport: custom(provider),
        account: owner,
      });



      return {
        owner,
        signatory: { walletClient},
      };
    };

    return { login, canLogout: () => false };
  };
