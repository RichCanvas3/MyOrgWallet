import { config } from 'dotenv'
import { createPublicClient, createWalletClient, http, namehash, encodeFunctionData } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

// Reuse the same ABIs used elsewhere in the project
import ETHRegistrarControllerABI from '../src/abis/ETHRegistrarController.json'
import PublicResolverABI from '../src/abis/PublicResolver.json'

config()

// Env-driven config for EOA registration
const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
const PRIVATE_KEY = (process.env.PRIVATE_KEY || process.env.SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) as `0x${string}`
const ENS_NAME = process.env.ENS_NAME || 'myorgwallettest' // label, without .eth
const ENS_DURATION_SECONDS = Number(process.env.ENS_DURATION_SECONDS || 31536000) // 1 year default

// ENS Contracts (Sepolia) – align with existing test addresses
const ENS_CONTRACTS = {
  ETHRegistrarController: '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968' as `0x${string}`,
  PublicResolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as `0x${string}`,
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
}

function validateEnv(): void {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY (or SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) is required')
}

async function main() {
  try {
    validateEnv()
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

    const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) })

    const ensLabel = ENS_NAME
    const ensFullName = `${ensLabel}.eth`
    const duration = BigInt(ENS_DURATION_SECONDS)

    // 1) Check availability
    const available = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ETHRegistrarControllerABI.abi,
      functionName: 'available',
      args: [ensLabel],
    }) as boolean
    if (!available) throw new Error(`Domain ${ensFullName} is not available`)

    // 2) Get price
    const price = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ETHRegistrarControllerABI.abi,
      functionName: 'rentPrice',
      args: [ensLabel, duration],
    }) as { base: bigint; premium: bigint }
    const totalPrice = price.base + price.premium

    // 3) Prepare registration object (same shape as AA test)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    const secret = `0x${Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
    const registration = {
      label: ensLabel,
      owner: account.address,
      duration,
      secret,
      resolver: ENS_CONTRACTS.PublicResolver,
      data: [],
      reverseRecord: true,
      referrer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    }

    // 4) Make commitment (view)
    const commitment = await publicClient.readContract({
      address: ENS_CONTRACTS.ETHRegistrarController,
      abi: ETHRegistrarControllerABI.abi,
      functionName: 'makeCommitment',
      args: [registration],
    }) as `0x${string}`

    // 5) Commit tx (EOA)
    const commitData = encodeFunctionData({
      abi: ETHRegistrarControllerABI.abi,
      functionName: 'commit',
      args: [commitment],
    })
    const commitHash = await walletClient.sendTransaction({
      account,
      to: ENS_CONTRACTS.ETHRegistrarController,
      data: commitData,
      value: 0n,
    })
    await publicClient.waitForTransactionReceipt({ hash: commitHash })

    // 6) Wait for commitment to age (e.g., 90s)
    await new Promise((r) => setTimeout(r, 90_000))

    // 7) Register tx (EOA)
    const registerData = encodeFunctionData({
      abi: ETHRegistrarControllerABI.abi,
      functionName: 'register',
      args: [registration],
    })
    const fee = await publicClient.estimateFeesPerGas()
    const registerHash = await walletClient.sendTransaction({
      account,
      to: ENS_CONTRACTS.ETHRegistrarController,
      data: registerData,
      value: totalPrice,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    })
    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash })

    // 8) Verify owner in ENS Registry
    const node = namehash(ensFullName)
    const owner = await publicClient.readContract({
      address: ENS_CONTRACTS.ENSRegistry,
      abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }] }] as const,
      functionName: 'owner',
      args: [node],
    }) as `0x${string}`

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Registration verification failed. Expected ${account.address}, got ${owner}`)
    }

    console.log(`🎉 ENS domain "${ensFullName}" registered to EOA ${account.address}`)
    console.log('Tx:', registerReceipt.transactionHash)
  } catch (err) {
    console.error('❌ ENS EOA Registration test failed:', err)
    process.exit(1)
  }
}

main()


