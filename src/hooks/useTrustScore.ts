import { useState, useEffect } from 'react';
import { Chain } from 'viem';
import { Attestation } from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from '../context/walletConnectContext';
import { useCrossChainAccount } from './useCrossChainTools';

export interface TrustScore {
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
    categories: Record<string, number>;
    totalUSDCBalance: number;
    savingsAccounts: number;
  };
}

export interface UseTrustScoreProps {
  orgDid?: string;
  indivDid?: string;
}

export const useTrustScore = ({ orgDid, indivDid }: UseTrustScoreProps) => {
  const { chain } = useWallectConnectContext();
  const { getUSDCBalance } = useCrossChainAccount();
  
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
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

  // Define pillar mapping with categories and scoring rules
  const pillarMapping = {
    leadership: {
      categories: ['leadership', 'leaders', 'management', 'executive'],
      entityPatterns: ['org-indiv(org)'],
      verifiedPoints: 20,
      unverifiedPoints: 10
    },
    identity: {
      categories: ['identity', 'domain', 'website', 'social', 'email', 'phone', 'address'],
      entityPatterns: ['domain(org)', 'website(org)', 'email(org)'],
      verifiedPoints: 25,
      unverifiedPoints: 15
    },
    finance: {
      categories: ['financial', 'account', 'credit', 'revenue', 'funding', 'delegations', 'account access'],
      entityPatterns: ['account(org)', 'account-indiv(org)'],
      verifiedPoints: 20,
      unverifiedPoints: 10
    },
    compliance: {
      categories: ['compliance', 'insurance', 'license', 'registration', 'audit', 'certification', 'security'],
      entityPatterns: ['state', 'insurance', 'license'],
      verifiedPoints: 30,
      unverifiedPoints: 15
    },
    reputation: {
      categories: ['reputation', 'endorsement', 'review', 'rating', 'testimonial', 'accreditation'],
      entityPatterns: ['review', 'endorsement'],
      verifiedPoints: 15,
      unverifiedPoints: 8
    }
  };

  const calculateTrustScore = async (attestations: Attestation[]): Promise<TrustScore> => {
    const breakdown = {
      leadership: 0,
      identity: 0,
      finance: 0,
      compliance: 0,
      reputation: 0
    };

    const categories: Record<string, number> = {};
    let totalAttestations = attestations.length;
    let totalUSDCBalance = 0;
    let savingsAccounts = 0;

    // Calculate scores based on attestation types and categories
    attestations.forEach(att => {
      // Count attestations by category
      if (att.category) {
        categories[att.category] = (categories[att.category] || 0) + 1;
      }

      // Determine which pillar this attestation contributes to
      let contributingPillar: keyof typeof breakdown | null = null;
      
      for (const [pillar, config] of Object.entries(pillarMapping)) {
        // Check if category matches
        if (config.categories.includes(att.category || '')) {
          contributingPillar = pillar as keyof typeof breakdown;
          break;
        }
        
        // Check if entity ID matches patterns
        if (att.entityId && config.entityPatterns.some(pattern => att.entityId?.includes(pattern))) {
          contributingPillar = pillar as keyof typeof breakdown;
          break;
        }
      }

      // Add points to the appropriate pillar
      if (contributingPillar) {
        const config = pillarMapping[contributingPillar];
        const points = config.verifiedPoints; // Use same points for all attestations
        breakdown[contributingPillar] += points;
        
        // Count savings accounts for finance pillar
        if (contributingPillar === 'finance' && att.entityId?.includes('account')) {
          savingsAccounts++;
        }
      }

      // Bonus for having multiple attestations in the same category
      if (att.category && categories[att.category] > 1) {
        const bonus = Math.min(5, categories[att.category] - 1);
        
        // Find which pillar this category belongs to for bonus
        for (const [pillar, config] of Object.entries(pillarMapping)) {
          if (config.categories.includes(att.category || '')) {
            breakdown[pillar as keyof typeof breakdown] += bonus;
            break;
          }
        }
      }
    });

    // Calculate USDC balances for savings accounts
    if (chain && orgDid) {
      try {
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
      const atts = await AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, indivDid || "");
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
  }, [chain, orgDid, indivDid]);

  const refreshTrustScore = () => {
    loadAttestations();
  };

  return {
    trustScore,
    attestations,
    isLoading,
    error,
    refreshTrustScore,
    calculateTrustScore
  };
};
