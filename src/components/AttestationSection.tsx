import React, { useState, useEffect, useRef, SyntheticEvent } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Typography,
  Tab,
  Tabs as MuiTabs,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';

import { TabContext, TabList, TabPanel } from '@mui/lab';

import SearchIcon from '@mui/icons-material/Search';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CloseIcon from '@mui/icons-material/Close';
import {
  Attestation,
  AttestationCategory,
} from '../models/Attestation';
import {
  AttestationCard,
} from './AttestationCard';
import AttestationService, {
  AttestationChangeEvent,
  attestationsEmitter,
} from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { Entity } from '../models/Entity';

interface AttestationSectionProps {
  orgDid?: string;
  indivDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
  entities?: Entity[];
  onUnSkipEntity?: (entityName: string) => void;
}

// Attestation Statistics Component
const AttestationStats: React.FC<{
  entities?: Entity[];
  onUnSkip?: (entityName: string) => void;
}> = ({ entities, onUnSkip }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'completed' | 'missing' | 'skipped'>('completed');

  if (!entities) return null;

  const completed: string[] = [];
  const missing: string[] = [];
  const skipped: string[] = [];

  const stats = entities.reduce((acc, entity) => {
    if (entity.attestation) {
      acc.completed++;
      completed.push(entity.name);
    } else if (entity.skipped) {
      acc.skipped++;
      skipped.push(entity.name);
    } else {
      acc.missing++;
      missing.push(entity.name);
    }
    return acc;
  }, { completed: 0, missing: 0, skipped: 0 });

  const total = stats.completed + stats.missing + stats.skipped;
  const completionPercentage = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  const handleChipClick = (type: 'completed' | 'missing' | 'skipped') => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleUnSkip = (entityName: string) => {
    if (onUnSkip) {
      onUnSkip(entityName);
      setDialogOpen(false);
    }
  };

  const formatEntityName = (entityName: string) => {
    // Convert entity names like "linkedin(indiv)" to "LinkedIn (Individual)"
    const parts = entityName.match(/^([^(]+)\(([^)]+)\)$/);
    if (parts) {
      const [, name, type] = parts;
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      const formattedType = type === 'indiv' ? 'Individual' :
                           type === 'org' ? 'Organization' : type;
      return `${formattedName} (${formattedType})`;
    }
    return entityName;
  };

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'background.paper'
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.completed} Completed`}
            color="success"
            variant="outlined"
            onClick={() => handleChipClick('completed')}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'success.light', color: 'white' } }}
          />
          <Chip
            icon={<PendingIcon />}
            label={`${stats.missing} Missing`}
            color="warning"
            variant="outlined"
            onClick={() => handleChipClick('missing')}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'warning.light', color: 'white' } }}
          />
          {stats.skipped > 0 && (
            <Chip
              icon={<PendingIcon />}
              label={`${stats.skipped} Skipped`}
              color="info"
              variant="outlined"
              onClick={() => handleChipClick('skipped')}
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'info.light', color: 'white' } }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
          {completionPercentage}% Complete
        </Typography>
      </Paper>

      {/* Attestation Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1}>
            {dialogType === 'completed' ? (
              <>
                <CheckCircleIcon color="success" />
                <Typography variant="h6">Completed Attestations</Typography>
              </>
            ) : dialogType === 'skipped' ? (
              <>
                <PendingIcon color="info" />
                <Typography variant="h6">Skipped Attestations</Typography>
              </>
            ) : (
              <>
                <PendingIcon color="warning" />
                <Typography variant="h6">Missing Attestations</Typography>
              </>
            )}
          </Box>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            <CloseIcon />
          </Button>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {dialogType === 'completed'
              ? `You have ${stats.completed} verified attestations:`
              : dialogType === 'skipped'
              ? `You have ${stats.skipped} skipped attestations (you can come back to these later):`
              : `You can add ${stats.missing} more attestations to improve your profile:`
            }
          </Typography>

          <List>
            {(dialogType === 'completed' ? completed : dialogType === 'skipped' ? skipped : missing).map((entityName, index) => (
              <React.Fragment key={entityName}>
                <ListItem>
                  <ListItemIcon>
                    {dialogType === 'completed' ? (
                      <CheckCircleIcon color="success" />
                    ) : dialogType === 'skipped' ? (
                      <PendingIcon color="info" />
                    ) : (
                      <PendingIcon color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={formatEntityName(entityName)}
                    secondary={
                      dialogType === 'completed'
                        ? 'Verified and on-chain'
                        : dialogType === 'skipped'
                        ? 'Skipped - click "Add Back" to resume'
                        : 'Click in chat to add this attestation'
                    }
                  />
                  {dialogType === 'skipped' && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleUnSkip(entityName)}
                      sx={{ ml: 2 }}
                    >
                      Add Back
                    </Button>
                  )}
                </ListItem>
                {index < (dialogType === 'completed' ? completed : missing).length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const AttestationSection: React.FC<AttestationSectionProps> = ({
  orgDid,
  indivDid,
  onSelectAttestation,
  entities,
  onUnSkipEntity
}) => {
    const [tabValue, setTabValue] = useState<'individual' | 'organization'>('individual');
    const [categories, setCategories] = useState<AttestationCategory[]>([]);
    const [attestations, setAttestations] = useState<Attestation[]>([]);

    const [currentCategories, setCurrentCategories] = useState<AttestationCategory[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const { chain } = useWallectConnectContext();

    const handleTabChange = (_: SyntheticEvent, newValue: string) => {

        setTabValue(newValue as 'individual' | 'organization');

        let currentCategories = []
        for (const cat of categories) {
            if (cat.class == newValue) {
                currentCategories.push(cat)
            }
        }
        setCurrentCategories(currentCategories)

    };



  // Handle real-time changes
  const handleAttestationChange = (event: AttestationChangeEvent) => {
    if (event.action === 'add' && event.attestation) {
      const att = event.attestation;
      if (!attestations.find(a => a.entityId === att.entityId)) {
        setAttestations(prev => [att, ...prev]);
      }
      setSelectedId(att.entityId);
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    } else if (event.action === 'delete') {
      // Remove the specific attestation that was deleted
      setAttestations(prev => prev.filter(a => a.entityId !== event.entityId));
      if (selectedId === event.entityId) {
        setSelectedId(null);
      }
    } else if (event.action === 'delete-all') {
      // Refresh the attestations list from the server
      if (orgDid && indivDid && chain) {
        AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid).then((atts) => {
          setAttestations(atts);
          setSelectedId(null);
        });
      } else {
        setAttestations([]);
        setSelectedId(null);
      }
    }
  };

  // Load data on orgDid change
  useEffect(() => {
    if (orgDid && indivDid && chain && tabValue) {
      AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid).then((atts) => {
        setAttestations(atts)
      })

      AttestationService.loadAttestationCategories().then((cats) => {
        setCategories(cats)

        let currentCategories = []
        for (const cat of cats) {
            if (cat.class == tabValue) {
                currentCategories.push(cat)
            }
        }
        setCurrentCategories(currentCategories)
      })
    }

    attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);
    return () => {
      attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
    };
  }, [orgDid]);

  // Expose refresh function globally
  useEffect(() => {
    (window as any).refreshAttestations = () => {
      if (orgDid && indivDid && chain && tabValue) {
        AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid).then((atts) => {
          setAttestations(atts)
        })

        AttestationService.loadAttestationCategories().then((cats) => {
          setCategories(cats)

          let currentCategories = []
          for (const cat of cats) {
              if (cat.class == tabValue) {
                  currentCategories.push(cat)
              }
          }
          setCurrentCategories(currentCategories)
        })
      }
    };
  }, [orgDid, indivDid, chain, tabValue]);

  // Filter attestations by search term and class (individual/organization)
  const filtered = attestations.filter(a =>
      a.entityId?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      a.class === tabValue
  );

  // Remove duplicates based on uid, entityId, and attester combination
  const uniqueAttestations = filtered.filter((att, index, self) =>
    index === self.findIndex(a =>
      a.uid === att.uid &&
      a.entityId === att.entityId &&
      a.attester === att.attester
    )
  );

  // Sort attestations by category ID
  const sortedAttestations = uniqueAttestations.sort((a, b) => {
    const idA = currentCategories.find(cat => cat.name === a.category)?.id || '';
    const idB = currentCategories.find(cat => cat.name === b.category)?.id || '';

    // Sort by category ID numerically
    return idA.localeCompare(idB);
  });


return (
<Box
  display="flex"
  flexDirection="column"
  justifyContent="flex-start"
  alignItems="flex-start"
  height="80vh"
  width="100%"
>
  <TabContext value={tabValue}>
    {/* ── HEADER: Title + Tabs + Search ─────────────────────────────── */}
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      mb={2}
      px={2}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        {/* Title with Icon */}
        <Box display="flex" alignItems="center" gap={1}>
          <VerifiedUserIcon color="primary" />
          <Typography variant="h6" color="primary">
            Attestations
          </Typography>
        </Box>

        {/* Tabs */}
        <TabList onChange={handleTabChange} aria-label="Attestation tabs">
          <Tab label="Individual" value="individual" />
          <Tab label="Organization" value="organization" sx={{ ml: 2 }} />
        </TabList>
      </Box>

      {/* Search */}
      <TextField
        size="small"
        variant="outlined"
        placeholder="Search…"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ width: 200 }}
      />
    </Box>

    {/* ── STATISTICS: Attestation completion stats ───────────────────── */}
            <AttestationStats entities={entities} onUnSkip={onUnSkipEntity} />

    {/* ── PANEL: Results only, scrollable ───────────────────── */}
    <TabPanel
      value={tabValue}
      sx={{
        p: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0px',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          minHeight: 0,
          px: 2,
          py: 1,
        }}
      >
        {/* Category Headers */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
            Attestation Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {sortedAttestations.length} total attestations across {currentCategories.length} categories
          </Typography>
        </Box>

        {/* Continuous Flow Attestation Cards */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'flex-start',
          }}
        >
          {sortedAttestations.length > 0 ? (
            sortedAttestations.map((att, index) => (
              <AttestationCard
                key={`${att.uid}-${att.entityId}-${att.attester}-${index}`}
                attestation={att}
                selected={selectedId === att.id}
                onSelect={() => {
                  setSelectedId(att.entityId);
                  onSelectAttestation(att);
                }}
                hoverable
              />
            ))
          ) : (
            <Box
              sx={{
                width: '100%',
                textAlign: 'center',
                py: 4,
                color: 'text.secondary',
              }}
            >
              <Typography variant="body1">
                No attestations found
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {searchTerm ? 'Try adjusting your search terms' : 'Add some attestations to get started'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </TabPanel>
  </TabContext>
</Box>


  );
};

export default AttestationSection;
