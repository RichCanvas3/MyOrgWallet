import { config } from 'dotenv'
import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'

config()

const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
const AA_ADDRESS = process.env.AA_ADDRESS as `0x${string}`

function validateEnv(): void {
  if (!AA_ADDRESS) throw new Error('AA_ADDRESS is required')
}

// Minimal ABIs for common AA implementations
const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function owner() view returns (address)'
])

const SAFE_ABI = parseAbi([
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)'
])

async function main(): Promise<void> {
  console.log('🔎 AA Owner Inspect Test')
  validateEnv()

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // Try SimpleAccount-style `owner()` first
  try {
    const owner = await publicClient.readContract({
      address: AA_ADDRESS,
      abi: SIMPLE_ACCOUNT_ABI,
      functionName: 'owner',
      args: [],
    })
    console.log('AA type: SimpleAccount-like')
    console.log('Owner:', owner)
    return
  } catch {}

  // Try Safe-style `getOwners()` next
  try {
    const [owners, threshold] = await Promise.all([
      publicClient.readContract({
        address: AA_ADDRESS,
        abi: SAFE_ABI,
        functionName: 'getOwners',
        args: [],
      }) as Promise<readonly `0x${string}`[]>,
      publicClient.readContract({
        address: AA_ADDRESS,
        abi: SAFE_ABI,
        functionName: 'getThreshold',
        args: [],
      }) as Promise<bigint>,
    ])
    console.log('AA type: Safe-like (Gnosis Safe)')
    console.log('Owners:', owners)
    console.log('Threshold:', threshold.toString())
    return
  } catch {}

  console.log('Could not determine owner with known ABIs. The AA may use a different implementation.')
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})


