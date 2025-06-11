export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
  children?: Account[];
  parentId?: string;
  level: number;
}

export interface AccountCategory {
  id: string;
  name: string;
  accounts: Account[];
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | 'Income' | 'COGS';

export const ACCOUNT_TYPES: Record<AccountType, AccountType> = {
  Asset: 'Asset',
  Liability: 'Liability',
  Equity: 'Equity',
  Revenue: 'Revenue',
  Expense: 'Expense',
  Income: 'Income',
  COGS: 'COGS',
}; 