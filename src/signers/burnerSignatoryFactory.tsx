import type {
    SignatoryFactoryConfig,
    SignatoryFactoryConfigurator,
  } from "./SignatoryTypes";
  
  import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
  
  export const createBurnerSignatoryFactory: SignatoryFactoryConfigurator = (
    config: SignatoryFactoryConfig
  ) => {
    return {
      login: async () => {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);
  
        return {
          signatory: { 
            account,
            signer: undefined, // Burner accounts don't use ethers signers
          },
          owner: account.address,
        };
      },
      canLogout: () => false,
    };
  };
  