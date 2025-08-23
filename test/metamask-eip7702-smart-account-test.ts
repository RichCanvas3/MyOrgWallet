import { config } from 'dotenv'
import { createPublicClient, createWalletClient, http, zeroAddress, type PublicClient, type WalletClient } from 'viem'
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

function validateEnv(): void {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required')
  if (!BUNDLER_URL) throw new Error('BUNDLER_URL is required')
}

async function main(): Promise<void> {
  console.log('🚀 MetaMask EIP-7702 Smart Account test (toMetaMaskSmartAccount)')
  validateEnv()

  // 1) Public client
  const publicClient: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // 2) Bundler client
  const bundlerClient = createBundlerClient({
    chain: sepolia,
    transport: http(BUNDLER_URL!),
    paymaster: true,
    paymasterContext: {
      mode: 'SPONSORED',
    },
  })

  // 3) Wallet client (EOA for 7702 auth)
  const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)
  const walletClient: WalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // 4) Create EIP-7702 authorization for MetaMask Stateless Delegator
  const env = getDeleGatorEnvironment(sepolia.id)
  const contractAddress = env.implementations.EIP7702StatelessDeleGatorImpl
  console.log('contractAddress', contractAddress)
  console.log('env', env)

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress,
    executor: 'self',
  })
  console.info('authorization', authorization)

  // 5) Submit dummy tx with authorization (maps code to EOA)
  console.log('Submitting EIP-7702 authorization tx...')
  const authTxHash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: zeroAddress,
    data: '0x',
  })
  const authReceipt = await publicClient.waitForTransactionReceipt({ hash: authTxHash })
  console.log('Authorization receipt status:', authReceipt.status)

  // 6) Build MetaMask smart account for the EOA
  const [address] = await walletClient.getAddresses()
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address,
    signatory: { walletClient },
  })
  console.log('Smart account address:', await smartAccount.getAddress())

  // 7) Send a simple user operation (sponsored flow optional)
  // If your bundler supports sponsorship (e.g., Pimlico), you can use their gas price helper.
  const pimlico = createPimlicoClient({ transport: http(BUNDLER_URL!) })
  const { fast } = await pimlico.getUserOperationGasPrice()

  console.log('Sending UserOperation...')
  const receiver = "0x8272226863aACD003975B5C497E366c14D009605"
  const userOpHash = await bundlerClient.sendUserOperation({
    account: smartAccount as any,
    calls: [
      {
        to: receiver,
        value: 100n,
        data: '0x',
      },
    ],
    maxFeePerGas: fast.maxFeePerGas,
    maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
  })
  console.log('UserOperation hash:', userOpHash)

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
  console.log('UserOperation receipt:', receipt)
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})


