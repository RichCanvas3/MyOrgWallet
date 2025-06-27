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
  parseAbi
} from "viem";

import {
  mainnet,
  optimism,
  linea,
  sepolia,
  avalancheFuji,
  baseSepolia,
  sonicBlazeTestnet,
  lineaSepolia,
  arbitrumSepolia,
  worldchainSepolia,
  optimismSepolia,
  unichainSepolia,
  polygonAmoy,
  base,
  arbitrum,
  worldchain,
} from "viem/chains";

import { ETHERUM_RPC_URL, OPTIMISM_RPC_URL, SEPOLIA_RPC_URL, LINEA_RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, LINEA_SEPOLIA_RPC_URL } from "../config";


export enum SupportedChainId {
  ETH_MAINNET = 1,
  OPTIMISM_MAINNET = 10,
  BASE_MAINNET = 8453,
  LINEA_MAINNET = 59144,
  ARBITRUM_MAINNET = 42161,
  WORLDCHAIN_MAINNET = 4800,
  SOLANA_MAINNET = 1,
  ETH_SEPOLIA = 11155111,
  AVAX_FUJI = 43113,
  BASE_SEPOLIA = 84532,
  SONIC_BLAZE = 57054,
  LINEA_SEPOLIA = 59141,
  ARBITRUM_SEPOLIA = 421614,
  WORLDCHAIN_SEPOLIA = 4801,
  OPTIMISM_SEPOLIA = 11155420,
  SOLANA_DEVNET = 103,
  CODEX_TESTNET = 812242,
  UNICHAIN_SEPOLIA = 1301,
  POLYGON_AMOY = 80002,
}



export const CHAINS: Record<number, Chain> = {
  [SupportedChainId.ETH_MAINNET]: mainnet,
  [SupportedChainId.OPTIMISM_MAINNET]: optimism,
  [SupportedChainId.BASE_MAINNET]: base,
  [SupportedChainId.LINEA_MAINNET]: linea,
  [SupportedChainId.ARBITRUM_MAINNET]: arbitrum,
  [SupportedChainId.WORLDCHAIN_MAINNET]: worldchain,
  [SupportedChainId.ETH_SEPOLIA]: sepolia,
  [SupportedChainId.AVAX_FUJI]: avalancheFuji,
  [SupportedChainId.BASE_SEPOLIA]: baseSepolia,
  [SupportedChainId.SONIC_BLAZE]: sonicBlazeTestnet,
  [SupportedChainId.LINEA_SEPOLIA]: lineaSepolia,
  [SupportedChainId.ARBITRUM_SEPOLIA]: arbitrumSepolia,
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: worldchainSepolia,
  [SupportedChainId.OPTIMISM_SEPOLIA]: optimismSepolia,
  [SupportedChainId.UNICHAIN_SEPOLIA]: unichainSepolia,
  [SupportedChainId.POLYGON_AMOY]: polygonAmoy,
};

export const DEFAULT_MAX_FEE = 1000n;
export const DEFAULT_FINALITY_THRESHOLD = 2000;

export const CHAIN_IDS_TO_RPC_URLS: Record<number, string> = {
  [SupportedChainId.ETH_MAINNET]: ETHERUM_RPC_URL,
  [SupportedChainId.OPTIMISM_MAINNET]: OPTIMISM_RPC_URL,
  [SupportedChainId.BASE_MAINNET]: "https://mainnet.base.org",
  [SupportedChainId.LINEA_MAINNET]: LINEA_RPC_URL,
  [SupportedChainId.ARBITRUM_MAINNET]: "https://arb1.arbitrum.io/rpc",
  [SupportedChainId.WORLDCHAIN_MAINNET]: "https://rpc.worldchain.com",
  [SupportedChainId.ETH_SEPOLIA]: SEPOLIA_RPC_URL,
  [SupportedChainId.AVAX_FUJI]: "https://api.avax-test.network/ext/bc/C/rpc",
  [SupportedChainId.BASE_SEPOLIA]: "https://sepolia.base.org",
  [SupportedChainId.SONIC_BLAZE]: "https://rpc.sonic.game",
  [SupportedChainId.LINEA_SEPOLIA]: LINEA_SEPOLIA_RPC_URL,
  [SupportedChainId.ARBITRUM_SEPOLIA]: "https://sepolia-rollup.arbitrum.io/rpc",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "https://rpc.sepolia.worldchain.com",
  [SupportedChainId.OPTIMISM_SEPOLIA]: OPTIMISM_SEPOLIA_RPC_URL,
  [SupportedChainId.UNICHAIN_SEPOLIA]: "https://rpc-testnet.unichain.world",
  [SupportedChainId.POLYGON_AMOY]: "https://rpc-amoy.polygon.technology",
};

