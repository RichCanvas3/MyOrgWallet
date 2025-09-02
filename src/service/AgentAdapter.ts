import { encodeFunctionData, Hex, zeroAddress, http, type PublicClient, type WalletClient } from 'viem'
import type { Chain } from 'viem'
import { createBundlerClient, createPaymasterClient, bundlerActions } from 'viem/account-abstraction'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { encodeNonce } from "permissionless/utils"

// Minimal ERC-8004-like adapter for IdentityRegistration (TypeScript)
// Assumes IdentityRegistration has function:
//   function newAgent(string domain, address agentAccount, bytes signature) external returns (uint256 agentId)

export const identityRegistrationAbi = [
  {
    type: 'function',
    name: 'newAgent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'domain', type: 'string' },
      { name: 'agentAccount', type: 'address' },
    ],
    outputs: [
      { name: 'agentId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'resolveByDomain',
    stateMutability: 'view',
    inputs: [{ name: 'agentDomain', type: 'string' }],
    outputs: [
      {
        name: 'agentInfo',
        type: 'tuple',
        components: [
          { name: 'agentId', type: 'uint256' },
          { name: 'agentDomain', type: 'string' },
          { name: 'agentAddress', type: 'address' },
        ],
      },
    ],
  },
  // Optional reader variants – registry implementers may differ
  {
    type: 'function',
    name: 'agentOfDomain',
    stateMutability: 'view',
    inputs: [{ name: 'domain', type: 'string' }],
    outputs: [{ name: 'agent', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getAgent',
    stateMutability: 'view',
    inputs: [{ name: 'domain', type: 'string' }],
    outputs: [{ name: 'agent', type: 'address' }],
  },
  {
    type: 'function',
    name: 'agents',
    stateMutability: 'view',
    inputs: [{ name: 'domain', type: 'string' }],
    outputs: [{ name: 'agent', type: 'address' }],
  },
] as const

export function encodeNewAgent(domain: string, agentAccount: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: identityRegistrationAbi,
    functionName: 'newAgent',
    args: [domain, agentAccount],
  })
}

export async function getAgentByDomain(params: {
  publicClient: PublicClient,
  registry: `0x${string}`,
  domain: string,
}): Promise<`0x${string}` | null> {
  const { publicClient, registry } = params
  const domain = params.domain.trim().toLowerCase()
  const zero = '0x0000000000000000000000000000000000000000'
  // First, try canonical resolveByDomain which returns a struct
  try {
    const info: any = await publicClient.readContract({
      address: registry,
      abi: identityRegistrationAbi,
      functionName: 'resolveByDomain' as any,
      args: [domain],
    })
    const addr = (info?.agentAddress ?? info?.[2]) as `0x${string}` | undefined
    if (addr && addr !== zero) return addr
  } catch {}
  const fns: Array<'agentOfDomain' | 'getAgent' | 'agents'> = ['agentOfDomain', 'getAgent', 'agents']
  for (const fn of fns) {
    try {
      const addr = await publicClient.readContract({
        address: registry,
        abi: identityRegistrationAbi,
        functionName: fn as any,
        args: [domain],
      }) as `0x${string}`
      if (addr && addr !== zero) return addr
    } catch {}
  }
  return null
}


// Ensure a Smart Account is deployed using a sponsored 4337 UserOperation
export async function deploySmartAccountIfNeeded(params: {
  bundlerUrl: string,
  chain: Chain,
  account: { isDeployed: () => Promise<boolean> }
}): Promise<boolean> {
  const { bundlerUrl, chain, account } = params
  const isDeployed = await account.isDeployed()
  if (isDeployed) return false
  const pimlico = createPimlicoClient({ transport: http(bundlerUrl) })
  const bundlerClient = createBundlerClient({
    transport: http(bundlerUrl),
    paymaster: true,
    chain,
    paymasterContext: { mode: 'SPONSORED' },
  }) as any
  const { fast } = await pimlico.getUserOperationGasPrice()
  const userOperationHash = await bundlerClient.sendUserOperation({
    account,
    calls: [{ to: zeroAddress }],
    ...fast,
  })
  await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash })
  return true
}

// Send a sponsored 4337 call via paymaster from a Smart Account
export async function sendSponsoredUserOperation(params: {
  bundlerUrl: string,
  chain: Chain,
  account: any,
  calls: { to: `0x${string}`; data?: `0x${string}`; value?: bigint }[],
}): Promise<`0x${string}`> {
  const { bundlerUrl, chain, account, calls } = params


  const key1 = BigInt(Date.now())      // or some secure random
      const nonce1 = encodeNonce({ key: key1, sequence: 0n })
  const paymasterClient = createPaymasterClient({
    transport: http(bundlerUrl),
  });
  const pimlicoClient = createPimlicoClient({
    transport: http(bundlerUrl),
  });
  const bundlerClient = createBundlerClient({
                  transport: http(bundlerUrl),
                  paymaster: paymasterClient,
                  chain: chain,
                  paymasterContext: {
                    mode:             'SPONSORED',
                  },
                });
  const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
      let userOpHash: Hex;

      userOpHash = await bundlerClient.sendUserOperation({
        account: account,
        calls: calls,
        nonce: nonce1,
        paymaster: paymasterClient,
        ...fee

      });
      return userOpHash


      /*
  const pimlico = createPimlicoClient({ transport: http(bundlerUrl) })
  const bundlerClient = createBundlerClient({
    transport: http(bundlerUrl),
    paymaster: true,
    chain,
    paymasterContext: { mode: 'SPONSORED' },
  }) as any
  const { fast } = await pimlico.getUserOperationGasPrice()
  const userOperationHash = await bundlerClient.sendUserOperation({
    account,
    calls,
    // Set non-zero gas limits to avoid 0x simulation reasons
    callGasLimit: 800000n,
    verificationGasLimit: 600000n,
    preVerificationGas: 120000n,
    ...fast,
  })
  await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash })
  return userOperationHash
  */
}

// Full flow: check existing, deploy AA if needed, then sponsored call to register
export async function ensureIdentityWithAA(params: {
  publicClient: PublicClient,
  bundlerUrl: string,
  chain: Chain,
  registry: `0x${string}`,
  domain: string,
  agentAccount: any,
}): Promise<`0x${string}`> {
  const { publicClient, bundlerUrl, chain, registry, domain, agentAccount } = params
  const existing = await getAgentByDomain({ publicClient, registry, domain })
  if (existing) return existing

  console.info("bundler url: ", bundlerUrl)
  console.info("chain: ", chain)
  console.info("registry: ", registry)
  console.info("domain: ", domain)
  console.info("agent account: ", agentAccount)

  console.info("deploy smart account if needed")
  await deploySmartAccountIfNeeded({ bundlerUrl, chain, account: agentAccount })
  const agentAddress = await agentAccount.getAddress()
  console.info("agent address: ", agentAddress)

  console.info("encode new agent")
  const data = encodeNewAgent(domain.trim().toLowerCase(), agentAddress as `0x${string}`)
  console.info("data: ", data)

  console.info("send sponsored user operation")
  await sendSponsoredUserOperation({ bundlerUrl, chain, account: agentAccount, calls: [{ to: registry, data, value: 0n }] })

  console.info("get agent by domain")
  const updated = await getAgentByDomain({ publicClient, registry, domain })
  return (updated ?? agentAddress)
}


