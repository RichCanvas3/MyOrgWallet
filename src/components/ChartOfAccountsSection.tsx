import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Paper,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Tab,
  Tabs,
  Button,
  CircularProgress,
} from '@mui/material';

import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { getTokens, getTokenBalances } from '@lifi/sdk';
import { ChainId } from '@lifi/types';

import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DeleteIcon from '@mui/icons-material/Delete';
import { Account, AccountType, ACCOUNT_TYPES } from '../models/Account';
import { IndivAccountAttestation, AccountOrgDelAttestation, OrgAccountAttestation } from '../models/Attestation';
import { useAccount } from 'wagmi';
import { useCrossChainAccount } from "../hooks/useCrossChainTools";

import { IRIS_API_URL, CHAIN_IDS_TO_MESSAGE_TRANSMITTER, CHAIN_IDS_TO_EXPLORER_URL, CIRCLE_SUPPORTED_CHAINS, CHAIN_IDS_TO_USDC_ADDRESSES, CHAIN_TO_CHAIN_NAME, CHAIN_IDS_TO_TOKEN_MESSENGER, CHAIN_IDS_TO_RPC_URLS, DESTINATION_DOMAINS, CHAINS } from '../libs/chains';
import { CHART_OF_ACCOUNTS } from '../constants/chartOfAccounts';


interface ChartOfAccountsSectionProps {
  onSelectAccount?: (account: Account) => void;
  onRefreshAccounts?: () => void;
}

