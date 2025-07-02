import React from 'react';
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
import { useTrustScore } from '../hooks/useTrustScore';

interface TrustScoreSectionProps {
  orgDid?: string;
  indivDid?: string;
}

const TrustScoreSection: React.FC<TrustScoreSectionProps> = ({
  orgDid,
  indivDid,
}) => {
  // Use centralized trust score hook
  const { trustScore, isLoading, error } = useTrustScore({ orgDid, indivDid });

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
            <Box flex={1} minWidth="180px">
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
            
            <Box flex={1} minWidth="180px">
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
            
            <Box flex={1} minWidth="180px">
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
            
            <Box flex={1} minWidth="180px">
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
            
            <Box flex={1} minWidth="180px">
              <Tooltip title="Reputation Score: Based on reviews, endorsements, and general attestations. Verified attestations get 15 points, unverified get 8 points. Multiple reputation attestations receive bonus points.">
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <VerifiedIcon fontSize="small" />
                  <Typography variant="body2">Reputation</Typography>
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
