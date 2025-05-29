import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
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

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {useNavigate} from 'react-router-dom';
import { Organization } from "../models/Organization"
import OrganizationListItem from "./OrganizationListItem"

import AttestationService, {
  AttestationChangeEvent,
  attestationsEmitter,
} from '../service/AttestationService';

import { useWallectConnectContext } from "../context/walletConnectContext";
import { Command } from "../models/Command"
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";

import {
  Attestation,
  AttestationCategory,
} from '../models/Attestation';

import {
  AttestationCard,
} from './AttestationCard';

interface OrganizationsPageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}

  const OrganizationsPage: React.FC<OrganizationsPageProps> = ({className, appCommand}) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchInputValue, setSearchInputValue] = useState("");
    const [orgDid, setOrgDid] = useState<string>();
    const [categories, setCategories] = useState<AttestationCategory[]>([]);
    const [attestations, setAttestations] = useState<Attestation[]>([]);
    const [currentCategories, setCurrentCategories] = useState<AttestationCategory[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showSearchOptions, setShowSearchOptions] = useState(false);

    const handleAttestationChange = (event: AttestationChangeEvent) => {
      if (event.action === 'add' && event.attestation) {
        const att = event.attestation;
        if (!attestations.find(a => a.entityId === att.entityId)) {
          setAttestations(prev => [att, ...prev]);
        }
        setSelectedId(att.entityId);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      } else if (event.action === 'delete-all') {
        setAttestations([]);
        setSelectedId(null);
      }
    };

    const loadOrganizations = async () => {
      AttestationService.loadOrganizations()
        .then(organizations => {
          setOrganizations(organizations);
        })
        .catch(error => {
          console.error("Error loading organizations:", error);
        });
    };

    // Load data on orgDid change
    useEffect(() => {
      if (orgDid) {
        AttestationService.loadRecentAttestationsTitleOnly(orgDid, "").then((atts) => {
          //console.info("set attestations in Attestation Section: ", atts)
          setAttestations(atts)
        })

        AttestationService.loadAttestationCategories().then((cats) => {
          setCategories(cats)

          let currentCategories = []

          for (const cat of cats) {
              if (cat.class == "organization") {
                  currentCategories.push(cat)
              }
          }

          setCurrentCategories(currentCategories)
        })
      }

      loadOrganizations()

      attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);

      return () => {
        attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
      };
    }, [orgDid]);

    useEffect(() => {
      //const sortedOrganizations = [...organizations];  // Sort by timestamp if not already sorted
      //const sortedOrganizations = [...organizations].sort((a, b) => b.name - a.name);  // Sort by timestamp if not already sorted
    }, [organizations]);

    // Initialize expanded state when categories change
    useEffect(() => {
      setExpandedCategories(
          currentCategories.reduce((acc, category) => ({ ...acc, [category.name]: true }), {}),
      );
    }, [currentCategories]);

    const onSelectOrganization = async(orgDid: string) => {
        setOrgDid(orgDid)
    }

    const onSelectAttestation = async(att: Attestation) => {
      const cmd : Command = {
                    action: "show",
                    did: att.attester,
                    entityId: att.entityId,
                  }
      appCommand(cmd)
    }

    // Search the organizations based on the input
    const handleSearch = async (searchString: string) => {
      const lowerSearch = searchString.toLowerCase();

      const filteredOrganizations = organizations.filter(org =>
        org.name.toLowerCase().includes(lowerSearch)
      );

      setOrganizations(filteredOrganizations);
    }

    const OrganizationListItemMemo = React.memo(OrganizationListItem);

    // Filter and group
    const filtered = attestations.filter(a =>
        a.entityId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    //console.info("filtered: ", filtered, attestations)
    const grouped = currentCategories.reduce((acc, cat) => {
        acc[cat.name] = filtered.filter(a => a.category === cat.name && a.class === cat.class);
        //console.info("return acc: ", acc)
        return acc;
    }, {} as Record<string, Attestation[]>);

    return (
      <div className="organization-page flex h-screen">
        <div className="organization-list-container w-1/2 p-4 overflow-y-auto">
          <div id="organization-search" className="flex items-center mb-2">
              <input
                id="attestationSearchInput"
                className="search-input"
                type="text"
                autoComplete="off"
                placeholder={'search'}
                value={searchInputValue}
                onFocus={() => setShowSearchOptions(true)}
                onBlur={() => setTimeout(() => setShowSearchOptions(false), 200)}
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchInputValue);
                    setShowSearchOptions(false);
                  }
                }}
              />
              <button
                className="search-button"
                onClick={() => {
                  handleSearch(searchInputValue);
                  setShowSearchOptions(false);
                }}
              >
              <MagnifyingGlassIcon className="search-icon" />
            </button>
          </div>
          <div
            id="organization-list"
            ref={scrollContainerRef}
            className="flex-col flex-1 transition-opacity duration-500 -mr-2 pr-2 overflow-y-auto"
          >
            <div className="flex flex-col gap-1 pb-1 text-sm">
              <div className="relative overflow-x-hidden" style={{ height: "auto", opacity: 1 }}>
                <ol>
                  {organizations.map((organization, index) => (
                    <OrganizationListItemMemo
                      key={organization.id}
                      organization={organization}
                      isSelected={selectedId === organization.id}
                      onSelectOrganization={onSelectOrganization}
                      className="organization-list-item w-1/3"
                    />
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="attestation-list-container w-1/2 p-6 overflow-y-auto">
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
                      key={cat.id}
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
                                key={att.uid}
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
        </div>
      </div>

    );
};

export default OrganizationsPage;