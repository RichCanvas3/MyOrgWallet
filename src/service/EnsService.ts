import { hexlify, parseEther, formatEther, ethers } from 'ethers';
import {OPENAI_DEFAULT_SYSTEM_PROMPT, OPENAI_DEFAULT_ASSISTANT_PROMPT, RPC_URL, BUNDLER_URL} from "../config";
import { createPublicClient, http, type Chain } from 'viem';
import { createEnsPublicClient } from '@ensdomains/ensjs'
import { mainnet, sepolia } from 'viem/chains'

import ETHRegistrarControllerABI from '../abis/ETHRegistrarController.json'
import PublicResolverABI from '../abis/PublicResolver.json'

import {
    Implementation,
    toMetaMaskSmartAccount,
    type MetaMaskSmartAccount,
    type DelegationStruct,
    createDelegation,
    DelegationFramework,
    SINGLE_DEFAULT_MODE,
    getExplorerTransactionLink,
    getExplorerAddressLink,
    createExecution,
    Delegation,
    getDeleGatorEnvironment
  } from "@metamask/delegation-toolkit";

  import { encodeFunctionData, namehash } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';


class EnsService {

    static async createEnsDomainName(smartAccountClient: MetaMaskSmartAccount, ensName: string, chain: Chain) : Promise<void> {

        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()
        const name = ensName
    
        // Clean the ENS name by removing invalid characters, spaces, and prefixes
        const cleanEnsName = ensName.replace(/^ENS:\s*/, '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
        const ensFullName = cleanEnsName + ".eth"
    
        const duration = 31536000 // 60 * 60 * 24 * 365
        const secret = hexlify(ethers.randomBytes(32))
    
        const ETHRegistrarControllerAddress = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968'
        const PublicResolverAddress = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5'
    
    
        // set resolver for the ENS domain name,   so that folks can resolve the address to the ENS name
        // this only works for EOA addresses and not AA addresses.
        // we are going to use EAS entries to resolve from AA to ENS name
        // Sepolia ENS Registry
        /*
          const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; 
          const PUBLIC_RESOLVER_ADDRESS = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
          const ENSRegistryABI = [
            'function setResolver(bytes32 node, address resolver) external'
          ];
    
          const ensFullName = ensName + ".eth"
          //const node = namehash("richcanvas.eth");
          const node = namehash(ensFullName);
          const ensRegistry = new ethers.Contract(ENS_REGISTRY_ADDRESS, ENSRegistryABI, signatory.walletClient);
    
          const tx = await ensRegistry.setResolver(node, PUBLIC_RESOLVER_ADDRESS);
          console.log('Setting resolver tx sent:', tx.hash);
    
          await tx.wait();
          console.log('✅ Resolver set successfully');
    
          // test the resolver using the ensClient
          const ensClient = createPublicClient({
              chain: chain,
              transport: http(RPC_URL),
            });
    
          const name = await ensClient.getName({
            address: address as `0x${string}`,
          });
          console.log("Current ENS name:", name);
    
    
        */
    
    
        // Use mainnet for ENS operations as it has full ENS support
        console.log("...................... process this stuff .............: ", ensFullName)
        const ensClient = createEnsPublicClient({
              chain: sepolia,
              transport: http(RPC_URL),
            });
    
    
        // Get the address for the name
        console.log("...................... process this stuff .............: ", ensFullName)
        const ensAddress = await ensClient.getAddressRecord({
            name: ensFullName,
        });
        console.log("Current ENS address:", ensAddress);

        
        const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
        const ENSRegistryABI = ['function resolver(bytes32 node) view returns (address)'];


        const node = namehash(ensFullName);
        const registry = new ethers.Contract(ENS_REGISTRY_ADDRESS, ENSRegistryABI, provider);
        const resolverAddress = await registry.resolver(node);
        console.log(".................. Resolver address:", resolverAddress);


        const registryABI = ['function owner(bytes32 node) view returns (address)'];
        const registry2 = new ethers.Contract(ENS_REGISTRY_ADDRESS, registryABI, provider);
        const owner = await registry2.owner(node);
        console.log(".................. Owner:", owner);


        if (resolverAddress != "0x0000000000000000000000000000000000000000") {
    
            const resolverABI = ['function addr(bytes32 node) view returns (address)'];
            const resolver = new ethers.Contract(resolverAddress, resolverABI, provider);
            const address = await resolver.addr(node);
            console.log(".................. Address:", address);


            try {
                const nameResolver = await provider.getResolver(ensFullName);
                console.log(".................. Name resolver:", nameResolver);
                let ethAddress = null;
                if (nameResolver) {
                    ethAddress = await nameResolver.getAddress();
                    console.log(".................. Eth address:", ethAddress);
                }
        
            }
            catch (error) {
                console.log(".................. Error resolving name:", error);
            }
            


        

            console.log("ENS address found:", ensAddress);

            const ensNameResolver = await provider.getResolver(ensFullName);
            if (!ensNameResolver) {
                console.log("No resolver found for", name);
                return;
            }
        
            // Fetch the avatar text record
            const avatar = await ensNameResolver.getText("avatar");
            console.log("Avatar URI:", avatar);
        
        
        

            // get lots of data from ensdata.net
            //const url = "https://sepolia.api.ensdata.net/" + name
            //const res = await fetch(url)
            //const orgInfo = await res.json()
        }
        else {

            /*
            console.log("ENS address not found:", ensFullName);

            const ethRegistrarController = new ethers.Contract(
                ETHRegistrarControllerAddress,
                ETHRegistrarControllerABI.abi,
                signer
            )
        
            const publicResolver = new ethers.Contract(
                PublicResolverAddress,
                PublicResolverABI.abi,
                signer
            )
        
            console.log('Name: ', name)
            console.log('Duration: ', duration)
            console.log('Secret: ', secret)
        
            createName()
        
            async function createName() {
            const registrationObject = {
                label: name,
                owner: signer.address,
                duration: duration,
                secret: secret,
                resolver: publicResolver.target, // '0x0000000000000000000000000000000000000000' = null, meaning no resolver is set
                data: [],
                reverseRecord: 1, // 0 reverse record flag set to 0
                referrer: '0x0000000000000000000000000000000000000000000000000000000000000000'
            }
        
            const commitment = await ethRegistrarController.makeCommitment(registrationObject)
        
            console.log('Sending commit...')
        
            const tx1 = await ethRegistrarController.commit(commitment)
            await tx1.wait()
        
            console.log('Commit sent. Waiting 60 seconds...')
        
            await new Promise ((r) => setTimeout(r, 60000))
        
            console.log('Waited 60 seconds!')
            console.log('Registering...')
        
            const rentPrice = await ethRegistrarController.rentPrice(`${name}.eth`, 365 * 24 * 60 * 60) // 1 year in seconds
        
            console.log('Rent Price: ', rentPrice)
        
            const tx2 = await ethRegistrarController.register(registrationObject, {
                value: BigInt('3125000000003490') // 0.003125 ETH
            })
        
            await tx2.wait()
        
            // ENS Domain Name Created Successfully
            console.log(`ENS name "${name}.eth" registered!`)
            console.log(`See ENS profile here: https://sepolia.app.ens.domains/${name}.eth`)
            }
            */

            console.log("ENS address not found:", ensFullName);

            // Use the smart account to register the ENS name
            const ensName = `${cleanEnsName}.eth`;
            const node = namehash(ensName);
            const duration = 365 * 24 * 60 * 60;
            const secret = hexlify(ethers.randomBytes(32)) as `0x${string}`;

            const ETHRegistrarControllerAddress = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968'; // Sepolia ENS controller
            const PublicResolverAddress = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD'; // default on Sepolia

            const owner = await smartAccountClient.getAddress();
            console.log(".................. Owner:", owner);

            const registrationObject = {
                label: cleanEnsName,
                owner,
                duration,
                secret,
                resolver: PublicResolverAddress,
                data: [],
                reverseRecord: true, // Changed from 1 to true
                referrer: '0x0000000000000000000000000000000000000000000000000000000000000000'
            };
            
            console.log('Registration object:', registrationObject);

            // Create a public client for reading contract data
            const publicClient = createPublicClient({
                chain: sepolia,
                transport: http(RPC_URL),
            });

            // Step 1: makeCommitment() - use public client to read
            const commitment = await publicClient.readContract({
                address: ETHRegistrarControllerAddress as `0x${string}`,
                abi: ETHRegistrarControllerABI.abi,
                functionName: 'makeCommitment',
                args: [registrationObject]
            });

            // Step 2: commit() - use bundler client to send transaction
            console.log('Sending commit...: ', commitment);
            
            // Create bundler client with paymaster for AA transactions
            const bundlerClient = createBundlerClient({
                transport: http(BUNDLER_URL),
                paymaster: true,
                chain: sepolia,
                paymasterContext: {
                    mode: 'SPONSORED',
                },
            });

            // Use fixed gas fees like in your codebase
            const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n};

            const userOperationHash = await bundlerClient.sendUserOperation({
                account: smartAccountClient,
                calls: [{
                    to: ETHRegistrarControllerAddress as `0x${string}`,
                    data: encodeFunctionData({
                        abi: ETHRegistrarControllerABI.abi,
                        functionName: 'commit',
                        args: [commitment]
                    })
                }],
                ...fee
            });

            // Wait for the transaction to be mined
            const { receipt } = await bundlerClient.waitForUserOperationReceipt({
                hash: userOperationHash,
            });

            console.log('Commit sent. Waiting for commitment to be mined and confirmed...');
            
            // Wait for the commitment transaction to be mined
            await new Promise((r) => setTimeout(r, 30000));
            
            // Additional wait time as required by ENS protocol
            console.log('Waiting additional time for commitment to be confirmed...');
            await new Promise((r) => setTimeout(r, 60000));
            
            // Verify the commitment was made
            console.log('Verifying commitment...');
            const commitmentStatus = await publicClient.readContract({
                address: ETHRegistrarControllerAddress as `0x${string}`,
                abi: ETHRegistrarControllerABI.abi,
                functionName: 'commitments',
                args: [commitment]
            });
            console.log('Commitment status:', commitmentStatus);
            
            // Check if the domain is available
            console.log('Checking domain availability...');
            const domainAvailable = await publicClient.readContract({
                address: ETHRegistrarControllerAddress as `0x${string}`,
                abi: ETHRegistrarControllerABI.abi,
                functionName: 'available',
                args: [cleanEnsName]
            });
            console.log('Domain available:', domainAvailable);
            
            if (!domainAvailable) {
                console.error('Domain is not available for registration');
                return;
            }
            
            // Check if the commitment is still valid (not expired)
            const currentTime = Math.floor(Date.now() / 1000);
            console.log('Current time:', currentTime);
            console.log('Commitment timestamp:', commitmentStatus);
            
            if (commitmentStatus && typeof commitmentStatus === 'bigint') {
                const commitmentTime = Number(commitmentStatus);
                const timeDiff = currentTime - commitmentTime;
                console.log('Time since commitment:', timeDiff, 'seconds');
                
                // ENS commitments are valid for 1 minute (60 seconds)
                if (timeDiff > 120) {
                    console.error('Commitment has expired: ' + timeDiff);
                    return;
                }
            }

            // Step 3: rentPrice() - use public client to read
            const rentPriceResult = await publicClient.readContract({
                address: ETHRegistrarControllerAddress as `0x${string}`,
                abi: ETHRegistrarControllerABI.abi,
                functionName: 'rentPrice',
                args: [cleanEnsName, duration]
            }) as { base: bigint; premium: bigint };

            console.log('Rent price result:', rentPriceResult);
            
            // Extract the total price from the rentPrice result (base + premium)
            const rentPrice = rentPriceResult.base + rentPriceResult.premium;
            console.log('Total rent price:', rentPrice);

            // Step 4: register() - use bundler client to send transaction
            const registerData = encodeFunctionData({
                abi: ETHRegistrarControllerABI.abi,
                functionName: 'register',
                args: [registrationObject]
            });

            console.log('Register data:', registerData);
            console.log('Rent price for registration:', rentPrice);
            console.log('Registration object:', registrationObject);

            // Check if we have enough balance for the transaction
            const accountBalance = await publicClient.getBalance({
                address: smartAccountClient.address as `0x${string}`
            });

            console.log('Smart Account Address:', smartAccountClient.address);
            console.log('Account balance:', accountBalance);
            console.log('Required rent price:', rentPrice);
            console.log('Has sufficient balance:', accountBalance >= rentPrice);

            // Try using the same pattern as other working AA transactions in your codebase
            const registerUserOperationHash = await bundlerClient.sendUserOperation({
                account: smartAccountClient,
                calls: [{
                    to: ETHRegistrarControllerAddress as `0x${string}`,
                    data: registerData,
                    value: rentPrice
                }],
                ...fee
            });
            
            console.log('Register transaction hash:', registerUserOperationHash);
            
            // Wait for the registration transaction to be mined
            const { receipt: registerReceipt } = await bundlerClient.waitForUserOperationReceipt({
                hash: registerUserOperationHash,
            });

            console.log(`✅ ENS name "${ensName}" registered with AA.`);
            console.log(`🔗 View: https://sepolia.app.ens.domains/${ensName}`);
            
        }
        

    }
}
export default EnsService;