export const CHAIN_TO_CHAIN_NAME: Record<number, string> = {
  [SupportedChainId.ETH_MAINNET]: "Ethereum Mainnet",
  [SupportedChainId.OPTIMISM_MAINNET]: "Optimism Mainnet",
  [SupportedChainId.BASE_MAINNET]: "Base Mainnet",
  [SupportedChainId.LINEA_MAINNET]: "Linea Mainnet",
  [SupportedChainId.ARBITRUM_MAINNET]: "Arbitrum Mainnet",
  [SupportedChainId.WORLDCHAIN_MAINNET]: "Worldchain Mainnet",
  [SupportedChainId.ETH_SEPOLIA]: "Ethereum Sepolia Testnet",
  [SupportedChainId.AVAX_FUJI]: "Avalanche Fuji Testnet",
  [SupportedChainId.BASE_SEPOLIA]: "Base Sepolia Testnet",
  [SupportedChainId.SONIC_BLAZE]: "Sonic Blaze Testnet",
  [SupportedChainId.LINEA_SEPOLIA]: "Linea Sepolia Testnet",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "Arbitrum Sepolia Testnet",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "Worldchain Sepolia Testnet",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "Optimism Sepolia Testnet",
  [SupportedChainId.SOLANA_DEVNET]: "Solana Devnet Testnet",
  [SupportedChainId.CODEX_TESTNET]: "Codex Testnet",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "Unichain Sepolia Testnet",
  [SupportedChainId.POLYGON_AMOY]: "Polygon Amoy Testnet",
};

export const CIRCLE_SUPPORTED_CHAINS: Record<number, boolean> = {
  [SupportedChainId.ETH_MAINNET]: false,
  [SupportedChainId.OPTIMISM_MAINNET]: false,
  [SupportedChainId.BASE_MAINNET]: false,
  [SupportedChainId.LINEA_MAINNET]: false,
  [SupportedChainId.ARBITRUM_MAINNET]: false,
  [SupportedChainId.WORLDCHAIN_MAINNET]: false,
  [SupportedChainId.ETH_SEPOLIA]: true,
  [SupportedChainId.AVAX_FUJI]: true,
  [SupportedChainId.BASE_SEPOLIA]: true,
  [SupportedChainId.SONIC_BLAZE]: true,
  [SupportedChainId.LINEA_SEPOLIA]: true,
  [SupportedChainId.ARBITRUM_SEPOLIA]: true,
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: true,
  [SupportedChainId.OPTIMISM_SEPOLIA]: true,
  [SupportedChainId.SOLANA_DEVNET]: true,
  [SupportedChainId.CODEX_TESTNET]: true,
  [SupportedChainId.UNICHAIN_SEPOLIA]: true,
  [SupportedChainId.POLYGON_AMOY]: true,
};


export const CHAIN_IDS_TO_USDC_ADDRESSES: Record<number, Hex | string> = {
  [SupportedChainId.ETH_MAINNET]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [SupportedChainId.OPTIMISM_MAINNET]: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  [SupportedChainId.BASE_MAINNET]: "0x",
  [SupportedChainId.LINEA_MAINNET]: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
  [SupportedChainId.ARBITRUM_MAINNET]: "0x",
  [SupportedChainId.WORLDCHAIN_MAINNET]: "0x",
  [SupportedChainId.ETH_SEPOLIA]: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  [SupportedChainId.AVAX_FUJI]: "0x5425890298aed601595a70AB815c96711a31Bc65",
  [SupportedChainId.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [SupportedChainId.SONIC_BLAZE]: "0xA4879Fed32Ecbef99399e5cbC247E533421C4eC6",
  [SupportedChainId.LINEA_SEPOLIA]:
    "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
  [SupportedChainId.ARBITRUM_SEPOLIA]:
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]:
    "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  [SupportedChainId.OPTIMISM_SEPOLIA]:
    "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  [SupportedChainId.SOLANA_DEVNET]:
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  [SupportedChainId.CODEX_TESTNET]:
    "0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f",
  [SupportedChainId.UNICHAIN_SEPOLIA]:
    "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  [SupportedChainId.POLYGON_AMOY]: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
};


