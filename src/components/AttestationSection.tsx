import React, { useState, useEffect, useRef, SyntheticEvent } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Typography,
  Paper, 
  Tab, 

  Tabs as MuiTabs
} from '@mui/material';

import { TabContext, TabList, TabPanel } from '@mui/lab';

import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

interface AttestationSectionProps {
  orgDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
}

const AttestationSection: React.FC<AttestationSectionProps> = ({
  orgDid,
  onSelectAttestation,
}) => {
    const [tabValue, setTabValue] = useState<'individual' | 'organization'>('individual');
    const [categories, setCategories] = useState<AttestationCategory[]>([]);
    const [attestations, setAttestations] = useState<Attestation[]>([]);

    const [currentCategories, setCurrentCategories] = useState<AttestationCategory[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);


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

  // Initialize expanded state when categories change
  useEffect(() => {
    setExpandedCategories(
        currentCategories.reduce((acc, category) => ({ ...acc, [category.name]: true }), {}),
    );
  }, [currentCategories]);

  // Handle real-time changes
  const handleAttestationChange = (event: AttestationChangeEvent) => {
    if (event.action === 'add' && event.attestation) {
      const att = event.attestation;
      if (!attestations.find(a => a.entityId === att.entityId)) {
        setAttestations(prev => [att, ...prev]);
      }
      setSelectedId(att.entityId);
      console.info("***********************  updated ************")
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    } else if (event.action === 'delete-all') {
      setAttestations([]);
      setSelectedId(null);
    }
  };

  // Load data on orgDid change
  useEffect(() => {
    if (orgDid && tabValue) {
      AttestationService.loadRecentAttestationsTitleOnly(orgDid).then((atts) => {
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



  console.info("filtered and groupd: ", attestations)

    // Filter and group
    const filtered = attestations.filter(a =>
        a.entityId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const grouped = currentCategories.reduce((acc, cat) => {
        acc[cat.name] = filtered.filter(a => a.category === cat.name && a.class === cat.class);
        
        return acc;
    }, {} as Record<string, Attestation[]>);

  return (
<Box
  display="flex"
  flexDirection="column"
  justifyContent="flex-start"
  alignItems="flex-start"
  bgcolor="grey.50"
  minHeight="100vh"
  width="100%"
>
  <TabContext value={tabValue}>
    {/* ── HEADER: Tabs + Search ─────────────────────────────── */}
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      mb={2}
      px={2}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      {/* Tabs */}
      <TabList onChange={handleTabChange} aria-label="Attestation tabs">
        <Tab label="Individual" value="individual" />
        <Tab label="Organization" value="organization" sx={{ ml: 2 }} />
      </TabList>

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
          px: 1,
          py: 0,
        }}
      >
        {currentCategories.map(cat => (
          <Accordion
            key={cat.name}
            expanded={!!expandedCategories[cat.name]}
            onChange={() =>
              setExpandedCategories(prev => ({
                ...prev,
                [cat.name]: !prev[cat.name],
              }))
            }
            disableGutters
            sx={{ width: '100%' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant="subtitle2"
                color="textSecondary"
                textTransform="capitalize"
              >
                {cat.name}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {grouped[cat.name]?.length ? (
                <Grid container spacing={2}>
                  {grouped[cat.name].map(att => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      lg={3}
                      xl={2}
                      key={att.id}
                    >
                      <AttestationCard
                        attestation={att}
                        selected={selectedId === att.id}
                        onSelect={() => {
                          setSelectedId(att.entityId);
                          onSelectAttestation(att);
                        }}
                        hoverable
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="caption" color="textSecondary">
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </TabPanel>
  </TabContext>
</Box>


  );
};

export default AttestationSection;
