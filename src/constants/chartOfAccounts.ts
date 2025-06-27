import { AccountType } from '../models/Account';

// Chart of Accounts hierarchy data
export const CHART_OF_ACCOUNTS = [
  {
    id: '1000',
    code: '1000',
    name: 'Assets',
    type: 'Asset' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      {
        id: '1100',
        code: '1100',
        name: 'Cash & Cash Equivalents',
        type: 'Asset' as AccountType,
        level: 1,
        parentId: '1000',
        balance: 0,
        did: '',
        children: [
          { id: '1110', code: '1110', name: 'Main Savings', type: 'Asset' as AccountType, level: 2, parentId: '1100', balance: 250_000, did: '' },
          { id: '1120', code: '1120', name: 'Petty Cash', type: 'Asset' as AccountType, level: 2, parentId: '1100', balance: 1_000, did: '' },
          { id: '1130', code: '1130', name: 'Operations', type: 'Asset' as AccountType, level: 2, parentId: '1100', balance: 0, did: '' },
          { id: '1140', code: '1140', name: 'Tax Reserve', type: 'Asset' as AccountType, level: 2, parentId: '1100', balance: 0, did: '' },
          { id: '1150', code: '1150', name: 'Credit Cards (pre-paid debit)', type: 'Asset' as AccountType, level: 2, parentId: '1100', balance: 0, did: '' },
        ],
      },
      { id: '1200', code: '1200', name: 'Accounts Receivable', type: 'Asset' as AccountType, level: 1, parentId: '1000', balance: 0, did: '' },
      { id: '1300', code: '1300', name: 'Cleaning Supplies Inventory', type: 'Asset' as AccountType, level: 1, parentId: '1000', balance: 0, did: '' },
      { id: '1400', code: '1400', name: 'Prepaid Expenses', type: 'Asset' as AccountType, level: 1, parentId: '1000', balance: 0, did: '' },
      {
        id: '1500',
        code: '1500',
        name: 'Property, Plant & Equipment',
        type: 'Asset' as AccountType,
        level: 1,
        parentId: '1000',
        balance: 0,
        did: '',
        children: [
          { id: '1510', code: '1510', name: 'Equipment', type: 'Asset' as AccountType, level: 2, parentId: '1500', balance: 0, did: '' },
          { id: '1520', code: '1520', name: 'Accum. Depreciation', type: 'Asset' as AccountType, level: 2, parentId: '1500', balance: 0, did: '' },
        ],
      },
    ],
  },
  {
    id: '2000',
    code: '2000',
    name: 'Liabilities',
    type: 'Liability' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      { id: '2100', code: '2100', name: 'Accounts Payable', type: 'Liability' as AccountType, level: 1, parentId: '2000', balance: 15_000, did: '' },
      {
        id: '2200',
        code: '2200',
        name: 'Credit Card Payables',
        type: 'Liability' as AccountType,
        level: 1,
        parentId: '2000',
        balance: 24_000,
        did: '',
        children: [
          { id: '2210', code: '2210', name: 'MetaMask Mastercard Payable', type: 'Liability' as AccountType, level: 2, parentId: '2200', balance: 0, did: '' },
          {
            id: '2220',
            code: '2220',
            name: 'Corporate Credit Cards',
            type: 'Liability' as AccountType,
            level: 2,
            parentId: '2200',
            balance: 0,
            did: '',
            children: [
              { id: '2221', code: '2221', name: 'Exec Team', type: 'Liability' as AccountType, level: 3, parentId: '2220', balance: 0, did: '' },
              {
                id: '2222',
                code: '2222',
                name: 'Sales Dept',
                type: 'Liability' as AccountType,
                level: 3,
                parentId: '2220',
                balance: 0,
                did: '',
                children: [
                  { id: '2222-01', code: '2222-01', name: 'VP Sales – Chase Ink', type: 'Liability' as AccountType, level: 4, parentId: '2222', balance: 4_000, did: '' },
                  { id: '2222-02', code: '2222-02', name: 'Regional Mgr East – Amex Biz', type: 'Liability' as AccountType, level: 4, parentId: '2222', balance: 2_000, did: '' },
                  { id: '2222-03', code: '2222-03', name: 'Regional Mgr West – Wells Fargo', type: 'Liability' as AccountType, level: 4, parentId: '2222', balance: 2_500, did: '' },
                ],
              },
              {
                id: '2223',
                code: '2223',
                name: 'Product Dept',
                type: 'Liability' as AccountType,
                level: 3,
                parentId: '2220',
                balance: 0,
                did: '',
                children: [
                  { id: '2223-01', code: '2223-01', name: 'VP Product – Brex Card', type: 'Liability' as AccountType, level: 4, parentId: '2223', balance: 3_500, did: '' },
                  { id: '2223-02', code: '2223-02', name: 'Head Design – Ramp Card', type: 'Liability' as AccountType, level: 4, parentId: '2223', balance: 1_500, did: '' },
                ],
              },
            ],
          },
        ],
      },
      { id: '2300', code: '2300', name: 'Sales Tax Payable', type: 'Liability' as AccountType, level: 1, parentId: '2000', balance: 0, did: '' },
      { id: '2400', code: '2400', name: 'Payroll Liabilities', type: 'Liability' as AccountType, level: 1, parentId: '2000', balance: 0, did: '' },
      { id: '2500', code: '2500', name: 'Loans Payable – Equipment', type: 'Liability' as AccountType, level: 1, parentId: '2000', balance: 0, did: '' },
    ],
  },
  {
    id: '3000',
    code: '3000',
    name: 'Equity',
    type: 'Equity' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      { id: '3100', code: '3100', name: 'Owner Capital', type: 'Equity' as AccountType, level: 1, parentId: '3000', balance: 0, did: '' },
      { id: '3200', code: '3200', name: 'Owner Draw / Distributions', type: 'Equity' as AccountType, level: 1, parentId: '3000', balance: 0, did: '' },
      { id: '3300', code: '3300', name: 'Retained Earnings', type: 'Equity' as AccountType, level: 1, parentId: '3000', balance: 0, did: '' },
    ],
  },
  {
    id: '4000',
    code: '4000',
    name: 'Income',
    type: 'Income' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      { id: '4100', code: '4100', name: 'Residential Cleaning Revenue', type: 'Income' as AccountType, level: 1, parentId: '4000', balance: 0, did: '' },
      { id: '4200', code: '4200', name: 'Commercial Cleaning Revenue', type: 'Income' as AccountType, level: 1, parentId: '4000', balance: 0, did: '' },
      { id: '4300', code: '4300', name: 'Other / One‑off Services', type: 'Income' as AccountType, level: 1, parentId: '4000', balance: 0, did: '' },
    ],
  },
  {
    id: '5000',
    code: '5000',
    name: 'Direct Costs',
    type: 'COGS' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      { id: '5100', code: '5100', name: 'Cleaning Supplies Used', type: 'COGS' as AccountType, level: 1, parentId: '5000', balance: 0, did: '' },
      { id: '5200', code: '5200', name: 'Sub‑contractor Labor', type: 'COGS' as AccountType, level: 1, parentId: '5000', balance: 0, did: '' },
    ],
  },
  {
    id: '6000',
    code: '6000',
    name: 'Operating Expenses',
    type: 'Expense' as AccountType,
    level: 0,
    balance: 0,
    did: '',
    children: [
      { id: '6100', code: '6100', name: 'Wages Expense', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6200', code: '6200', name: 'Payroll Taxes Expense', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6300', code: '6300', name: 'Insurance', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6400', code: '6400', name: 'Rent & Utilities', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6500', code: '6500', name: 'Vehicle & Fuel', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6600', code: '6600', name: 'Marketing & Advertising', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6700', code: '6700', name: 'Software & SaaS', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6800', code: '6800', name: 'Bank & Processing Fees', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6810', code: '6810', name: 'Crypto Gas & On‑chain Fees', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6900', code: '6900', name: 'Depreciation Expense', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
      { id: '6990', code: '6990', name: 'Miscellaneous Expense', type: 'Expense' as AccountType, level: 1, parentId: '6000', balance: 0, did: '' },
    ],
  },
];

// Utility function to flatten the chart of accounts hierarchy
export const flattenChartOfAccounts = (accounts: any[], level = 0): Array<{ id: string; code: string; name: string; type: string; level: number; displayName: string }> => {
  const flattened: Array<{ id: string; code: string; name: string; type: string; level: number; displayName: string }> = [];
  
  accounts.forEach(account => {
    const indent = '  '.repeat(level);
    const displayName = `${indent}${account.code} - ${account.name}`;
    
    flattened.push({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      level: account.level,
      displayName: displayName
    });
    
    if (account.children && account.children.length > 0) {
      flattened.push(...flattenChartOfAccounts(account.children, level + 1));
    }
  });
  
  return flattened;
};

// Pre-computed flattened options for dropdowns
export const COA_OPTIONS = flattenChartOfAccounts(CHART_OF_ACCOUNTS); 