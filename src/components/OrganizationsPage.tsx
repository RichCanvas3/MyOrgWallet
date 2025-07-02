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
  Tabs as MuiTabs,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Rating,
  Tooltip
} from '@mui/material';

import { Chain } from 'viem';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
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

import { useCrossChainAccount } from "../hooks/useCrossChainTools";
import { useTrustScore } from "../hooks/useTrustScore";
import { addressModulo } from 'viem/_types/zksync/constants/address';
import { getCipherInfo } from 'crypto';
import { chainIdNetworkParamsMapping } from '@blockchain-lab-um/masca-connector';

interface OrganizationsPageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}

  const OrganizationsPage: React.FC<OrganizationsPageProps> = ({className, appCommand}) => {

    const { chain } = useWallectConnectContext();
    const { getUSDCBalance } = useCrossChainAccount();

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchInputValue, setSearchInputValue] = useState("");
    const [orgDid, setOrgDid] = useState<string>();
    const [categories, setCategories] = useState<AttestationCategory[]>([]);
    const [attestations, setAttestations] = useState<Attestation[]>([]);
    const [currentCategories, setCurrentCategories] = useState<AttestationCategory[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showSearchOptions, setShowSearchOptions] = useState(false);
    
    // Use centralized trust score hook
    const { trustScore, isLoading: trustScoreLoading, error: trustScoreError } = useTrustScore({ 
      orgDid, 
      indivDid: undefined 
    });



    const handleAttestationChange = (event: AttestationChangeEvent) => {
      if (event.action === 'add' && event.attestation) {
        const att = event.attestation;
        if (!attestations.find(a => a.entityId === att.entityId && a.displayName === att.displayName)) {
          setAttestations(prev => [att, ...prev]);
        }
        setSelectedId(att.entityId + att.displayName);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              } else if (event.action === 'delete-all') {
          setAttestations([]);
          setSelectedId(undefined);
        }
    };

    const loadOrganizations = async (chain: Chain) => {
      AttestationService.loadOrganizations(chain)
        .then(organizations => {
          const filteredOrganizations = organizations.filter(org => org.issuedate !== "2025-03-10")
          console.info("1 --- loadOrganizations: ", filteredOrganizations)
          setOrganizations(filteredOrganizations);
        })
        .catch(error => {
          console.error("Error loading organizations:", error);
        });
    };

    useEffect(() => {
      
      if (chain && orgDid) {
        console.info("1 --- loadRecentAttestationsTitleOnly: ", orgDid)
        AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "").then((atts) => {
          console.info("2 --- loadRecentAttestationsTitleOnly: ", atts)
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

      attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);

      return () => {
        attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
      };
    }, [chain,orgDid]);

    useEffect(() => {
      
      if (chain) {
        loadOrganizations(chain)
      }

      attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);

      return () => {
        attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
      };
    }, [chain]);
    
    useEffect(() => {
    }, [organizations]);

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
                    displayName: att.displayName
                  }
      appCommand(cmd)
    }

    const handleSearch = async (searchString: string) => {
      const lowerSearch = searchString.toLowerCase();

      const filteredOrganizations = organizations.filter(org =>
        org.name.toLowerCase().includes(lowerSearch)
      );

      setOrganizations(filteredOrganizations);
    }

    const OrganizationListItemMemo = React.memo(OrganizationListItem);

    // Category color mapping function
    const getCategoryColor = (category: string): string => {
      const colorMap: Record<string, string> = {
        leadership: '#1976d2',      // Blue
        identity: '#388e3c',        // Green
        finance: '#f57c00',         // Orange
        compliance: '#d32f2f',      // Red
        reputation: '#7b1fa2',      // Purple
        domain: '#0288d1',          // Light Blue
        website: '#009688',         // Teal
        social: '#ff9800',          // Orange
        email: '#795548',           // Brown
        phone: '#607d8b',           // Blue Grey
        address: '#9e9e9e',         // Grey
        account: '#4caf50',         // Green
        credit: '#ff5722',          // Deep Orange
        insurance: '#3f51b5',       // Indigo
        license: '#673ab7',         // Deep Purple
        registration: '#e91e63',    // Pink
        audit: '#00bcd4',           // Cyan
        certification: '#8bc34a',   // Light Green
        security: '#ffc107',        // Amber
        endorsement: '#9c27b0',     // Purple
        review: '#ff6f00',          // Amber
        rating: '#4db6ac',          // Teal
        testimonial: '#81c784',     // Light Green
        accreditation: '#64b5f6',   // Light Blue
        default: '#757575',         // Grey
      };
      return colorMap[category.toLowerCase()] || colorMap.default;
    };

    const filtered = attestations.filter(a =>
        a.entityId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const grouped = currentCategories.reduce((acc, cat) => {
        acc[cat.name] = filtered.filter(a => a.category === cat.name && a.class === cat.class);
        return acc;
    }, {} as Record<string, Attestation[]>);

    // Trust score calculation function


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
                      key={`org-${organization.id}-${index}`}
                      organization={organization}
                      isSelected={selectedId === organization.id}
                      onSelectOrganization={onSelectOrganization}
                    />
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="attestation-list-container w-1/2 p-6 overflow-y-auto">
          {/* Trust Score Display */}
          {trustScore && orgDid && (
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                    Organization Trust Score
                  </Typography>
                  <Tooltip title="Overall Trust Score: Weighted average of all trust pillars. Leadership (25%), Identity (25%), Finance (20%), Compliance (20%), Reputation (10%). Color indicates trust level: Green (80-100), Orange (60-79), Red (0-59).">
                    <Box display="flex" alignItems="center" gap={1}>
                      <SecurityIcon />
                      <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                        {trustScore.overall}/100
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
                
                {/* Overall Progress Bar */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Overall Trust Level</Typography>
                    <Typography variant="body2">{trustScore.overall}%</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={trustScore.overall} 
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: trustScore.overall >= 80 ? '#4caf50' : 
                                       trustScore.overall >= 60 ? '#ff9800' : '#f44336'
                      }
                    }} 
                  />
                </Box>

                {/* Trust Pillars Breakdown */}
                <Box display="flex" gap={1} sx={{ width: '100%' }}>
                  <Box sx={{ width: '20%', minWidth: '120px' }}>
                    <Tooltip title="Leadership Score: Based on org-indiv attestations and leadership roles. Verified attestations get 20 points, unverified get 10 points. Multiple leadership attestations receive bonus points.">
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <VerifiedIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Leadership</Typography>
                      </Box>
                    </Tooltip>
                    <LinearProgress 
                      variant="determinate" 
                      value={trustScore.breakdown.leadership} 
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
                    />
                    <Typography variant="caption">{trustScore.breakdown.leadership}%</Typography>
                  </Box>
                  
                  <Box sx={{ width: '20%', minWidth: '120px' }}>
                    <Tooltip title="Identity Score: Based on domain, website, and social presence attestations. Verified attestations get 25 points, unverified get 15 points. Multiple identity attestations receive bonus points.">
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <BusinessIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Identity</Typography>
                      </Box>
                    </Tooltip>
                    <LinearProgress 
                      variant="determinate" 
                      value={trustScore.breakdown.identity} 
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
                    />
                    <Typography variant="caption">{trustScore.breakdown.identity}%</Typography>
                  </Box>
                  
                  <Box sx={{ width: '20%', minWidth: '120px' }}>
                    <Tooltip title="Finance Score: Based on account attestations and USDC balances. Verified accounts get 20 points, unverified get 10 points. USDC balance bonuses: $10k+ (30pts), $1k+ (20pts), $100+ (10pts), any balance (5pts).">
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <AccountBalanceIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Finance</Typography>
                      </Box>
                    </Tooltip>
                    <LinearProgress 
                      variant="determinate" 
                      value={trustScore.breakdown.finance} 
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
                    />
                    <Typography variant="caption">{trustScore.breakdown.finance}%</Typography>
                  </Box>
                  
                  <Box sx={{ width: '20%', minWidth: '120px' }}>
                    <Tooltip title="Compliance Score: Based on insurance, licenses, and state registration attestations. Verified attestations get 30 points, unverified get 15 points. Multiple compliance attestations receive bonus points.">
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <SecurityIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Compliance</Typography>
                      </Box>
                    </Tooltip>
                    <LinearProgress 
                      variant="determinate" 
                      value={trustScore.breakdown.compliance} 
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
                    />
                    <Typography variant="caption">{trustScore.breakdown.compliance}%</Typography>
                  </Box>
                  
                  <Box sx={{ width: '20%', minWidth: '120px' }}>
                    <Tooltip title="Reputation Score: Based on reviews, endorsements, and general attestations. Verified attestations get 15 points, unverified get 8 points. Multiple reputation attestations receive bonus points.">
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <VerifiedIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Reputation</Typography>
                      </Box>
                    </Tooltip>
                    <LinearProgress 
                      variant="determinate" 
                      value={trustScore.breakdown.reputation} 
                      sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
                    />
                    <Typography variant="caption">{trustScore.breakdown.reputation}%</Typography>
                  </Box>
                </Box>

                {/* Attestation Summary */}
                <Box mt={2} display="flex" gap={2} flexWrap="wrap">
                  <Chip 
                    label={`${trustScore.details.totalAttestations} Total Attestations`}
                    size="small"
                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip 
                    label={`$${trustScore.details.totalUSDCBalance.toLocaleString()} USDC`}
                    size="small"
                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip 
                    label={`${trustScore.details.savingsAccounts} Savings Accounts`}
                    size="small"
                    sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  {Object.entries(trustScore.details.categories).map(([category, count]) => (
                    <Chip 
                      key={category}
                      label={`${category}: ${count}`}
                      size="small"
                      sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

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
                {attestations.length} total attestations across {currentCategories.length} categories
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
              {attestations
                .sort((a, b) => {
                  const categoryA = a.category || 'default';
                  const categoryB = b.category || 'default';
                  
                  // Find category objects to get their IDs
                  const catA = currentCategories.find(cat => cat.name === categoryA);
                  const catB = currentCategories.find(cat => cat.name === categoryB);
                  
                  // Get IDs, defaulting to a high number for unknown categories
                  const idA = catA?.id || 9999;
                  const idB = catB?.id || 9999;
                  
                  return idA - idB;
                })
                .map((att, index) => {
                  const category = att.category || 'default';
                  return (
                    <Box
                      key={`${category}-${att.uid}-${att.entityId}-${att.displayName}-${index}`}
                      sx={{
                        position: 'relative',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          transition: 'transform 0.2s ease-in-out',
                        },
                      }}
                    >
                      <AttestationCard
                        attestation={att}
                        selected={selectedId === (att.entityId || '') + (att.displayName || '')}
                        onSelect={() => {
                          const newSelectedId = (att.entityId || '') + (att.displayName || '');
                          setSelectedId(newSelectedId || undefined);
                          onSelectAttestation(att);
                        }}
                        hoverable
                      />
                      {/* Category Badge */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          left: 8,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'white',
                          backgroundColor: getCategoryColor(category),
                          boxShadow: 2,
                          zIndex: 1,
                        }}
                      >
                        {category}
                      </Box>
                    </Box>
                  );
                })}
            </Box>

            {/* Empty State */}
            {attestations.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 8,
                  color: 'text.secondary',
                }}
              >
                <VerifiedIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  No Attestations Found
                </Typography>
                <Typography variant="body2">
                  Attestations will appear here once they are created for this organization.
                </Typography>
              </Box>
            )}
          </Box>
        </div>
      </div>

    );
};

export default OrganizationsPage;