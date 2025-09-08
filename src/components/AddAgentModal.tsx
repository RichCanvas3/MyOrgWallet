import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Autocomplete } from '@mui/material';
import { useWallectConnectContext } from '../context/walletConnectContext';
import AttestationService, { attestationsEmitter, type AttestationChangeEvent } from '../service/AttestationService';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { createPublicClient, http, keccak256, stringToHex, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { encodeNewAgent, getAgentByDomain, ensureIdentityWithAA, fetchAgentsByOwner, checkAgentExistsByDomain, type AgentData, type AgentsResponse } from '../service/AgentAdapter';
import { PAYMASTER_URL } from '../config';
import { createBundlerClient } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { BUNDLER_URL } from '../config';
import type { Attestation } from '../models/Attestation';

interface AddAgentModalProps {
  isVisible: boolean;
  onClose: () => void;
  orgDid?: string;
  indivDid?: string;
}


const AddAgentModal: React.FC<AddAgentModalProps> = ({ isVisible, onClose, orgDid, indivDid }) => {
  const { chain, signatory } = useWallectConnectContext();
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existsOpen, setExistsOpen] = useState(false);
  const [existingAgents, setExistingAgents] = useState<AgentData[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fetch existing agents when modal opens
  useEffect(() => {
    const fetchExistingAgents = async () => {
      if (!isVisible || !signatory?.walletClient?.account?.address) return;
      
      setLoadingAgents(true);
      try {
        const ownerAddress = signatory.walletClient.account.address;
        const data = await fetchAgentsByOwner(ownerAddress);
        
        if (data.success && data.agents) {
          setExistingAgents(data.agents);
        }
      } catch (error) {
        console.error('Failed to fetch existing agents:', error);
        setError('Failed to load existing agents');
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchExistingAgents();
  }, [isVisible, signatory?.walletClient?.account?.address]);

  const handleExistsClose = (_?: any, reason?: string) => {
    if (reason === 'clickaway') return;
    setExistsOpen(false);
    onClose();
  };

  const handleAdd = async () => {
    setError(null);
    if (!domain || !chain || !signatory?.walletClient?.account?.address) {
      setError('Please enter a domain and ensure wallet is connected.');
      return;
    }
    try {
      setSubmitting(true);

      const normalizedDomain = domain.trim().toLowerCase();
      const ownerAddress = signatory.walletClient.account.address;

      // 1) Check if agent already exists via API first (faster check)
      console.info("Checking if agent exists via API for domain:", normalizedDomain);
      const existsInAPI = await checkAgentExistsByDomain(ownerAddress, normalizedDomain);
      if (existsInAPI) {
        console.info("Agent already exists in API for domain:", normalizedDomain);
        setSubmitting(false);
        setExistsOpen(true);
        return;
      }

      // 2) Check if agent already exists on-chain (backup check)
      console.info("Checking if agent exists on-chain for domain:", normalizedDomain);
      const publicClient = createPublicClient({ chain: sepolia, transport: http() });
      const identityRegistrationAddress = (import.meta as any).env.VITE_IDENTITY_REGISTRY_ADDRESS as `0x${string}`
      if (!identityRegistrationAddress) throw new Error('Missing VITE_IDENTITY_REGISTRY_ADDRESS')
      const existingOnChain = await getAgentByDomain({ publicClient, registry: identityRegistrationAddress, domain: normalizedDomain })
      if (existingOnChain) {
        console.info("Agent already exists on-chain for domain:", normalizedDomain);
        setSubmitting(false);
        setExistsOpen(true);
        return;
      }

      console.info("Agent does not exist for this domain, proceeding with creation:", normalizedDomain)

      // 3) Create Agent AA (Hybrid) similar to indiv account abstraction
      const salt: `0x${string}` = keccak256(stringToHex(domain.trim().toLowerCase())) as `0x${string}`;
      const agentAccountClient = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [signatory!.walletClient!.account!.address, [], [], []],
        signatory: { walletClient: signatory!.walletClient! },
        deploySalt: salt,
      });
      const agentAddress = await agentAccountClient.getAddress();

      // Ensure Agent AA is deployed (same pattern as indiv/org deploy)
      console.info("ensure agent account client is deployed")
      const deployed = await agentAccountClient.isDeployed();
      if (!deployed) {
        if (!BUNDLER_URL) throw new Error('Missing BUNDLER_URL for deployment');
        const pimlicoClient = createPimlicoClient({ transport: http(BUNDLER_URL) });
        const bundlerClient = createBundlerClient({
          transport: http(BUNDLER_URL),
          paymaster: true,
          chain: sepolia,
          paymasterContext: { mode: 'SPONSORED' },
        });
        const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();
        const userOperationHash = await (bundlerClient as any).sendUserOperation({
          account: agentAccountClient,
          calls: [{ to: zeroAddress }],
          ...fee,
        });
        await (bundlerClient as any).waitForUserOperationReceipt({ hash: userOperationHash });
      }

      // 4) No signature required by on-chain ABI (newAgent(string,address))

      // 5) Call IdentityRegistry.newAgent via AA + paymaster (same approach as deployment)
      if (!BUNDLER_URL) throw new Error('Missing BUNDLER_URL for newAgent')
      await ensureIdentityWithAA({
        publicClient,
        bundlerUrl: BUNDLER_URL,
        chain: sepolia,
        registry: identityRegistrationAddress,
        domain: domain.trim().toLowerCase(),
        agentAccount: agentAccountClient,
      })


      setSubmitting(false);
      onClose();
    } catch (e: any) {
      setSubmitting(false);
      setError(e?.message || 'Failed to add agent attestation');
    }
  };

  return (
    <>
      <Dialog open={isVisible} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Add Agent</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter a new domain name for the agent or select from existing agents
            {existingAgents.length > 0 && ` (${existingAgents.length} existing agents available)`}
          </Typography>

          {/* Agent Domain Input with Dropdown */}
          <Autocomplete
            freeSolo
            options={existingAgents.map(agent => agent.agentDomain)}
            value={domain}
            onChange={(_, newValue) => {
              if (typeof newValue === 'string') {
                setDomain(newValue);
              } else if (newValue) {
                setDomain(newValue);
              }
            }}
            onInputChange={(_, newInputValue) => {
              setDomain(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                fullWidth
                label="Agent Domain"
                placeholder="finder.airbnb.com"
                helperText="Enter a new domain name or select from existing agents"
                InputProps={{
                  ...params.InputProps,
                }}
              />
            )}
            renderOption={(props, option) => {
              const agent = existingAgents.find(a => a.agentDomain === option);
              return (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {option}
                    </Typography>
                    {agent && (
                      <Typography variant="caption" color="text.secondary">
                        ID: {agent.agentId} | Address: {agent.agentAddress.slice(0, 10)}...
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
            loading={loadingAgents}
            loadingText="Loading existing agents..."
            noOptionsText="No existing agents found"
          />
          
          {error && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="error">{error}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={submitting || !domain}>Add Agent</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={existsOpen}
        autoHideDuration={2500}
        onClose={handleExistsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleExistsClose} severity="info" variant="filled" sx={{ width: '100%' }}>
          An agent already exists for this domain. Please select a different domain or choose from existing agents.
        </Alert>
      </Snackbar>
    </>
  );
};

export default AddAgentModal;


