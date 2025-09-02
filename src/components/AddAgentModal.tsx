import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material';
import { useWallectConnectContext } from '../context/walletConnectContext';
import AttestationService, { attestationsEmitter, type AttestationChangeEvent } from '../service/AttestationService';
import type { Attestation } from '../models/Attestation';

interface AddAgentModalProps {
  open: boolean;
  onClose: () => void;
  orgDid: string;
  indivDid: string;
}

const AddAgentModal: React.FC<AddAgentModalProps> = ({ open, onClose, orgDid, indivDid }) => {
  const { chain, signatory } = useWallectConnectContext();
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);
    if (!domain || !chain) {
      setError('Please enter a domain and ensure wallet is connected.');
      return;
    }
    try {
      setSubmitting(true);

      // Placeholder: perform any agent discovery/verification logic here
      // For now, immediately create a local Agent attestation entry
      const att: Attestation = {
        class: 'agent',
        entityId: domain.trim().toLowerCase(),
        category: 'delegations',
        attester: signatory?.walletClient?.account?.address || '0x',
        hash: '0x',
        displayName: `Agent: ${domain.trim()}`,
        issuedate: Date.now(),
      } as Attestation;

      // Emit into the existing attestation stream so UI updates
      const event: AttestationChangeEvent = { action: 'add', entityId: att.entityId, attestation: att };
      attestationsEmitter.emit('attestationChangeEvent', event);

      setSubmitting(false);
      onClose();
    } catch (e: any) {
      setSubmitting(false);
      setError(e?.message || 'Failed to add agent attestation');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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
  );
};

export default AddAgentModal;


