import { useState, useEffect } from 'react';
import { Chain } from 'viem';
import { Attestation } from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from '../context/walletConnectContext';
import { useCrossChainAccount } from './useCrossChainTools';

export interface TrustScore {
  overall: number;
  organizationName?: string;
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
    hasKYC: boolean;
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
      categories: ['finance', 'account', 'credit', 'revenue', 'funding'],
      entityPatterns: ['account(org)'],
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
    let hasKYC = false;
    let leadershipAttestations: Attestation[] = [];
    
    // Extract organization name from org attestation
    let organizationName: string | undefined;
    const orgAttestation = attestations.find(att => att.entityId === "org(org)");
    if (orgAttestation && (orgAttestation as any).name) {
      organizationName = (orgAttestation as any).name;
    }

    // Check for MetaMask Card attestation and apply KYC logic
    const hasMetaMaskCard = attestations.some(att => att.displayName === "MetaMask Card");
    console.log('MetaMask Card detection:', {
      hasMetaMaskCard,
      allAttestations: attestations.map(att => ({
        displayName: att.displayName,
        category: att.category,
        entityId: att.entityId
      }))
    });
    
    if (hasMetaMaskCard) {
      hasKYC = true;
      console.log('KYC flag set to true due to MetaMask Card');
      // Boost leadership score by 30% (add 30% of current leadership score)
      // We'll apply this after calculating the base leadership score
    }

    // First pass: collect all leadership attestations
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

      // Collect leadership attestations for special processing
      if (contributingPillar === 'leadership') {
        leadershipAttestations.push(att);
        console.log('Leadership attestation found:', {
          displayName: att.displayName,
          category: att.category,
          entityId: att.entityId,
          contributingPillar
        });
      }

      // Add points to the appropriate pillar (except leadership which we'll handle separately)
      if (contributingPillar && contributingPillar !== 'leadership') {
        const config = pillarMapping[contributingPillar];
        const points = config.verifiedPoints; // Use same points for all attestations
        breakdown[contributingPillar] += points;
        
        // Count savings accounts for finance pillar
        if (contributingPillar === 'finance' && att.entityId?.includes('account')) {
          savingsAccounts++;
        }
        
        // Debug finance attestations
        if (contributingPillar === 'finance') {
          console.log('Finance attestation found:', {
            displayName: att.displayName,
            category: att.category,
            entityId: att.entityId,
            pointsAdded: points,
            currentFinanceScore: breakdown.finance
          });
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

    // Special handling for leadership attestations
    if (leadershipAttestations.length > 0) {
      const config = pillarMapping.leadership;
      const totalLeadershipPoints = leadershipAttestations.length * config.verifiedPoints;
      
      console.log('Leadership scoring debug:', {
        totalAttestations: leadershipAttestations.length,
        totalLeadershipPoints,
        attestations: leadershipAttestations.map(att => ({
          displayName: att.displayName,
          category: att.category,
          entityId: att.entityId
        }))
      });
      
      // First leadership attestation gets at least 50% of total leadership score
      const firstAttestationPoints = Math.max(
        Math.round(totalLeadershipPoints * 0.8), // At least 80% of total
        config.verifiedPoints // But not less than normal points
      );
      
      // Remaining points distributed among other leadership attestations
      const remainingPoints = totalLeadershipPoints - firstAttestationPoints;
      const remainingAttestations = leadershipAttestations.length - 1;
      
      if (remainingAttestations > 0) {
        const pointsPerRemainingAttestation = Math.round(remainingPoints / remainingAttestations);
        breakdown.leadership = firstAttestationPoints + (remainingAttestations * pointsPerRemainingAttestation);
      } else {
        breakdown.leadership = firstAttestationPoints;
      }
      
      console.log('Leadership score calculation:', {
        firstAttestationPoints,
        remainingPoints,
        remainingAttestations,
        finalLeadershipScore: breakdown.leadership
      });
    }

    // Apply KYC boost to leadership score if MetaMask Card is present
    if (hasKYC) {
      const leadershipBoost = Math.round(breakdown.leadership * 3.0); // 30% boost
      breakdown.leadership += leadershipBoost;
      console.log('KYC boost applied:', {
        originalScore: breakdown.leadership - leadershipBoost,
        boost: leadershipBoost,
        finalScore: breakdown.leadership
      });
    }

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
    console.log('USDC Balance calculation:', {
      totalUSDCBalance,
      financeScoreBeforeUSDC: breakdown.finance,
      savingsAccounts
    });
    
    if (totalUSDCBalance > 0) {
      // Bonus points based on USDC balance tiers
      if (totalUSDCBalance >= 10000) breakdown.finance += 30; // $10k+ gets 30 bonus points
      else if (totalUSDCBalance >= 1000) breakdown.finance += 20; // $1k+ gets 20 bonus points
      else if (totalUSDCBalance >= 100) breakdown.finance += 10; // $100+ gets 10 bonus points
      else breakdown.finance += 5; // Any balance gets 5 bonus points
      
      console.log('USDC bonus applied:', {
        totalUSDCBalance,
        bonusApplied: totalUSDCBalance >= 10000 ? 30 : 
                     totalUSDCBalance >= 1000 ? 20 : 
                     totalUSDCBalance >= 100 ? 10 : 5,
        financeScoreAfterUSDC: breakdown.finance
      });
    } else {
      console.log('No USDC balance found, no bonus applied');
    }

    // Cap each category at 100
    Object.keys(breakdown).forEach(key => {
      breakdown[key as keyof typeof breakdown] = Math.min(100, breakdown[key as keyof typeof breakdown]);
    });

    console.log('Final breakdown before overall calculation:', breakdown);

    // Calculate overall score (weighted average)
    const overall = Math.round(
      (breakdown.leadership * 0.25 + 
       breakdown.identity * 0.25 + 
       breakdown.finance * 0.20 + 
       breakdown.compliance * 0.20 + 
       breakdown.reputation * 0.10)
    );

    console.log('Overall score calculation:', {
      leadership: breakdown.leadership * 0.25,
      identity: breakdown.identity * 0.25,
      finance: breakdown.finance * 0.20,
      compliance: breakdown.compliance * 0.20,
      reputation: breakdown.reputation * 0.10,
      total: overall
    });

    return {
      overall: Math.min(100, overall),
      organizationName,
      breakdown,
      details: {
        totalAttestations,
        categories,
        totalUSDCBalance,
        savingsAccounts,
        hasKYC
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
      console.info("11111 --- loadAttestations: ", atts)
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
