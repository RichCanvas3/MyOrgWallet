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

// ABI for ERC4337Wrapper
export const abi = parseAbi([
  'function implementationAddress() view returns (address)',
  'function nonce() view returns (uint256)',
  'function authorizedDelegates(address) view returns (bool)',
  'function forwardReceiver() view returns (address)',
  'function authorizeDelegate(address delegate)',
  'function revokeDelegate(address delegate)',
  'function setForwardReceiver(address receiver)',
  'function clearForwardReceiver()',
  'function execute(address target, uint256 value, bytes data)',
  'function executeWithSignature(address target, uint256 value, bytes data, bytes signature)',
  'function executeBatch(address[] targets, uint256[] values, bytes[] datas)',
  'function forward(address to, uint256 amount)',
  'function withdraw(uint256 amount)',
  'function ping()',
  'function debugWho() view returns (address msgSender, address self, bool auth)',
  'event DelegateAuthorized(address indexed delegate)',
  'event DelegateRevoked(address indexed delegate)',
  'event TransactionExecuted(address indexed target, uint256 value, bytes data)',
  'event EIP7702DelegationReceived(address indexed from, uint256 value)',
  'event AutoForwardReceiverSet(address indexed receiver)',
  'event AutoForwarded(address indexed from, address indexed to, uint256 amount)',
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

      const ammont = 100n
      const recipient = '0x8272226863aACD003975B5C497E366c14D009605'
      // Ensure forward receiver is an EOA (accepts ETH). If recipient is a contract, use burn EOA.
      const codeAtRecipient = await publicClient.getCode({ address: recipient as `0x${string}` });
      const receiverEoa = (codeAtRecipient === '0x'
        ? (recipient as `0x${string}`)
        : ('0x000000000000000000000000000000000000dEaD' as const));



      const delegator = '0x4879fCAe486979B80aE130FE2fa2E3Ab633c7dda'; // your stateless delegator contract
      
      /*
      console.log('........... Sending transaction...');
        const hash = await client.sendTransaction({
            to: delegator,
            data: data1,  //encodeFunctionData({ abi, functionName: 'ping' }),

            maxPriorityFeePerGas: 1_000_000_000n,        // 1 gwei
            maxFeePerGas:        3_000_000_000n,        // 3 gwei
        });

        console.log('........... Tx hash:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Receipt:', receipt);
      */
      const eoa = '0x9cfc7E44757529769A28747F86425C682fE64653' as const;


            
      // 1) Configure auto-forward receiver on the EOA via 7702 call to itself
      const setForwardData = encodeFunctionData({
        abi,
        functionName: 'setForwardReceiver',
        args: [receiverEoa],
      });
      const authSet = await client.signAuthorization({ contractAddress: delegator });
      const txSet = await client.sendTransaction({
        type: 'eip7702',
        to: eoa,
        data: setForwardData,
        authorizationList: [authSet],
        maxPriorityFeePerGas: 1_000_000_000n,
        maxFeePerGas:        3_000_000_000n,
      });
      console.log('SetForwardReceiver tx:', txSet);
      const setReceipt = await publicClient.waitForTransactionReceipt({ hash: txSet });
      console.log('SetForwardReceiver receipt:', setReceipt);



      // Simple funding transfer to the EOA under 7702 (triggers receive() auto-forward)
      const fundAmount = 100_000_000_000_000n; // 0.0001 ETH
      const fundAuth = authSet; // reuse same delegator authorization
      const fundHash = await client.sendTransaction({
        type: 'eip7702',
        to: eoa,
        value: fundAmount,
        authorizationList: [fundAuth],
        maxPriorityFeePerGas: 1_000_000_000n,
        maxFeePerGas:        3_000_000_000n,
      });
      console.log('Fund (7702) tx:', fundHash);
      const rec = await publicClient.waitForTransactionReceipt({ hash: fundHash });
      console.log('Fund receipt:', rec);

      /*
      const WRAPPER = '0xA41d7095bb93c17Ef47cE305f5887215359F223c' as const;
        const EOA     = '0x9cfc7E44757529769A28747F86425C682fE64653' as const;

        const owner = await publicClient.readContract({
        address: WRAPPER,
        abi,
        functionName: 'owner',
        });
        console.log({ owner, EOA }); // must match exactly (case-insensitive)
      */
      // ABI for your delegator’s ping()
      
      //const data = encodeFunctionData({ abi, functionName: 'ping' });


      // 2) Now execute a normal call (or send ETH) as before
      const data = encodeFunctionData({
        abi: abi,
        functionName: "execute",
        args: [recipient, ammont, "0x"],
      });
      

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
      
      // Build the off-chain 7702 authorization
      /*
      const auth = {
        chainId: BigInt(11155111),
        address: delegator,
        nonce: 0n,
        yParity,
        r,
        s,
      };
      */

      const balEOA = await publicClient.getBalance({ address: eoa });
const balRecipient = await publicClient.getBalance({ address: recipient });
console.log({ balEOA: balEOA.toString(), balRecipient: balRecipient.toString() });

      const auth = await client.signAuthorization({
        contractAddress: delegator, // deployed ERC4337MultiEOAWrapper
      });
      

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
