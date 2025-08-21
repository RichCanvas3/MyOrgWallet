import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, type PublicClient, type WalletClient, decodeEventLog } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { config } from 'dotenv'
import { hexToBytes } from 'viem';
config()

const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.org'
const PRIVATE_KEY = process.env.SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY as `0x${string}`
const DELEGATED_CONTRACT_ADDRESS = process.env.DELEGATED_CONTRACT_ADDRESS as `0x${string}`

// Optional EIP-7702 authorization pieces from env (fallback if signer cannot signAuthorization)
const AUTH_CHAIN_ID = process.env.EIP7702_AUTH_CHAIN_ID
const AUTH_ADDRESS = process.env.EIP7702_AUTH_ADDRESS as `0x${string}` | undefined
const AUTH_NONCE = process.env.EIP7702_AUTH_NONCE
const AUTH_Y_PARITY = process.env.EIP7702_AUTH_Y_PARITY
const AUTH_R = process.env.EIP7702_AUTH_R as `0x${string}` | undefined
const AUTH_S = process.env.EIP7702_AUTH_S as `0x${string}` | undefined

// Updated ABI to match the provided Delegation contract
const DelegatedAbi = parseAbi([
  'function initialize()',
  'function ping()',
  'event Log(string message)'
])

function validateEnv(): void {
  if (!PRIVATE_KEY) throw new Error('SEPOLIA_TEST_ACCOUNT_PRIVATE_KEY is required')
  if (!DELEGATED_CONTRACT_ADDRESS) throw new Error('DELEGATED_CONTRACT_ADDRESS is required')
}

async function main(): Promise<void> {
  console.log('🚀 7702 Simple Delegation Test (assume deployed + delegated)')
  validateEnv()

  const account: PrivateKeyAccount = privateKeyToAccount(PRIVATE_KEY)

  const publicClient: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL)
  })

  const addr = '0x9cfc7E44757529769A28747F86425C682fE64653';
    const latest = await publicClient.getTransactionCount({ address: addr, blockTag: 'latest' });
    const pending = await publicClient.getTransactionCount({ address: addr, blockTag: 'pending' });
    console.log({ latest, pending });

    const client = createWalletClient({
        account: account,
        chain: sepolia,
        transport: http(RPC_URL)
      });

      const abi = [{ type:'function', name:'ping', stateMutability:'nonpayable', inputs:[], outputs:[] }];

      console.log('........... Sending transaction...');
        const hash = await client.sendTransaction({
            to: '0xC7A4F4Df76393387b8e74E65e185d8A9fad2e8D8',
            data: encodeFunctionData({ abi, functionName: 'ping' }),

            maxPriorityFeePerGas: 1_000_000_000n,        // 1 gwei
            maxFeePerGas:        3_000_000_000n,        // 3 gwei
        });

        console.log('........... Tx hash:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Receipt:', receipt);
      
      const eoa = '0x9cfc7E44757529769A28747F86425C682fE64653' as const;
      const delegator = '0xC7A4F4Df76393387b8e74E65e185d8A9fad2e8D8'; // your stateless delegator contract
      
      // ABI for your delegator’s ping()
      
      const data = encodeFunctionData({ abi, functionName: 'ping' });


      const domain = {
        name: 'EIP7702Authorization',
        version: '1',
        chainId: 11155111,   // Sepolia
      };
      
      const types = {
        Authorization: [
          { name: 'chainId', type: 'uint256' },
          { name: 'address', type: 'address' },
          { name: 'nonce',   type: 'uint256' },
        ],
      };
      
      const value = {
        chainId: BigInt(11155111),
        address: delegator,
        nonce: 0n,
      };
      
      const signature = await client.signTypedData({
        account,
        domain,
        types,
        primaryType: 'Authorization',
        message: value,
      });

      const sigBytes = hexToBytes(signature); // 65 bytes
        const r = '0x' + Buffer.from(sigBytes.slice(0, 32)).toString('hex');
        const s = '0x' + Buffer.from(sigBytes.slice(32, 64)).toString('hex');
        const v = sigBytes[64];
        const yParity = v % 2;
      
      // Build the off-chain 7702 authorization (shape varies by lib; placeholder values below):
      const auth = {
        chainId: BigInt(11155111),
        address: delegator,
        nonce: 0n,
        yParity,
        r,
        s,
      };
      

      const hash2 = await client.sendTransaction({
        // IMPORTANT
        type: 'eip7702',
        to: eoa,                   // most stateless patterns target the EOA (transient code intercepts)
        data,
        authorizationList: [auth],
        maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei
        maxFeePerGas:        3_000_000_000n,  // 3 gwei (or estimate & bump)
      });


    console.log('........... Tx hash2:', hash2);
    const receipt2   = await publicClient.waitForTransactionReceipt({ hash: hash2 });
    console.log('Receipt2:', receipt2)  ;
}

main().catch((err) => { console.error('❌ Test failed:', err); process.exit(1) })
