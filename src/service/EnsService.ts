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

    static async createEnsDomainName(smartAccountClient: MetaMaskSmartAccount, ensName: string, chain: Chain) : Promise<string> {

        const provider = new ethers.BrowserProvider(window.ethereum)
        const name = ensName
    
        // Clean the ENS name by removing invalid characters, spaces, and prefixes
        const cleanEnsName = ensName.replace(/^ENS:\s*/, '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
        const ensFullName = cleanEnsName + ".eth"
    
    
        // Use mainnet for ENS operations as it has full ENS support
        console.log("...................... process this stuff .............: ", ensFullName)
        const ensClient = createEnsPublicClient({
              chain: chain as any, // Use the chain passed in by the user
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

        // Unified ENS record management function
        const manageEnsRecords = async () => {
            console.log("Managing ENS records for:", ensFullName);
            
            try {
                // Create public client for reading current ENS records
                const publicClient = createPublicClient({
                    chain: chain,
                    transport: http(RPC_URL),
                });
                
                // Create bundler client for setting ENS records
                const ensBundlerClient = createBundlerClient({
                    transport: http(BUNDLER_URL),
                    paymaster: true,
                    chain: chain,
                    paymasterContext: {
                        mode: 'SPONSORED',
                    },
                });
                
                // Use fixed gas fees like in your codebase
                const fee = {maxFeePerGas: 412596685n, maxPriorityFeePerGas: 412596676n};
                
                const smartAccountAddress = await smartAccountClient.getAddress();
                console.log("Smart Account Address for ENS records:", smartAccountAddress);
                
                // Check current address record
                const currentAddress = await publicClient.readContract({
                    address: resolverAddress as `0x${string}`,
                    abi: PublicResolverABI.abi,
                    functionName: 'addr',
                    args: [node]
                });
                console.log("Current address record:", currentAddress);
                
                // Check current website text record
                const currentWebsite = await publicClient.readContract({
                    address: resolverAddress as `0x${string}`,
                    abi: PublicResolverABI.abi,
                    functionName: 'text',
                    args: [node, 'website']
                });
                console.log("Current website record:", currentWebsite);
                
                // Check current reverse name record
                const reverseNode = namehash(smartAccountAddress.slice(2).toLowerCase() + '.addr.reverse');
                console.log("Reverse node:", reverseNode);
                
                const currentReverseName = await publicClient.readContract({
                    address: resolverAddress as `0x${string}`,
                    abi: PublicResolverABI.abi,
                    functionName: 'name',
                    args: [reverseNode]
                });
                console.log("Current reverse name record:", currentReverseName);
                
                // Set address record only if it's different or empty
                if (currentAddress !== smartAccountAddress) {
                    console.log("Setting ENS address record...");
                    const setAddressData = encodeFunctionData({
                        abi: PublicResolverABI.abi,
                        functionName: 'setAddr',
                        args: [node, smartAccountAddress]
                    });
                    
                    const addressUserOperationHash = await ensBundlerClient.sendUserOperation({
                        account: smartAccountClient,
                        calls: [{
                            to: resolverAddress as `0x${string}`,
                            data: setAddressData,
                            value: 0n
                        }],
                        ...fee
                    });
                    
                    const { receipt: addressReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                        hash: addressUserOperationHash,
                    });
                    console.log("✅ ENS address record set successfully");
                } else {
                    console.log("✅ ENS address record already set correctly");
                }
                
                // Set website text record only if it's different or empty
                if (currentWebsite !== 'https://www.richcanvas3.com') {
                    console.log("Setting ENS website text record...");
                    const setWebsiteData = encodeFunctionData({
                        abi: PublicResolverABI.abi,
                        functionName: 'setText',
                        args: [node, 'website', 'https://www.richcanvas3.com']
                    });
                    
                    const websiteUserOperationHash = await ensBundlerClient.sendUserOperation({
                        account: smartAccountClient,
                        calls: [{
                            to: resolverAddress as `0x${string}`,
                            data: setWebsiteData,
                            value: 0n
                        }],
                        ...fee
                    });
                    
                    const { receipt: websiteReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                        hash: websiteUserOperationHash,
                    });
                    console.log("✅ ENS website text record set successfully");
                } else {
                    console.log("✅ ENS website text record already set correctly");
                }
                
                // Set reverse name record only if it's different or empty
                if (currentReverseName !== ensFullName) {
                    console.log("Setting reverse name record...");
                    const setNameData = encodeFunctionData({
                        abi: PublicResolverABI.abi,
                        functionName: 'setName',
                        args: [reverseNode, ensFullName]
                    });
                    
                    const reverseUserOperationHash = await ensBundlerClient.sendUserOperation({
                        account: smartAccountClient,
                        calls: [{
                            to: resolverAddress as `0x${string}`,
                            data: setNameData,
                            value: 0n
                        }],
                        ...fee
                    });
                    
                    const { receipt: reverseReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                        hash: reverseUserOperationHash,
                    });
                    console.log("✅ Reverse name record set successfully");
                } else {
                    console.log("✅ Reverse name record already set correctly");
                }
                
                console.log(`🎉 ENS records check and update completed for ${ensFullName}`);
                console.log(`📍 Address: ${smartAccountAddress}`);
                console.log(`🌐 Website: https://www.richcanvas3.com`);
                console.log(`🔄 Reverse resolution: ${smartAccountAddress} → ${ensFullName}`);
                
            } catch (error) {
                console.error("Error managing ENS records:", error);
            }
        };

        if (resolverAddress != "0x0000000000000000000000000000000000000000") {
            // ENS domain exists - update records
            console.log("ENS domain exists, updating records...");
            
            const resolverABI = ['function addr(bytes32 node) view returns (address)'];
            const resolver = new ethers.Contract(resolverAddress, resolverABI, provider);
            const address = await resolver.addr(node);
            console.log(".................. Current Address:", address);

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
                return ensFullName;
            }
        
            // Fetch the avatar text record
            const avatar = await ensNameResolver.getText("avatar");
            console.log("Avatar URI:", avatar);
            
            // Update existing ENS records
            await manageEnsRecords();
        }
        else {


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
                chain: chain,
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
                chain: chain,
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
                return ensFullName;
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
                    return ensFullName;
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
            console.log(`🔗 View: https://sepolia.app.ens.domains/${ensName}?tab=more`);
            
            // After successful registration, set the ENS records
            console.log("Setting up ENS records for newly created domain...");
            await manageEnsRecords();
        }
        
        return ensName;
    }

    /**
     * Get ENS name for an address (reverse resolution)
     */
    static async getEnsName(address: string, chain: Chain): Promise<string | null> {
        try {
            const ensClient = createEnsPublicClient({
                chain: chain as any,
                transport: http(RPC_URL),
            });

            const name = await ensClient.getName({
                address: address as `0x${string}`,
            });

            return name?.name || null;
        } catch (error) {
            console.error("Error getting ENS name:", error);
            return null;
        }
    }

    /**
     * Get ENS name and basic data for an address
     */
    static async getEnsData(address: string, chain: Chain): Promise<{ name: string | null; avatar: string | null }> {
        try {
            const ensClient = createEnsPublicClient({
                chain: chain as any,
                transport: http(RPC_URL),
            });

            const name = await ensClient.getName({
                address: address as `0x${string}`,
            });

            return {
                name: name?.name || null,
                avatar: null // Avatar will be handled separately if needed - updated
            };
        } catch (error) {
            console.error("Error getting ENS data:", error);
            return { name: null, avatar: null };
        }
    }

    /**
     * Get comprehensive ENS data including text records
     */
    static async getEnsComprehensiveData(address: string, chain: Chain): Promise<{
        name: string | null;
        avatar: string | null;
        website: string | null;
        email: string | null;
        twitter: string | null;
        github: string | null;
        discord: string | null;
    }> {
        try {
            const ensData = await this.getEnsData(address, chain);
            
            if (!ensData.name) {
                return {
                    name: null,
                    avatar: null,
                    website: null,
                    email: null,
                    twitter: null,
                    github: null,
                    discord: null
                };
            }

            // For now, return basic data without text records
            // Text records can be added later when we have the correct ENS client methods
            return {
                name: ensData.name,
                avatar: ensData.avatar,
                website: null,
                email: null,
                twitter: null,
                github: null,
                discord: null
            };
        } catch (error) {
            console.error("Error getting comprehensive ENS data:", error);
            return {
                name: null,
                avatar: null,
                website: null,
                email: null,
                twitter: null,
                github: null,
                discord: null
            };
        }
    }
}
export default EnsService;