const ChartOfAccountsSection: React.FC<ChartOfAccountsSectionProps> = ({
  onSelectAccount,
  onRefreshAccounts,
}) => {

  const { getUSDCBalance } = useCrossChainAccount();
  const { chain, veramoAgent, credentialManager, signatory, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgBurnerDelegation, indivBurnerDelegation, orgAccountClient, indivAccountClient, privateIssuerAccount, burnerAccountClient } = useWallectConnectContext();
  
  // Add state for view type
  const [viewType, setViewType] = useState<'chart' | 'list'>('chart');
  const [listAccounts, setListAccounts] = useState<Account[]>([]);
  
  // Balance states
  const [accountBalances, setAccountBalances] = useState<{ [accountDid: string]: { USDC: string } }>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>(CHART_OF_ACCOUNTS as Account[]);

  // Ref for scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  
  /*
  // Sample hierarchical account structure
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: '1000',
      code: '1000',
      name: 'Assets',
      type: ACCOUNT_TYPES.Asset,
      balance: 0,
      level: 0,
      children: [
        {
          id: '1100',
          code: '1100',
          name: 'Cash & Bank',
          type: ACCOUNT_TYPES.Asset,
          balance: 0,
          level: 1,
          parentId: '1000',
          children: [
            {
              id: '1110',
              code: '1110',
              name: 'Operating Bank Account',
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 2,
              parentId: '1100',
            },
            {
              id: '1120',
              code: '1120',
              name: 'Petty Cash',
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 2,
              parentId: '1100',
            },
          ],
        },
        {
          id: '1200',
          code: '1200',
          name: 'Credit Cards',
          type: ACCOUNT_TYPES.Asset,
          balance: 0,
          level: 1,
          parentId: '1000',
          children: [
            {
              id: '1210',
              code: '1210',
              name: 'Corporate Credit Cards',
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 2,
              parentId: '1200',
              children: [
                {
                  id: '1211',
                  code: '1211',
                  name: 'Exec Team',
                  type: ACCOUNT_TYPES.Asset,
                  balance: 0,
                  level: 3,
                  parentId: '1210',
                  children: [],
                },
                {
                  id: '1212',
                  code: '1212',
                  name: 'Sales Dept',
                  type: ACCOUNT_TYPES.Asset,
                  balance: 0,
                  level: 3,
                  parentId: '1210',
                  children: [
                    {
                      id: '1212-01',
                      code: '1212-01',
                      name: 'VP Sales - Chase Ink',
                      type: ACCOUNT_TYPES.Asset,
                      balance: -4000,
                      level: 4,
                      parentId: '1212',
                    },
                    {
                      id: '1212-02',
                      code: '1212-02',
                      name: 'Regional Manager East - Amex Biz',
                      type: ACCOUNT_TYPES.Asset,
                      balance: -2000,
                      level: 4,
                      parentId: '1212',
                    },
                    {
                      id: '1212-03',
                      code: '1212-03',
                      name: 'Regional Manager West - Wells Fargo Card',
                      type: ACCOUNT_TYPES.Asset,
                      balance: -2500,
                      level: 4,
                      parentId: '1212',
                    },
                  ],
                },
                {
                  id: '1213',
                  code: '1213',
                  name: 'Product Dept',
                  type: ACCOUNT_TYPES.Asset,
                  balance: 0,
                  level: 3,
                  parentId: '1210',
                  children: [
                    {
                      id: '1213-01',
                      code: '1213-01',
                      name: 'VP Product - Brex Card',
                      type: ACCOUNT_TYPES.Asset,
                      balance: -3500,
                      level: 4,
                      parentId: '1213',
                    },
                    {
                      id: '1213-02',
                      code: '1213-02',
                      name: 'Head of Design - Ramp Card',
                      type: ACCOUNT_TYPES.Asset,
                      balance: -1500,
                      level: 4,
                      parentId: '1213',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: '2000',
      code: '2000',
      name: 'Liabilities',
      type: ACCOUNT_TYPES.Liability,
      balance: 0,
      level: 0,
      children: [
        {
          id: '2100',
          code: '2100',
          name: 'Accounts Payable',
          type: ACCOUNT_TYPES.Liability,
          balance: 15000,
          level: 1,
          parentId: '2000',
        },
        {
          id: '2200',
          code: '2200',
          name: 'Credit Card Liabilities',
          type: ACCOUNT_TYPES.Liability,
          balance: 24000,
          level: 1,
          parentId: '2000',
        },
      ],
    },
  ]);
  */

  // Load attestations and update both chart and list accounts
  useEffect(() => {
    if (orgDid && chain) {
      console.info("Loading attestations for orgDid:", orgDid);
      AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "").then((atts) => {
        console.info("Loaded attestations:", atts);
        const newAccounts = [...CHART_OF_ACCOUNTS as Account[]];
        const newListAccounts: Account[] = [];
        let accountsChanged = false;

        // Helper function to find account and its parent recursively
        const findAccountAndParent = (accounts: Account[], parentId: string): Account | undefined => {
          for (const account of accounts) {
            if (account.id === parentId) {
              return account;
            }
            if (account.children) {
              const found = findAccountAndParent(account.children, parentId);
              if (found) return found;
            }
          }
          return undefined;
        };

        for (const att of atts) {
          if (att.entityId === "account-org(org)") {
            const accountAtt = att as AccountOrgDelAttestation;
            const acct: Account = {
              id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              name: accountAtt.accountName,
              did: accountAtt.accountDid,
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 4,
              parentId: accountAtt.coaCategory,
              attestation: accountAtt,
              children: [],
            };
            
            console.info("Created account object:", acct);
            
            // Add to list view
            newListAccounts.push(acct);
            
            // Add to chart view
            const existingAccount = findAccountAndParent(newAccounts, acct.id);
            if (!existingAccount) {
              if (acct.parentId) {
                const parentAccount = findAccountAndParent(newAccounts, acct.parentId);
                
                if (parentAccount) {
                  if (!parentAccount.children) {
                    parentAccount.children = [];
                  }
                  parentAccount.children.push(acct);
                } else {
                  newAccounts.push(acct);
                }
              } else {
                newAccounts.push(acct);
              }
              accountsChanged = true;
            }
            
            // Fetch balances for accounts with DIDs
            if (acct.did) {
              fetchAccountBalances(acct.did);
            }
          }
          if (att.entityId === "account(org)") {
            const accountAtt = att as OrgAccountAttestation;
            const acct: Account = {
              id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              name: accountAtt.accountName,
              did: accountAtt.accountDid,
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 4,
              parentId: accountAtt.coaCategory,
              children: [],
            };
            
            
            // Add to list view
            newListAccounts.push(acct);
            
            // Add to chart view
            const existingAccount = findAccountAndParent(newAccounts, acct.id);
            if (!existingAccount) {
              if (acct.parentId) {
                const parentAccount = findAccountAndParent(newAccounts, acct.parentId);
                
                if (parentAccount) {
                  if (!parentAccount.children) {
                    parentAccount.children = [];
                  }
                  parentAccount.children.push(acct);
                } else {
                  newAccounts.push(acct);
                }
              } else {
                newAccounts.push(acct);
              }
              accountsChanged = true;
            }
            
            // Fetch balances for accounts with DIDs
            if (acct.did) {
              fetchAccountBalances(acct.did);
            }
          }
        }

        setListAccounts(newListAccounts);
        if (accountsChanged) {
          setAccounts(newAccounts);
        }
      });
    }
  }, [orgDid]);
  
  // Scroll to top when view type changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [viewType]);

  const refreshAccounts = () => {
    if (orgDid && chain) {
      console.info("Refreshing attestations for orgDid:", orgDid);
      AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "").then((atts) => {
        console.info("Refreshed attestations:", atts);
        const newAccounts = [...CHART_OF_ACCOUNTS as Account[]];
        const newListAccounts: Account[] = [];
        let accountsChanged = false;

        // Helper function to find account and its parent recursively
        const findAccountAndParent = (accounts: Account[], parentId: string): Account | undefined => {
          for (const account of accounts) {
            if (account.id === parentId) {
              return account;
            }
            if (account.children) {
              const found = findAccountAndParent(account.children, parentId);
              if (found) return found;
            }
          }
          return undefined;
        };

        for (const att of atts) {
          if (att.entityId === "account-org(org)") {
            const accountAtt = att as AccountOrgDelAttestation;
            const acct: Account = {
              id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              name: accountAtt.accountName,
              did: accountAtt.accountDid,
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 4,
              parentId: accountAtt.coaCategory,
              attestation: accountAtt,
              children: [],
            };
            
            console.info("Created account object:", acct);
            
            // Add to list view
            newListAccounts.push(acct);
            
            // Add to chart view
            const existingAccount = findAccountAndParent(newAccounts, acct.id);
            if (!existingAccount) {
              if (acct.parentId) {
                const parentAccount = findAccountAndParent(newAccounts, acct.parentId);
                
                if (parentAccount) {
                  if (!parentAccount.children) {
                    parentAccount.children = [];
                  }
                  parentAccount.children.push(acct);
                } else {
                  newAccounts.push(acct);
                }
              } else {
                newAccounts.push(acct);
              }
              accountsChanged = true;
            }
            
            // Fetch balances for accounts with DIDs
            if (acct.did) {
              fetchAccountBalances(acct.did);
            }
          }
          if (att.entityId === "account(org)") {
            const accountAtt = att as OrgAccountAttestation;
            const acct: Account = {
              id: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              code: accountAtt.coaCategory + '-' + accountAtt.coaCode,
              name: accountAtt.accountName,
              did: accountAtt.accountDid,
              type: ACCOUNT_TYPES.Asset,
              balance: 0,
              level: 4,
              parentId: accountAtt.coaCategory,
              children: [],
            };
            
            
            // Add to list view
            newListAccounts.push(acct);
            
            // Add to chart view
            const existingAccount = findAccountAndParent(newAccounts, acct.id);
            if (!existingAccount) {
              if (acct.parentId) {
                const parentAccount = findAccountAndParent(newAccounts, acct.parentId);
                
                if (parentAccount) {
                  if (!parentAccount.children) {
                    parentAccount.children = [];
                  }
                  parentAccount.children.push(acct);
                } else {
                  newAccounts.push(acct);
                }
              } else {
                newAccounts.push(acct);
              }
              accountsChanged = true;
            }
            
            // Fetch balances for accounts with DIDs
            if (acct.did) {
              fetchAccountBalances(acct.did);
            }
          }
        }

        setListAccounts(newListAccounts);
        if (accountsChanged) {
          setAccounts(newAccounts);
        }
      });
    }
  };

  // Expose refresh function via useCallback
  const exposedRefreshFunction = useCallback(() => {
    refreshAccounts();
  }, []);

  // Call the exposed refresh function when onRefreshAccounts is provided
  useEffect(() => {
    if (onRefreshAccounts) {
      onRefreshAccounts = exposedRefreshFunction;
    }
  }, [onRefreshAccounts, exposedRefreshFunction]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  // Simple refresh mechanism - call refreshAccounts when onRefreshAccounts is provided
  useEffect(() => {
    if (onRefreshAccounts) {
      // Store the refresh function in a way that can be called from parent
      (window as any).refreshChartOfAccounts = refreshAccounts;
    }
  }, [onRefreshAccounts]);

  // Initialize expanded state
  React.useEffect(() => {
    const initialExpanded = accounts.reduce((acc, account) => {
      acc[account.id] = true;
      if (Array.isArray(account.children) && account.children.length > 0) {
        account.children.forEach(child => {
          acc[child.id] = true;
        });
      }
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedAccounts(initialExpanded);
  }, [accounts]);

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const getAccountTypeColor = (type: AccountType) => {
    switch (type) {
      case ACCOUNT_TYPES.Asset:
        return 'primary';
      case ACCOUNT_TYPES.Liability:
        return 'error';
      case ACCOUNT_TYPES.Equity:
        return 'success';
      case ACCOUNT_TYPES.Revenue:
        return 'info';
      case ACCOUNT_TYPES.Expense:
        return 'warning';
      default:
        return 'default';
    }
  };

  // Recursive function to render account hierarchy
  const renderAccount = (account: Account) => {
    const hasChildren = Array.isArray(account.children) && account.children.length > 0;
    const isExpanded = expandedAccounts[account.id];
    const paddingLeft = account.level * 20;
    const balances = account.did ? accountBalances[account.did] : null;
    const extracted = account.did ? extractFromAccountDid(account.did) : null;

    return (
      <Box key={account.id}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: 'primary.main',
            },
            ml: `${paddingLeft}px`,
            mb: 1,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(account.id);
                }}
              >
                {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
            )}
            <Box
              flex={1}
              onClick={() => onSelectAccount?.(account)}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {account.code} - {account.name}
                  <Chip
                    label={account.type}
                    size="small"
                    color={getAccountTypeColor(account.type)}
                    sx={{ height: 20 }}
                  />
                </Typography>
                {extracted && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.5 }} component="div">
                    <Chip 
                      label={CHAIN_TO_CHAIN_NAME[extracted.chainId]}
                      size="small"
                      color="primary"
                      variant="filled"
                      sx={{ mr: 1, fontWeight: 'bold' }}
                    />
                    Chain ID: {extracted.chainId} | Address: {extracted.address}
                  </Typography>
                )}
                {balances && (
                  <Box display="flex" gap={1} mt={0.5}>
                    <Chip 
                      label={`${balances.USDC} USDC`}
                      size="small"
                      variant="outlined"
                      color="success"
                    />
                  </Box>
                )}
                {account.did && isLoadingBalances && (
                  <CircularProgress size={12} sx={{ mt: 0.5 }} />
                )}
              </Box>
              <Typography
                variant="h6"
                color={account.balance >= 0 ? 'primary' : 'error'}
                sx={{ minWidth: 120, textAlign: 'right' }}
              >
                {getDisplayBalance(account)}
              </Typography>
            </Box>
          </Box>
        </Paper>
        {hasChildren && isExpanded && (
          <Box>
            {(account.children as Account[]).map(child => renderAccount(child))}
          </Box>
        )}
      </Box>
    );
  };

  // Filter accounts based on search term
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;

    const searchLower = searchTerm.toLowerCase();
    
    const filterAccount = (account: Account): Account | null => {
      if (
        account.code.toLowerCase().includes(searchLower) ||
        account.name.toLowerCase().includes(searchLower)
      ) {
        return account;
      }

      if (account.children) {
        const filteredChildren = account.children
          .map(child => filterAccount(child))
          .filter((child): child is Account => child !== null);

        if (filteredChildren.length > 0) {
          return {
            ...account,
            children: filteredChildren,
          };
        }
      }

      return null;
    };

    return accounts
      .map(account => filterAccount(account))
      .filter((account): account is Account => account !== null);
  }, [accounts, searchTerm]);

  // Handle attestation revocation
  const handleRevoke = async (attestationUid: string) => {
    try {
      if (!orgAccountClient || !orgAccountClient || !orgBurnerDelegation) {
        console.error("Missing required clients for revocation");
        return;
      }

      await AttestationService.revokeAttestation(
        attestationUid,
        orgAccountClient,
        orgAccountClient,
        [orgBurnerDelegation]
      );

      // Remove from list view
      setListAccounts(prev => prev.filter(acc => acc.id !== attestationUid));
      
      // Note: The chart view will be updated via the attestation event handler
    } catch (error) {
      console.error("Error revoking attestation:", error);
    }
  };

  // Update the renderListAccount function
  const renderListAccount = (account: Account) => {
    const balances = account.did ? accountBalances[account.did] : null;
    const extracted = account.did ? extractFromAccountDid(account.did) : null;

    return (
      <Paper
        key={account.id}
        elevation={0}
        sx={{
          p: 2,
          cursor: 'pointer',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: 'primary.main',
          },
          mb: 1,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box 
            flex={1} 
            onClick={() => onSelectAccount?.(account)}
            sx={{ cursor: 'pointer' }}
          >
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {account.code} - {account.name}
              <Chip
                label={account.type}
                size="small"
                color={getAccountTypeColor(account.type)}
                sx={{ height: 20 }}
              />
            </Typography>
            {extracted && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.5 }} component="div">
                <Chip 
                  label={CHAIN_TO_CHAIN_NAME[extracted.chainId]}
                  size="small"
                  color="primary"
                  variant="filled"
                  sx={{ mr: 1, fontWeight: 'bold' }}
                />
                Chain ID: {extracted.chainId} | Address: {extracted.address}
              </Typography>
            )}
            {balances && (
              <Box display="flex" gap={1} mt={0.5}>
                <Chip 
                  label={`${balances.USDC} USDC`}
                  size="small"
                  variant="outlined"
                  color="success"
                />
              </Box>
            )}
            {account.did && isLoadingBalances && (
              <CircularProgress size={12} sx={{ mt: 0.5 }} />
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography
              variant="h6"
              color={account.balance >= 0 ? 'primary' : 'error'}
              sx={{ minWidth: 120, textAlign: 'right' }}
            >
              {getDisplayBalance(account)}
            </Typography>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleRevoke(account.id);
              }}
              size="small"
              color="error"
              sx={{ 
                '&:hover': {
                  backgroundColor: 'error.light',
                  color: 'white',
                }
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    );
  };

  // Utility function to extract chainId and address from accountDid
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


  // Fetch balances for accounts
  const fetchAccountBalances = async (accountDid: string) => {
    if (!accountDid || !chain) return;
    
    setIsLoadingBalances(true);
    try {
      const extracted = extractFromAccountDid(accountDid);
      if (!extracted) {
        console.error('Invalid accountDid format:', accountDid);
        return;
      }
      
      const { address: accountAddress, chainId: accountChainId } = extracted;

      const balance = await getUSDCBalance(accountAddress, accountChainId)

      const balances: { USDC: string } = { USDC: '0' };
      balances.USDC = balance;

      setAccountBalances(prev => ({
        ...prev,
        [accountDid]: balances
      }));

      /*
      // if mainnet then use the mainnet USDC address
      // Use numeric chain ID directly instead of LiFi ChainId enum
      const tokensResponse = await getTokens({ chains: [accountChainId as any] });
      const tokens = tokensResponse.tokens[accountChainId as any] || [];
      
      const nativeToken = "0x0000000000000000000000000000000000000000";
      // Find USDC token dynamically from the response
      const usdcToken = tokens.find(token => 
        token.symbol === 'USDC' && token.address !== nativeToken
      )?.address || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"; // fallback to Linea USDC
      
      const filteredTokens = tokens.filter(item => 
        item.address === nativeToken || item.address === usdcToken
      );
      
      if (filteredTokens.length > 0) {
        const tokenBalances = await getTokenBalances(accountAddress, filteredTokens);
        
        const balances: { USDC: string } = { USDC: '0' };
        
        // USDC balance
        const usdcBalance = tokenBalances.find(balance => balance.address === usdcToken);
        if (usdcBalance && usdcBalance.amount) {
          const amountBigInt = BigInt(usdcBalance.amount.toString());
          const dollars = Number(amountBigInt) / 1_000_000;
          balances.USDC = dollars.toFixed(2);
        } else {
          balances.USDC = '0';
        }

        console.info("*********** account balances ****************", balances);
        
        setAccountBalances(prev => ({
          ...prev,
          [accountDid]: balances
        }));
      }
        */
    } catch (error) {
      console.error('Error fetching account balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
      
  };

  // Function to calculate total USDC balance for an account and its children
  const calculateTotalUSDCBalance = (account: Account): number => {
    let total = 0;
    
    // Add this account's balance if it has a DID
    if (account.did && accountBalances[account.did]) {
      total += parseFloat(accountBalances[account.did].USDC);
    }
    
    // Add children's balances recursively
    if (account.children && account.children.length > 0) {
      for (const child of account.children) {
        total += calculateTotalUSDCBalance(child);
      }
    }
    
    return total;
  };

  // Function to get display balance for an account
  const getDisplayBalance = (account: Account): string => {
    // For accounts with children, show the total of all children
    if (account.children && account.children.length > 0) {
      const totalBalance = calculateTotalUSDCBalance(account);
      return `$${totalBalance.toLocaleString()}`;
    }
    
    // For leaf accounts (no children), show their individual balance
    if (account.did && accountBalances[account.did]) {
      return `$${parseFloat(accountBalances[account.did].USDC).toLocaleString()}`;
    }
    
    // Fallback to original balance
    return `$${Math.abs(account.balance).toLocaleString()}`;
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
      height="70vh"
      width="100%"
    >
      {/* Header with Search and View Toggle */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        mb={2}
        px={2}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <AccountBalanceIcon color="primary" />
            <Typography variant="h6" color="primary">
              Chart of Accounts
            </Typography>
          </Box>
          <Tabs 
            value={viewType} 
            onChange={(_, newValue) => setViewType(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Chart View" value="chart" />
            <Tab label="List View" value="list" />
          </Tabs>
        </Box>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search accounts..."
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

      {/* Account Views */}
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
        {viewType === 'chart' ? (
          <Stack spacing={1}>
            {filteredAccounts.map(account => renderAccount(account))}
          </Stack>
        ) : (
          <Stack spacing={1}>
            {listAccounts.length > 0 ? (
              listAccounts
                .filter(account => 
                  account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  account.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(account => renderListAccount(account))
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                No accounts found
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default ChartOfAccountsSection; 