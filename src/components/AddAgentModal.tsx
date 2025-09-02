import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, Snackbar, Alert } from '@mui/material';
import { useWallectConnectContext } from '../context/walletConnectContext';
import AttestationService, { attestationsEmitter, type AttestationChangeEvent } from '../service/AttestationService';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { createPublicClient, http, keccak256, stringToHex, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { encodeNewAgent, getAgentByDomain, ensureIdentityWithAA } from '../service/AgentAdapter';
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

  const handleExistsClose = (_?: any, reason?: string) => {
    if (reason === 'clickaway') return;
    setExistsOpen(false);
    onClose();
  };

  const handleAdd = async () => {
    setError(null);
    if (!domain || !chain) {
      setError('Please enter a domain and ensure wallet is connected.');
      return;
    }
    try {
      setSubmitting(true);


  
      // 0) Early exit if agent already exists for this domain
      const publicClient = createPublicClient({ chain: sepolia, transport: http() });
      const identityRegistrationAddress = (import.meta as any).env.VITE_IDENTITY_REGISTRY_ADDRESS as `0x${string}`
      if (!identityRegistrationAddress) throw new Error('Missing VITE_IDENTITY_REGISTRY_ADDRESS')
      const existing = await getAgentByDomain({ publicClient, registry: identityRegistrationAddress, domain: domain.trim().toLowerCase() })
      if (existing) {
        setSubmitting(false);
        setExistsOpen(true);
        return;
      }
      console.info("agent does not exist for this domain: ", domain)

      // 1) Create Agent AA (Hybrid) similar to indiv account abstraction
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

      // 2) No signature required by on-chain ABI (newAgent(string,address))

      // 3) Call IdentityRegistry.newAgent via AA + paymaster (same approach as deployment)
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
            Enter a domain name for the agent (e.g., finder.airbnb.com)
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Agent Domain"
            placeholder="finder.airbnb.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
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
          An agent already exists for this domain.
        </Alert>
      </Snackbar>
    </>
  );
};

export default AddAgentModal;


