import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Attestation, AttestationCategory } from '../models/Attestation';
import { AttestationCard } from './AttestationCard';
import AttestationService, { AttestationChangeEvent, attestationsEmitter } from '../service/AttestationService';
import { useWallectConnectContext } from '../context/walletConnectContext';

interface AgentsPageProps {
  orgDid?: string;
  indivDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ orgDid, indivDid, onSelectAttestation }) => {
  const { chain, signatory } = useWallectConnectContext();
  const currentWalletAddress = signatory?.walletClient?.account?.address;
  const [categories, setCategories] = useState<AttestationCategory[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleAttestationChange = (event: AttestationChangeEvent) => {
    if (event.action === 'add' && event.attestation) {
      const att = event.attestation;
      if (!attestations.find(a => a.entityId === att.entityId)) {
        setAttestations(prev => [att, ...prev]);
      }
      setSelectedId(att.entityId);
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    } else if (event.action === 'delete') {
      setAttestations(prev => prev.filter(a => a.entityId !== event.entityId));
      if (selectedId === event.entityId) setSelectedId(null);
    } else if (event.action === 'delete-all') {
      if (orgDid && indivDid && chain) {
        AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid, currentWalletAddress).then((atts) => {
          setAttestations(atts);
          setSelectedId(null);
        });
      } else {
        setAttestations([]);
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
        setCategories(cats.filter(c => c.class === 'agent'))
      })
    }
    attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);
    return () => attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
  }, [orgDid, indivDid, chain]);

  const filtered = attestations.filter(a => a.class === 'agent');

  return (
    <Box ref={scrollContainerRef} sx={{ flex: 1, overflowY: 'auto', width: '100%', minHeight: 0, px: 2, py: 1 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
          Agent Attestation Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filtered.length} total attestations across {categories.length} categories
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
        {filtered.length > 0 ? (
          filtered.map((att, index) => (
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
            <Typography variant="body2" sx={{ mt: 1 }}>Create agent attestations to see them here</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default AgentsPage;


