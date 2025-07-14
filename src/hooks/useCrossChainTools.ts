import { ethers } from "ethers";

import {
  createWalletClient,
  http,
  encodeFunctionData,
  HttpTransport,
  type Chain,
  type Account,
  type WalletClient,
  type Hex,
  TransactionExecutionError,
  parseUnits,
  createPublicClient,
  formatUnits,
  parseEther,
} from "viem";


import { SupportedChainId, CHAIN_IDS_TO_USDC_ADDRESSES, CIRCLE_SUPPORTED_CHAINS, CHAINS, CHAIN_IDS_TO_RPC_URLS, ERC20_ABI } from "../libs/chains";
import { CHAIN_NAME } from "../config";


export function useCrossChainAccount() {

  const getPublicClient = (chainId: number) => {
    return createPublicClient({
      chain: CHAINS[chainId],
      transport: http(),
    });
  };

  const getUSDCChainTokenInfo = async (chainId: number): Promise<{ symbol: string; name: string; address: `0x${string}`; decimals: number }> => {

    const chain = CHAINS[chainId];
    const name = CHAIN_NAME[chainId]
    const usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[chainId] as `0x${string}`;
    const decimals = 6;
    return { symbol: 'USDC', name: name, address: usdcAddress, decimals };
  };

  const getEthBalance = async (address: string, chainId: number): Promise<string> => {
    try {
      const chain = CHAINS[chainId];
      const rpcUrl = CHAIN_IDS_TO_RPC_URLS[chainId];
      
      if (!rpcUrl) {
        console.warn(`No RPC URL found for chain ${chainId}`);
        return "0";
      }
      
      const publicClient = createPublicClient({
          chain: chain,
          transport: http(rpcUrl),
        });
      
      const balance = await publicClient.getBalance({
        address: address as `0x${string}`,
      });
      return balance.toString();
    } catch (error) {
      console.error(`Error getting native balance for chain ${chainId}:`, error);
      return "0";
    }
  };

  const getUSDCBalance = async (address: string, chainId: number): Promise<string> => {
    try {
      const chain = CHAINS[chainId];
      let usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[chainId] as `0x${string}`;
      
      if (!usdcAddress || usdcAddress === "0x") {
        console.warn(`No USDC address found for chain ${chainId}`);
        return "0";
      }
      
      const publicClient = createPublicClient({
        chain: chain,
        transport: http(),
      });

      if (CIRCLE_SUPPORTED_CHAINS[chainId]) {

        // used to get testnet USDC balances
        const balance = await publicClient.readContract({
          address: usdcAddress,
          abi: [
            {
              constant: true,
              inputs: [{ name: "_owner", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "balance", type: "uint256" }],
              payable: false,
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        console.info("balance: ", balance)

        const decimals = 6

        return ethers.formatUnits(balance, decimals); 


      }
      else {

        // used to get mainnet USDC balances
        const rpcUrl = CHAIN_IDS_TO_RPC_URLS[chainId];
        if (!rpcUrl) {
          console.warn(`No RPC URL found for chain ${chainId}`);
          return "0";
        }
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
        const balance = await usdcContract.balanceOf(address)
        const decimals = await usdcContract.decimals()


        return ethers.formatUnits(balance, decimals); 
      }
    } catch (error) {
      console.error(`Error getting USDC balance for chain ${chainId}:`, error);
      return "0";
    }
  };

  return {
    getUSDCBalance,
    getEthBalance,
    getPublicClient,
    getUSDCChainTokenInfo
  };
}