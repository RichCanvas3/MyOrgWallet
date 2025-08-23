import { createPublicClient, createWalletClient, http, namehash, encodeFunctionData, keccak256, stringToHex } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { config } from 'dotenv'

// Reuse ABIs from project
import NameWrapperABI from '../src/abis/NameWrapper.json'
import BaseRegistrarABI from '../src/abis/BaseRegistrarImplementation.json'

// ENS Contracts (Sepolia/Mainnet)
const ENS_CONTRACTS = {
  ENSRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as `0x${string}`,
  NameWrapper: '0x0000000000000000000000000000000000000000' as `0x${string}`, // set dynamically
  PublicResolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as `0x${string}`,
  BaseRegistrar: '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85' as `0x${string}`,
}

function getNameWrapperAddress(chainId: number): `0x${string}` {
  switch (chainId) {
    case 11155111:
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`
    case 1:
      return '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as `0x${string}`
    default:
      return '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`
  }
}

function getLabelTokenId(ensName: string): bigint {
  const label = ensName.endsWith('.eth') ? ensName.slice(0, -4) : ensName
  return BigInt(keccak256(stringToHex(label)))
}

async function main() {
  config()
  const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || process.env.SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) as `0x${string}`
  const ENS_NAME = process.env.ENS_NAME // label or full name; we normalize

  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY (or SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY) is required')
  if (!ENS_NAME) throw new Error('ENS_NAME is required (e.g., myname or myname.eth)')

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
  const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) })

  ENS_CONTRACTS.NameWrapper = getNameWrapperAddress(sepolia.id)
  const fullName = ENS_NAME.endsWith('.eth') ? ENS_NAME : `${ENS_NAME}.eth`
  const tokenId = getLabelTokenId(fullName)

  console.log('EOA:', account.address)
  console.log('Full ENS:', fullName)
  console.log('NameWrapper:', ENS_CONTRACTS.NameWrapper)

  // If already wrapped, verify and exit
  try {
    const wrappedOwner = await publicClient.readContract({
      address: ENS_CONTRACTS.NameWrapper,
      abi: NameWrapperABI.abi,
      functionName: 'ownerOf',
      args: [tokenId],
    }) as `0x${string}`
    console.log('Already wrapped. Owner in NameWrapper:', wrappedOwner)
    if (wrappedOwner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Wrapped by ${wrappedOwner}, not EOA ${account.address}`)
    }
    console.log('✅ Wrapped and owned by EOA. Nothing to do.')
    return
  } catch {}

  // Ensure EOA owns the .eth label in BaseRegistrar
  const baseOwner = await publicClient.readContract({
    address: ENS_CONTRACTS.BaseRegistrar,
    abi: BaseRegistrarABI.abi,
    functionName: 'ownerOf',
    args: [tokenId],
  }) as `0x${string}`
  if (baseOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`EOA does not own ${fullName} label. BaseRegistrar owner: ${baseOwner}`)
  }

  // Verify resolver & wrapper code exists
  const resolverCode = await publicClient.getBytecode({ address: ENS_CONTRACTS.PublicResolver })
  if (!resolverCode || resolverCode === '0x') throw new Error('PublicResolver code missing')
  const wrapperCode = await publicClient.getBytecode({ address: ENS_CONTRACTS.NameWrapper })
  if (!wrapperCode || wrapperCode === '0x') throw new Error('NameWrapper code missing')

  // Check/set approval for NameWrapper
  const approved = await publicClient.readContract({
    address: ENS_CONTRACTS.BaseRegistrar,
    abi: BaseRegistrarABI.abi,
    functionName: 'isApprovedForAll',
    args: [account.address, ENS_CONTRACTS.NameWrapper],
  }) as boolean
  if (!approved) {
    console.log('Setting approval for NameWrapper...')
    const approvalData = encodeFunctionData({
      abi: BaseRegistrarABI.abi,
      functionName: 'setApprovalForAll',
      args: [ENS_CONTRACTS.NameWrapper, true],
    })
    const approvalHash = await walletClient.sendTransaction({
      account,
      to: ENS_CONTRACTS.BaseRegistrar,
      data: approvalData,
      value: 0n,
    })
    await publicClient.waitForTransactionReceipt({ hash: approvalHash })
  }

  // Wrap via NameWrapper.wrapETH2LD(label, owner, fuses, resolver)
  const label = fullName.slice(0, -4)
  const wrapData = encodeFunctionData({
    abi: NameWrapperABI.abi,
    functionName: 'wrapETH2LD',
    args: [label, account.address, 0, ENS_CONTRACTS.PublicResolver],
  })

  console.log('Wrapping domain...')
  const fees = await publicClient.estimateFeesPerGas()
  const wrapHash = await walletClient.sendTransaction({
    account,
    to: ENS_CONTRACTS.NameWrapper,
    data: wrapData,
    value: 0n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash })
  console.log('Wrap tx:', wrapReceipt.transactionHash)

  // Verify: ENSRegistry should point owner to NameWrapper, and NameWrapper token owner should be EOA
  const node = namehash(fullName)
  const registryOwner = await publicClient.readContract({
    address: ENS_CONTRACTS.ENSRegistry,
    abi: [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }] }] as const,
    functionName: 'owner',
    args: [node],
  }) as `0x${string}`
  if (registryOwner.toLowerCase() !== ENS_CONTRACTS.NameWrapper.toLowerCase()) {
    throw new Error('Registry owner is not NameWrapper after wrapping')
  }
  const finalOwner = await publicClient.readContract({
    address: ENS_CONTRACTS.NameWrapper,
    abi: NameWrapperABI.abi,
    functionName: 'ownerOf',
    args: [tokenId],
  }) as `0x${string}`
  if (finalOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Wrapped token not owned by EOA. Owner: ${finalOwner}`)
  }
  console.log(`✅ ${fullName} wrapped as NFT and owned by ${account.address}`)
}

main().catch((err) => {
  console.error('❌ ENS EOA NFT wrapper failed:', err)
  process.exit(1)
})


