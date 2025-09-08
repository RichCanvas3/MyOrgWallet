import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { Attestation, AttestationCategory } from '../models/Attestation';
import { AttestationCard } from './AttestationCard';
import AttestationService, { AttestationChangeEvent, attestationsEmitter } from '../service/AttestationService';
import { useWallectConnectContext } from '../context/walletConnectContext';
import { fetchAgentsByOwner, type AgentData } from '../service/AgentAdapter';
import { createPublicClient, http, keccak256, stringToHex, toHex } from 'viem';
import { sepolia } from 'viem/chains';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/delegation-toolkit';

interface AgentsPageProps {
  orgDid?: string;
  indivDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ orgDid, indivDid, onSelectAttestation }) => {
  const { chain, signatory } = useWallectConnectContext();
  const currentWalletAddress = signatory?.walletClient?.account?.address;
  
  // Debug: Log context values on every render
  console.info("AgentsPage render - context values:", {
    hasChain: !!chain,
    chainId: chain?.id,
    hasSignatory: !!signatory,
    hasWalletClient: !!signatory?.walletClient,
    hasAccount: !!signatory?.walletClient?.account,
    currentWalletAddress,
    orgDid,
    indivDid
  });
  const [categories, setCategories] = useState<AttestationCategory[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [aiAgentAttestations, setAiAgentAttestations] = useState<Attestation[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Debug: Log component mount
  useEffect(() => {
    console.info("AgentsPage component mounted");
    return () => {
      console.info("AgentsPage component unmounted");
    };
  }, []);

  // Debug: Track dependency changes
  useEffect(() => {
    console.info("Dependencies changed:", {
      signatoryAddress: signatory?.walletClient?.account?.address,
      chainId: chain?.id,
      timestamp: new Date().toISOString()
    });
  }, [signatory?.walletClient?.account?.address, chain]);

  const loadAIAgentAttestations = useCallback(async (agents: AgentData[]) => {
    console.info("loadAIAgentAttestations called with agents:", agents.length);
    
    if (!chain || !signatory?.walletClient?.account?.address) {
      console.info("Missing dependencies for loadAIAgentAttestations", { chain: !!chain, signatory: !!signatory });
      return;
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http() });
    const allAIAgentAttestations: Attestation[] = [];

    for (const agent of agents) {
      try {
        console.info(`Loading AIAgent attestation for: ${agent.agentDomain}`);
        
        // Create the agent's AA client to get its address
        const salt = BigInt(keccak256(stringToHex(agent.agentDomain.trim().toLowerCase())));
        const agentAccountClient = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [signatory.walletClient.account.address, [], [], []],
          signatory: { walletClient: signatory.walletClient },
          deploySalt: toHex(salt) as `0x${string}`,
        });

        const agentAddress = await agentAccountClient.getAddress();
        const aiAgentDid = `did:pkh:eip155:${chain.id}:${agentAddress}`;
        
        console.info(`AIAgent DID for ${agent.agentDomain}:`, aiAgentDid);

        // Get AIAgent attestation for this agent
        const aiAgentAttestation = await AttestationService.getAttestationByDidAndSchemaId(
          chain,
          aiAgentDid,
          AttestationService.AIAgentSchemaUID,
          "aiagent(aiagent)",
          agent.agentDomain
        );

        if (aiAgentAttestation) {
          console.info(`Found AIAgent attestation for ${agent.agentDomain}:`, aiAgentAttestation);
          allAIAgentAttestations.push(aiAgentAttestation);
        } else {
          console.info(`No AIAgent attestation found for ${agent.agentDomain}`);
        }
      } catch (error) {
        console.error(`Failed to load AIAgent attestation for ${agent.agentDomain}:`, error);
      }
    }

    console.info(`Total AIAgent attestations loaded: ${allAIAgentAttestations.length}`);
    setAiAgentAttestations(allAIAgentAttestations);
  }, [chain, signatory]);

  const handleAttestationChange = (event: AttestationChangeEvent) => {
    if (event.action === 'add' && event.attestation) {
      const att = event.attestation;
      if (att.class === 'aiagent') {
        if (!aiAgentAttestations.find(a => a.entityId === att.entityId)) {
          setAiAgentAttestations(prev => [att, ...prev]);
        }
      } else {
        if (!attestations.find(a => a.entityId === att.entityId)) {
          setAttestations(prev => [att, ...prev]);
        }
      }
      setSelectedId(att.entityId);
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    } else if (event.action === 'delete') {
      setAttestations(prev => prev.filter(a => a.entityId !== event.entityId));
      setAiAgentAttestations(prev => prev.filter(a => a.entityId !== event.entityId));
      if (selectedId === event.entityId) setSelectedId(null);
    } else if (event.action === 'delete-all') {
      if (orgDid && indivDid && chain) {
        AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid, currentWalletAddress).then((atts) => {
          setAttestations(atts);
          setSelectedId(null);
        });
        // Reload AIAgent attestations
        if (agents.length > 0) {
          loadAIAgentAttestations(agents);
        }
      } else {
        setAttestations([]);
        setAiAgentAttestations([]);
        setSelectedId(null);
      }
    }
  };

  useEffect(() => {
    if (orgDid && indivDid && chain) {
      AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid, currentWalletAddress).then((atts) => {
        setAttestations(atts)
      })
      AttestationService.loadAttestationCategories().then((cats) => {
        setCategories(cats.filter(c => c.class === 'agent' || c.class === 'aiagent'))
      })
    }
    attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);
    return () => attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
  }, [orgDid, indivDid, chain]);

  // Load agents and their AIAgent attestations
  useEffect(() => {
    const loadAgents = async () => {
      console.info("loadAgents useEffect triggered", { 
        hasSignatory: !!signatory, 
        hasWalletClient: !!signatory?.walletClient, 
        hasAccount: !!signatory?.walletClient?.account,
        hasAddress: !!signatory?.walletClient?.account?.address,
        hasChain: !!chain
      });
      
      if (!signatory?.walletClient?.account?.address || !chain) {
        console.info("Missing required dependencies for loadAgents", { 
          signatory: !!signatory, 
          walletClient: !!signatory?.walletClient, 
          account: !!signatory?.walletClient?.account,
          address: signatory?.walletClient?.account?.address,
          chain: !!chain
        });
        return;
      }

      setLoadingAgents(true);
      try {
        const ownerAddress = signatory.walletClient.account.address;
        console.info("Fetching agents for owner:", ownerAddress);
        const data = await fetchAgentsByOwner(ownerAddress);
        console.info("********* ai agents data: ", data)
        
        if (data.success && data.agents) {
          setAgents(data.agents);
          // Load AIAgent attestations for each agent
          await loadAIAgentAttestations(data.agents);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, [signatory?.walletClient?.account?.address, chain, loadAIAgentAttestations]);

  const filtered = attestations.filter(a => a.class === 'agent');
  const allAttestations = [...filtered, ...aiAgentAttestations];
  const totalAttestations = allAttestations.length;

  return (
    <Box ref={scrollContainerRef} sx={{ flex: 1, overflowY: 'auto', width: '100%', minHeight: 0, px: 2, py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
          Agent Attestation Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {totalAttestations} total attestations across {categories.length} categories
          {agents.length > 0 && ` • ${agents.length} agents owned`}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
        {totalAttestations > 0 ? (
          allAttestations.map((att, index) => (
            <AttestationCard
              key={`${att.uid}-${att.entityId}-${att.attester}-${index}`}
              attestation={att}
              selected={selectedId === att.id}
              onSelect={() => { setSelectedId(att.entityId); onSelectAttestation(att); }}
              hoverable
            />
          ))
        ) : (
          <Box sx={{ width: '100%', textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body1">No agent attestations found</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {loadingAgents ? 'Loading agents...' : 'Create agent attestations to see them here'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default AgentsPage;


