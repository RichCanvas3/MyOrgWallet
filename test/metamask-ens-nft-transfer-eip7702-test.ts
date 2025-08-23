import { config } from 'dotenv'
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, namehash, type PublicClient, type WalletClient } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { createBundlerClient } from 'viem/account-abstraction'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

import {
  Implementation,
  toMetaMaskSmartAccount,
  getDeleGatorEnvironment,
} from '@metamask/delegation-toolkit'

config()

const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
const PRIVATE_KEY = (process.env.PRIVATE_KEY || process.env.SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) as `0x${string}`
const BUNDLER_URL = process.env.BUNDLER_URL
const RECIPIENT_EOA = process.env.NFT_RECIPIENT_EOA as `0x${string}` | undefined
const ENS_NAME = process.env.ENS_NAME // without .eth or with; we will normalize
const TOKEN_ID = process.env.ENS_TOKEN_ID // optional: overrides ENS_NAME

function validateEnv(): void {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required')
  if (!BUNDLER_URL) throw new Error('BUNDLER_URL is required')
  if (!RECIPIENT_EOA) throw new Error('NFT_RECIPIENT_EOA is required')
  if (!ENS_NAME && !TOKEN_ID) throw new Error('Set ENS_NAME or ENS_TOKEN_ID')
}

// ENS NameWrapper minimal ABI
const NAME_WRAPPER_ABI = parseAbi([
  'function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)',
  'function ownerOf(uint256 id) view returns (address)'
])

function getNameWrapperAddress(chainId: number): `0x${string}` {
  switch (chainId) {
    case 11155111: // Sepolia
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`
    case 1: // Mainnet
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`
    default:
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`
  }
}

function resolveTokenId(): bigint {
  if (TOKEN_ID) return BigInt(TOKEN_ID)
  const normalized = ENS_NAME!.endsWith('.eth') ? ENS_NAME! : `${ENS_NAME}.eth`
  return BigInt(namehash(normalized))
}

async function main(): Promise<void> {
  console.log('🚀 MetaMask EIP-7702 ENS NFT Transfer (EOA → EOA)')
  validateEnv()

  // 1) Public client
  const publicClient: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // 2) Bundler client (optionally with sponsorship context)
  const bundlerClient = createBundlerClient({
    chain: sepolia,
    transport: http(BUNDLER_URL!),
    paymaster: true,
    paymasterContext: { mode: 'SPONSORED' },
  })

  // 3) Wallet client (EOA for 7702 auth)
  const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)
  const walletClient: WalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // 4) EIP-7702 authorization against MetaMask Stateless Delegator
  const env = getDeleGatorEnvironment(sepolia.id)
  const contractAddress = env.implementations.EIP7702StatelessDeleGatorImpl
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress,
    executor: 'self',
  })

  console.log('Submitting EIP-7702 authorization tx...')
  const authTxHash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    to: account.address,
    data: '0x',
  })
  await publicClient.waitForTransactionReceipt({ hash: authTxHash })

  // 5) Create MetaMask smart account bound to the EOA
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702 as any,
    address: account.address,
    signatory: { walletClient },
  })

  // 6) Encode NameWrapper safeTransferFrom
  const tokenId = resolveTokenId()
  const nameWrapper = getNameWrapperAddress(sepolia.id)
  const transferData = encodeFunctionData({
    abi: NAME_WRAPPER_ABI,
    functionName: 'safeTransferFrom',
    args: [account.address, RECIPIENT_EOA, tokenId, 1n, '0x'],
  })

  // Optional fee helper (Pimlico-compatible)
  const pimlico = createPimlicoClient({ transport: http(BUNDLER_URL!) })
  const { fast } = await pimlico.getUserOperationGasPrice()

  console.log('Sending UserOperation to transfer ENS NFT...')
  const userOpHash = await bundlerClient.sendUserOperation({
    account: smartAccount as any,
    calls: [
      {
        to: nameWrapper,
        data: transferData,
        value: 0n,
      },
    ],
    maxFeePerGas: fast.maxFeePerGas,
    maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
  })

  const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
  console.log('UserOperation included. Tx:', receipt.transactionHash)

  // 7) Verify final ownership
  const newOwner = await publicClient.readContract({
    address: nameWrapper,
    abi: NAME_WRAPPER_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  })
  console.log('New owner:', newOwner)
  if (newOwner.toLowerCase() !== RECIPIENT_EOA.toLowerCase()) {
    throw new Error('Ownership did not transfer to the recipient EOA')
  }
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})


