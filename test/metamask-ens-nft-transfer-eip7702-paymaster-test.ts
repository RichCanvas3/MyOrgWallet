import { config } from 'dotenv'
import { createPublicClient, createWalletClient, http, encodeFunctionData, namehash, parseAbi, type PublicClient, type WalletClient } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { createBundlerClient, createPaymasterClient, paymasterActions } from 'viem/account-abstraction'

import { getDeleGatorEnvironment } from '@metamask/delegation-toolkit'

config()

const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
const PRIVATE_KEY = (process.env.PRIVATE_KEY || process.env.SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) as `0x${string}`
const BUNDLER_URL = process.env.BUNDLER_URL
const PAYMASTER_URL = process.env.PAYMASTER_URL
const RECIPIENT_EOA = process.env.NFT_RECIPIENT_EOA as `0x${string}` | undefined
const ENS_NAME = process.env.ENS_NAME // optional; if set, used to compute tokenId via namehash
const ENS_TOKEN_ID = process.env.ENS_TOKEN_ID // optional override for tokenId

function validateEnv(): void {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required')
  if (!BUNDLER_URL) throw new Error('BUNDLER_URL is required')
  if (!RECIPIENT_EOA) throw new Error('NFT_RECIPIENT_EOA is required')
  if (!ENS_NAME && !ENS_TOKEN_ID) throw new Error('Set ENS_NAME or ENS_TOKEN_ID')
  if (!PAYMASTER_URL) throw new Error('PAYMASTER_URL is required')
}

// Minimal NameWrapper ABI for transfer & owner query
const NAME_WRAPPER_ABI = parseAbi([
  'function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)',
  'function ownerOf(uint256 id) view returns (address)'
])

// Minimal EntryPoint ABI (v0.7 getNonce)
const entryPointAbi = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)'
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
  if (ENS_TOKEN_ID) return BigInt(ENS_TOKEN_ID)
  const full = ENS_NAME!.endsWith('.eth') ? ENS_NAME! : `${ENS_NAME}.eth`
  return BigInt(namehash(full))
}

async function main(): Promise<void> {
  console.log('🚀 MetaMask EIP-7702 ENS NFT Transfer with Paymaster (EOA → EOA)')
  validateEnv()

  // Clients
  const publicClient: PublicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

  const bundler = createBundlerClient({ transport: http(BUNDLER_URL!) })
  const paymaster = createPaymasterClient({ transport: http(PAYMASTER_URL!) }).extend(paymasterActions)

  const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)
  const walletClient: WalletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) })

  // 7702 authorization against MetaMask Stateless Delegator
  const env = getDeleGatorEnvironment(sepolia.id)
  const contractAddress = env.implementations.EIP7702StatelessDeleGatorImpl
  const authorization = await walletClient.signAuthorization({ contractAddress, executor: 'self', account })

  // Build NameWrapper transfer call
  const nameWrapper = getNameWrapperAddress(sepolia.id)
  const tokenId = resolveTokenId()
  const transferData = encodeFunctionData({
    abi: NAME_WRAPPER_ABI,
    functionName: 'safeTransferFrom',
    args: [account.address, RECIPIENT_EOA!, tokenId, 1n, '0x'],
  })

  // Wrap the inner call via delegator execute((to,value,data)[])
  const execAbi = parseAbi(['function execute((address to,uint256 value,bytes data)[] calls) external payable'])
  const execData = encodeFunctionData({
    abi: execAbi,
    functionName: 'execute',
    args: [[{ to: nameWrapper as `0x${string}`, value: 0n, data: transferData }]],
  })

  // Send a sponsored 7702 userOp from EOA to itself with authorization
  const userOpHash = await (bundler as any).sendUserOperation({
    account,
    to: account.address,
    data: execData,
    authorizationList: [authorization],
    paymaster,
  })
  console.log('UserOperation hash:', userOpHash)

  const { receipt } = await (bundler as any).waitForUserOperationReceipt({ hash: userOpHash })
  console.log('Included tx:', receipt.transactionHash)

  // Verify owner updated to RECIPIENT_EOA
  const newOwner = await publicClient.readContract({ address: nameWrapper as `0x${string}`, abi: NAME_WRAPPER_ABI, functionName: 'ownerOf', args: [tokenId] })
  console.log('New owner:', newOwner)
  if (newOwner.toLowerCase() !== RECIPIENT_EOA!.toLowerCase()) throw new Error('Ownership did not transfer to recipient EOA')
}

main().catch((err) => { console.error('❌ Test failed:', err); process.exit(1) })


