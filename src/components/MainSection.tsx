import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import AttestationSection from './AttestationSection';
import ChartOfAccountsSection from './ChartOfAccountsSection';
import { Attestation } from '../models/Attestation';
import { Account } from '../models/Account';

interface MainSectionProps {
  orgDid?: string;
  indivDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
  onSelectAccount?: (account: Account) => void;
  onRefreshAttestations?: () => void;
  onRefreshAccounts?: () => void;
}

const MainSection: React.FC<MainSectionProps> = ({
  orgDid,
  indivDid,
  onSelectAttestation,
  onSelectAccount,
  onRefreshAttestations,
  onRefreshAccounts,
}) => {
  const [currentView, setCurrentView] = useState<'attestations' | 'accounts'>('attestations');

  const handleChange = (_: React.SyntheticEvent, newValue: 'attestations' | 'accounts') => {
    setCurrentView(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={currentView}
          onChange={handleChange}
          aria-label="main section tabs"
        >
          <Tab 
            label="Attestations" 
            value="attestations"
            id="attestations-tab"
            aria-controls="attestations-panel"
          />
          <Tab 
            label="Chart of Accounts" 
            value="accounts"
            id="accounts-tab"
            aria-controls="accounts-panel"
          />
        </Tabs>
      </Box>

      <Box
        role="tabpanel"
        hidden={currentView !== 'attestations'}
        id="attestations-panel"
        aria-labelledby="attestations-tab"
      >
        {currentView === 'attestations' && (
          <AttestationSection
            orgDid={orgDid}
            indivDid={indivDid}
            onSelectAttestation={onSelectAttestation}
            onRefreshAttestations={onRefreshAttestations}
          />
        )}
      </Box>

      <Box
        role="tabpanel"
        hidden={currentView !== 'accounts'}
        id="accounts-panel"
        aria-labelledby="accounts-tab"
      >
        {currentView === 'accounts' && (
          <ChartOfAccountsSection
            onSelectAccount={onSelectAccount}
            onRefreshAccounts={onRefreshAccounts}
          />
        )}
      </Box>
    </Box>
  );
};

export default MainSection; 