export const CHAIN_IDS_TO_TOKEN_MESSENGER: Record<number, Hex | string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.AVAX_FUJI]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.BASE_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.SONIC_BLAZE]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.LINEA_SEPOLIA]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.ARBITRUM_SEPOLIA]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.OPTIMISM_SEPOLIA]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.SOLANA_DEVNET]:
    "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
  [SupportedChainId.CODEX_TESTNET]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.UNICHAIN_SEPOLIA]:
    "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.POLYGON_AMOY]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
};

export const CHAIN_IDS_TO_MESSAGE_TRANSMITTER: Record<number, Hex | string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.AVAX_FUJI]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.BASE_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.SONIC_BLAZE]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.LINEA_SEPOLIA]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.ARBITRUM_SEPOLIA]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.OPTIMISM_SEPOLIA]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.SOLANA_DEVNET]:
    "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
  [SupportedChainId.CODEX_TESTNET]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.UNICHAIN_SEPOLIA]:
    "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.POLYGON_AMOY]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
};

export const DESTINATION_DOMAINS: Record<number, number> = {
  [SupportedChainId.ETH_SEPOLIA]: 0,
  [SupportedChainId.AVAX_FUJI]: 1,
  [SupportedChainId.BASE_SEPOLIA]: 6,
  [SupportedChainId.SONIC_BLAZE]: 13,
  [SupportedChainId.LINEA_SEPOLIA]: 11,
  [SupportedChainId.ARBITRUM_SEPOLIA]: 3,
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: 14,
  [SupportedChainId.OPTIMISM_SEPOLIA]: 2,
  [SupportedChainId.SOLANA_DEVNET]: 5,
  [SupportedChainId.CODEX_TESTNET]: 12,
  [SupportedChainId.UNICHAIN_SEPOLIA]: 10,
  [SupportedChainId.POLYGON_AMOY]: 7,
};


export const CHAIN_IDS_TO_EXPLORER_URL: Record<number, string> = {
  [SupportedChainId.ETH_MAINNET]: "https://etherscan.io",
  [SupportedChainId.OPTIMISM_MAINNET]: "https://optimistic.etherscan.io",
  [SupportedChainId.BASE_MAINNET]: "https://basescan.org",
  [SupportedChainId.LINEA_MAINNET]: "https://lineascan.build",
  [SupportedChainId.ARBITRUM_MAINNET]: "https://arbiscan.io",
  [SupportedChainId.WORLDCHAIN_MAINNET]: "https://explorer.worldchain.com",
  [SupportedChainId.ETH_SEPOLIA]: "https://sepolia.etherscan.io",
  [SupportedChainId.AVAX_FUJI]: "https://testnet.snowtrace.io",
  [SupportedChainId.BASE_SEPOLIA]: "https://sepolia.basescan.org",
  [SupportedChainId.SONIC_BLAZE]: "https://explorer.sonic.game",
  [SupportedChainId.LINEA_SEPOLIA]: "https://sepolia.lineascan.build",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "https://sepolia.arbiscan.io",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "https://explorer.sepolia.worldchain.com",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "https://sepolia-optimism.etherscan.io",
  [SupportedChainId.SOLANA_DEVNET]: "https://explorer.solana.com/?cluster=devnet",
  [SupportedChainId.CODEX_TESTNET]: "https://explorer.codexchain.io",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "https://explorer-testnet.unichain.world",
  [SupportedChainId.POLYGON_AMOY]: "https://www.oklink.com/amoy",
};


export const ERC20_ABI = parseAbi([
  // Read-only
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',

  // Write
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',

  // Events (optional, useful for indexing/logs)
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);






// Solana RPC endpoint
export const SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com";

// IRIS API URL for CCTP attestations (testnet)
export const IRIS_API_URL = "https://iris-api-sandbox.circle.com"

  //process.env.IRIS_API_URL ?? "https://iris-api-sandbox.circle.com";
  //https://iris-api-sandbox.circle.com/v1/
