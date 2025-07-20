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
        let cleanEnsName = ensName.replace(/^ENS:\s*/, '');
        // Remove .eth suffix if present
        cleanEnsName = cleanEnsName.replace(/\.eth$/i, '');
        // Remove any other non-alphanumeric characters except hyphens
        cleanEnsName = cleanEnsName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
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

            // Fetch the avatar using the ENS name
            let avatar = null;
            console.log("About to fetch avatar for ENS name:", ensData.name, "on chain:", chain.name);
            try {
                avatar = await this.getEnsAvatar(ensData.name, chain);
                console.log("Fetched avatar for ENS name:", ensData.name, "Avatar:", avatar);
            } catch (avatarError) {
                console.error("Error fetching avatar for ENS name:", ensData.name, avatarError);
                console.error("Avatar error details:", avatarError);
            }

            // For now, return basic data with avatar
            // Text records can be added later when we have the correct ENS client methods
            return {
                name: ensData.name,
                avatar: avatar,
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

    /**
     * Get ENS avatar URL for a specific ENS name
     */
    static async getEnsAvatar(ensName: string, chain: Chain): Promise<string | null> {
        try {
            console.log("getEnsAvatar called with:", { ensName, chainName: chain.name });
            
            // Clean the ENS name
            let cleanEnsName = ensName.replace(/^ENS:\s*/, '');
            cleanEnsName = cleanEnsName.replace(/\.eth$/i, '');
            cleanEnsName = cleanEnsName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            const ensFullName = cleanEnsName + ".eth";

            console.log("ENS name cleaning:", { original: ensName, cleaned: cleanEnsName, fullName: ensFullName });
            
            // Validate the cleaned name
            if (!cleanEnsName || cleanEnsName.length < 3) {
                console.error("Invalid ENS name after cleaning:", { original: ensName, cleaned: cleanEnsName });
                return null;
            }

            // Create public client for reading ENS records
            const publicClient = createPublicClient({
                chain: chain,
                transport: http(RPC_URL),
            });

            const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
            const node = namehash(ensFullName);
            
            // Get resolver address
            const resolverAddress = await publicClient.readContract({
                address: ENS_REGISTRY_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'resolver',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'node', type: 'bytes32' }],
                    outputs: [{ name: '', type: 'address' }]
                }],
                functionName: 'resolver',
                args: [node]
            });

            if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
                console.log("No resolver found for ENS name:", ensFullName);
                console.log("Resolver address returned:", resolverAddress);
                return null;
            }

            console.log("Resolver address found:", resolverAddress);

            // Get avatar text record
            console.log("Fetching avatar text record for node:", node);
            const avatar = await publicClient.readContract({
                address: resolverAddress as `0x${string}`,
                abi: PublicResolverABI.abi,
                functionName: 'text',
                args: [node, 'avatar']
            });

            console.log("Avatar text record result:", avatar);
            console.log("Avatar type:", typeof avatar);
            const result = typeof avatar === 'string' ? avatar : null;
            console.log("Returning avatar:", result);
            return result;
        } catch (error) {
            console.error("Error getting ENS avatar:", error);
            return null;
        }
    }

    /**
     * Find the correct ENS name for an organization
     */
    static async findCorrectEnsName(smartAccountClient: MetaMaskSmartAccount, chain: Chain): Promise<string | null> {
        try {
            const orgAddress = await smartAccountClient.getAddress();
            console.log("Looking for ENS name for address:", orgAddress);
            
            // Try to get the reverse resolution
            const ensName = await this.getEnsName(orgAddress, chain);
            
            if (ensName) {
                console.log("Found ENS name via reverse resolution:", ensName);
                return ensName;
            }
            
            console.log("No ENS name found via reverse resolution");
            return null;
        } catch (error) {
            console.error("Error finding ENS name:", error);
            return null;
        }
    }

    /**
     * Update ENS avatar (logo) for an existing ENS name
     */
    static async updateEnsAvatar(smartAccountClient: MetaMaskSmartAccount, ensName: string, avatarUrl: string, chain: Chain): Promise<boolean> {
        try {

            let cleanEnsName = ensName.replace(/^ENS:\s*/, '');
            cleanEnsName = cleanEnsName.replace(/\.eth$/i, '');
            cleanEnsName = cleanEnsName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();

            const ensFullName = cleanEnsName + ".eth";


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

            const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
            const node = namehash(ensFullName);
            
            // First check if the ENS name exists by getting its owner
            const owner = await publicClient.readContract({
                address: ENS_REGISTRY_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'owner',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'node', type: 'bytes32' }],
                    outputs: [{ name: '', type: 'address' }]
                }],
                functionName: 'owner',
                args: [node]
            });

            if (!owner || owner === '0x0000000000000000000000000000000000000000') {
                console.error("ENS name does not exist:", ensFullName);
                console.error("Current network:", chain.name);
                console.error("Possible solutions:");
                console.error("1. Check if the ENS name is correct");
                console.error("2. The ENS name might be on mainnet instead of Sepolia");
                console.error("3. The ENS name might not be registered yet");
                
                // Try to suggest alternative names
                const suggestions = [
                    cleanEnsName.replace('eth', ''),
                    cleanEnsName.replace('canvas', ''),
                    cleanEnsName.replace('rich', ''),
                    'aarichcanvas',
                    'richcanvas'
                ];
                console.error("Suggested ENS names to try:", suggestions);
                
                return false;
            }

            console.log("ENS owner:", owner);
            
            // Check if the smart account is the owner
            const smartAccountAddress = await smartAccountClient.getAddress();
            if (owner.toLowerCase() !== smartAccountAddress.toLowerCase()) {
                console.error("Smart account is not the owner of the ENS name");
                console.error("Smart account address:", smartAccountAddress);
                console.error("ENS owner:", owner);
                console.error("You can only update ENS records if you own the ENS name");
                return false;
            }
            
            // Get resolver address
            const resolverAddress = await publicClient.readContract({
                address: ENS_REGISTRY_ADDRESS as `0x${string}`,
                abi: [{
                    name: 'resolver',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'node', type: 'bytes32' }],
                    outputs: [{ name: '', type: 'address' }]
                }],
                functionName: 'resolver',
                args: [node]
            });

            if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
                console.error("No resolver found for ENS name:", ensFullName);
                console.error("This could mean:");
                console.error("1. The ENS name doesn't exist");
                console.error("2. The ENS name is on a different network");
                console.error("3. The ENS name doesn't have a resolver set");
                console.error("Current network:", chain.name);
                return false;
            }

            console.log("Resolver address:", resolverAddress);

            // Check current avatar to see if it's already set
            try {
                const currentAvatar = await publicClient.readContract({
                    address: resolverAddress as `0x${string}`,
                    abi: PublicResolverABI.abi,
                    functionName: 'text',
                    args: [node, 'avatar']
                });
                console.log("Current avatar:", currentAvatar);
                
                if (currentAvatar === avatarUrl) {
                    console.log("Avatar is already set to the same value");
                    return true;
                }
            } catch (error) {
                console.log("Could not read current avatar, proceeding with update");
            }

            // Set avatar text record
            const setAvatarData = encodeFunctionData({
                abi: PublicResolverABI.abi,
                functionName: 'setText',
                args: [node, 'avatar', avatarUrl]
            });

            console.log("Setting avatar with data:", setAvatarData);
            console.log("Calling resolver at:", resolverAddress);

            try {
                const avatarUserOperationHash = await ensBundlerClient.sendUserOperation({
                    account: smartAccountClient,
                    calls: [{
                        to: resolverAddress as `0x${string}`,
                        data: setAvatarData,
                        value: 0n
                    }],
                    ...fee
                });

                const { receipt: avatarReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                    hash: avatarUserOperationHash,
                });

                console.log("✅ ENS avatar updated successfully");
                console.log(`🔗 View: https://sepolia.app.ens.domains/${ensFullName}?tab=more`);
                
                return true;
            } catch (resolverError) {
                console.error("Failed to update avatar with current resolver:", resolverError);
                console.log("Trying to set a new resolver first...");
                
                // Try to set a new resolver first, then update the avatar
                const PublicResolverAddress = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD'; // default on Sepolia
                
                const setResolverData = encodeFunctionData({
                    abi: [{
                        name: 'setResolver',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'node', type: 'bytes32' },
                            { name: 'resolver', type: 'address' }
                        ],
                        outputs: []
                    }],
                    functionName: 'setResolver',
                    args: [node, PublicResolverAddress as `0x${string}`]
                });

                const resolverUserOperationHash = await ensBundlerClient.sendUserOperation({
                    account: smartAccountClient,
                    calls: [{
                        to: ENS_REGISTRY_ADDRESS as `0x${string}`,
                        data: setResolverData,
                        value: 0n
                    }],
                    ...fee
                });

                const { receipt: resolverReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                    hash: resolverUserOperationHash,
                });

                console.log("✅ New resolver set successfully");

                // Now try to set the avatar with the new resolver
                const newSetAvatarData = encodeFunctionData({
                    abi: PublicResolverABI.abi,
                    functionName: 'setText',
                    args: [node, 'avatar', avatarUrl]
                });

                const newAvatarUserOperationHash = await ensBundlerClient.sendUserOperation({
                    account: smartAccountClient,
                    calls: [{
                        to: PublicResolverAddress as `0x${string}`,
                        data: newSetAvatarData,
                        value: 0n
                    }],
                    ...fee
                });

                const { receipt: newAvatarReceipt } = await ensBundlerClient.waitForUserOperationReceipt({
                    hash: newAvatarUserOperationHash,
                });

                console.log("✅ ENS avatar updated successfully with new resolver");
                console.log(`🔗 View: https://sepolia.app.ens.domains/${ensFullName}?tab=more`);
                
                return true;
            }
        } catch (error) {
            console.error("Error updating ENS avatar:", error);
            
            // Provide more specific error information
            if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('UserOperation reverted')) {
                console.error("The transaction was reverted. This could be because:");
                console.error("1. The smart account doesn't have permission to update this ENS record");
                console.error("2. The resolver contract doesn't support the setText function");
                console.error("3. The ENS name might be on a different network");
                console.error("4. The resolver might be outdated or incompatible");
            }
            
            return false;
        }
    }
}
export default EnsService;