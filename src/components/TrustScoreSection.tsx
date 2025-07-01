import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useCrossChainAccount } from "../hooks/useCrossChainTools";
import AttestationService from '../service/AttestationService';
import { Attestation } from '../models/Attestation';

interface TrustScoreSectionProps {
  orgDid?: string;
  indivDid?: string;
}

const TrustScoreSection: React.FC<TrustScoreSectionProps> = ({
  orgDid,
  indivDid,
}) => {
  const { chain } = useWallectConnectContext();
  const { getUSDCBalance } = useCrossChainAccount();

  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [trustScore, setTrustScore] = useState<{
    overall: number;
    breakdown: {
      leadership: number;
      identity: number;
      finance: number;
      compliance: number;
      reputation: number;
    };
    details: {
      totalAttestations: number;
      verifiedAttestations: number;
      categories: Record<string, number>;
      totalUSDCBalance: number;
      savingsAccounts: number;
    };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractFromAccountDid = (accountDid: string): { chainId: number; address: `0x${string}` } | null => {
    try {
      // Parse did:pkh:eip155:chainId:address format
      const parts = accountDid.split(':');
      if (parts.length === 5 && parts[0] === 'did' && parts[1] === 'pkh' && parts[2] === 'eip155') {
        const chainId = parseInt(parts[3], 10);
        const address = parts[4] as `0x${string}`;
        return { chainId, address };
      }
      return null;
    } catch (error) {
      console.error('Error parsing accountDid:', error);
      return null;
    }
  };

  // Trust score calculation function
  const calculateTrustScore = async (attestations: Attestation[]): Promise<{
    overall: number;
    breakdown: {
      leadership: number;
      identity: number;
      finance: number;
      compliance: number;
      reputation: number;
    };
    details: {
      totalAttestations: number;
      verifiedAttestations: number;
      categories: Record<string, number>;
      totalUSDCBalance: number;
      savingsAccounts: number;
    };
  }> => {
    const breakdown = {
      leadership: 0,
      identity: 0,
      finance: 0,
      compliance: 0,
      reputation: 0
    };

    const categories: Record<string, number> = {};
    let totalAttestations = attestations.length;
    let verifiedAttestations = 0;
    let totalUSDCBalance = 0;
    let savingsAccounts = 0;

    // Calculate scores based on attestation types and categories
    attestations.forEach(att => {
      if (att.isValidated) {
        verifiedAttestations++;
      }

      // Count attestations by category
      if (att.category) {
        categories[att.category] = (categories[att.category] || 0) + 1;
      }

      // Leadership score (org-indiv attestations, leadership roles)
      if (att.category === 'leaders' || att.entityId === 'org-indiv(org)') {
        breakdown.leadership += att.isValidated ? 20 : 10;
      }

      // Identity score (domain, website, social presence)
      if (att.category === 'domain' || att.entityId === 'domain(org)' || 
          att.category === 'website' || att.category === 'social') {
        breakdown.identity += att.isValidated ? 25 : 15;
      }

      // Finance score (accounts, financial attestations)
      if (att.category === 'account' || att.entityId?.includes('account')) {
        breakdown.finance += att.isValidated ? 20 : 10;
        savingsAccounts++;
      }

      // Compliance score (insurance, licenses, registrations)
      if (att.category === 'insurance' || att.category === 'license' || 
          att.category === 'registration' || att.entityId?.includes('state')) {
        breakdown.compliance += att.isValidated ? 30 : 15;
      }

      // Reputation score (reviews, endorsements, general attestations)
      if (att.category === 'reputation' || att.category === 'endorsement' || 
          att.category === 'review') {
        breakdown.reputation += att.isValidated ? 15 : 8;
      }

      // Bonus for having multiple attestations in the same category
      if (categories[att.category || ''] > 1) {
        const bonus = Math.min(5, categories[att.category || ''] - 1);
        if (att.category === 'leaders') breakdown.leadership += bonus;
        else if (att.category === 'domain') breakdown.identity += bonus;
        else if (att.category === 'account') breakdown.finance += bonus;
        else if (att.category === 'insurance') breakdown.compliance += bonus;
        else if (att.category === 'reputation') breakdown.reputation += bonus;
      }
    });

    // Calculate USDC balances for savings accounts
    if (chain && orgDid) {
      try {
        console.info("attestations: ", attestations)
        const savingsAccountAttestations = attestations.filter(att => 
          (att as any).coaCategory === '1110' || att.entityId?.includes('account(org)')
        );

        for (const att of savingsAccountAttestations) {
          if (att.entityId?.includes('account(org)') && att.attester) {
            try {
              const extracted = extractFromAccountDid((att as any).accountDid);
              if (extracted) {
                const { chainId, address } = extracted;
                const balance = await getUSDCBalance(address, chainId);
                if (balance) {
                  totalUSDCBalance += parseFloat(balance);
                }
              }
            } catch (error) {
              console.warn('Failed to get USDC balance for account:', att.attester);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to calculate USDC balances:', error);
      }
    }

    // Add USDC balance bonus to finance score
    if (totalUSDCBalance > 0) {
      // Bonus points based on USDC balance tiers
      if (totalUSDCBalance >= 10000) breakdown.finance += 30; // $10k+ gets 30 bonus points
      else if (totalUSDCBalance >= 1000) breakdown.finance += 20; // $1k+ gets 20 bonus points
      else if (totalUSDCBalance >= 100) breakdown.finance += 10; // $100+ gets 10 bonus points
      else breakdown.finance += 5; // Any balance gets 5 bonus points
    }

    // Cap each category at 100
    Object.keys(breakdown).forEach(key => {
      breakdown[key as keyof typeof breakdown] = Math.min(100, breakdown[key as keyof typeof breakdown]);
    });

    // Calculate overall score (weighted average)
    const overall = Math.round(
      (breakdown.leadership * 0.25 + 
       breakdown.identity * 0.25 + 
       breakdown.finance * 0.20 + 
       breakdown.compliance * 0.20 + 
       breakdown.reputation * 0.10)
    );

    return {
      overall: Math.min(100, overall),
      breakdown,
      details: {
        totalAttestations,
        verifiedAttestations,
        categories,
        totalUSDCBalance,
        savingsAccounts
      }
    };
  };

  const loadAttestations = async () => {
    if (!chain || !orgDid) return;

    setIsLoading(true);
    setError(null);

    try {
      const atts = await AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "");
      setAttestations(atts);
      
      // Calculate trust score when attestations are loaded
      const score = await calculateTrustScore(atts);
      setTrustScore(score);
    } catch (err) {
      console.error('Error loading attestations:', err);
      setError('Failed to load attestations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttestations();
  }, [chain, orgDid]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!trustScore) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography variant="body1" color="text.secondary">
          No trust score data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Trust Score Display */}
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
          <Box display="flex" gap={2} flexWrap="wrap">
            <Box flex={1} minWidth="200px">
              <Tooltip title="Leadership Score: Based on org-indiv attestations and leadership roles. Verified attestations get 20 points, unverified get 10 points. Multiple leadership attestations receive bonus points.">
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <VerifiedIcon fontSize="small" />
                  <Typography variant="body2">Leadership</Typography>
                </Box>
              </Tooltip>
              <LinearProgress 
                variant="determinate" 
                value={trustScore.breakdown.leadership} 
                sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
              />
              <Typography variant="caption">{trustScore.breakdown.leadership}%</Typography>
            </Box>
            
            <Box flex={1} minWidth="200px">
              <Tooltip title="Identity Score: Based on domain, website, and social presence attestations. Verified attestations get 25 points, unverified get 15 points. Multiple identity attestations receive bonus points.">
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <BusinessIcon fontSize="small" />
                  <Typography variant="body2">Identity</Typography>
                </Box>
              </Tooltip>
              <LinearProgress 
                variant="determinate" 
                value={trustScore.breakdown.identity} 
                sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
              />
              <Typography variant="caption">{trustScore.breakdown.identity}%</Typography>
            </Box>
            
            <Box flex={1} minWidth="200px">
              <Tooltip title="Finance Score: Based on account attestations and USDC balances. Verified accounts get 20 points, unverified get 10 points. USDC balance bonuses: $10k+ (30pts), $1k+ (20pts), $100+ (10pts), any balance (5pts).">
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <AccountBalanceIcon fontSize="small" />
                  <Typography variant="body2">Finance</Typography>
                </Box>
              </Tooltip>
              <LinearProgress 
                variant="determinate" 
                value={trustScore.breakdown.finance} 
                sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
              />
              <Typography variant="caption">{trustScore.breakdown.finance}%</Typography>
            </Box>
            
            <Box flex={1} minWidth="200px">
              <Tooltip title="Compliance Score: Based on insurance, licenses, and state registration attestations. Verified attestations get 30 points, unverified get 15 points. Multiple compliance attestations receive bonus points.">
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <SecurityIcon fontSize="small" />
                  <Typography variant="body2">Compliance</Typography>
                </Box>
              </Tooltip>
              <LinearProgress 
                variant="determinate" 
                value={trustScore.breakdown.compliance} 
                sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} 
              />
              <Typography variant="caption">{trustScore.breakdown.compliance}%</Typography>
            </Box>
          </Box>

          {/* Attestation Summary */}
          <Box mt={2} display="flex" gap={2} flexWrap="wrap">
            <Chip 
              label={`${trustScore.details.verifiedAttestations}/${trustScore.details.totalAttestations} Verified`}
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
    </Box>
  );
};

export default TrustScoreSection;
