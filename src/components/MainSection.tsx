import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import AttestationSection from './AttestationSection';
import ChartOfAccountsSection from './ChartOfAccountsSection';
import TrustScoreSection from './TrustScoreSection';
import { Attestation } from '../models/Attestation';
import { Account } from '../models/Account';
import { Entity } from '../models/Entity';

interface MainSectionProps {
  orgDid?: string;
  indivDid?: string;
  onSelectAttestation: (attestation: Attestation) => void;
  onSelectAccount?: (account: Account) => void;
  onRefreshAttestations?: () => void;
  onRefreshAccounts?: () => void;
  entities?: Entity[];
  onUnSkipEntity?: (entityName: string) => void;
}

const MainSection: React.FC<MainSectionProps> = ({
  orgDid,
  indivDid,
  onSelectAttestation,
  onSelectAccount,
  onRefreshAttestations,
  onRefreshAccounts,
  entities,
  onUnSkipEntity
}) => {
  const [currentView, setCurrentView] = useState<'attestations' | 'accounts' | 'trustscore'>('attestations');

  const handleChange = (_: React.SyntheticEvent, newValue: 'attestations' | 'accounts' | 'trustscore') => {
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
          <Tab
            label="Trust Score"
            value="trustscore"
            id="trustscore-tab"
            aria-controls="trustscore-panel"
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
            entities={entities}
            onUnSkipEntity={onUnSkipEntity}
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

      <Box
        role="tabpanel"
        hidden={currentView !== 'trustscore'}
        id="trustscore-panel"
        aria-labelledby="trustscore-tab"
      >
        {currentView === 'trustscore' && (
          <TrustScoreSection
            orgDid={orgDid}
            indivDid={indivDid}
          />
        )}
      </Box>
    </Box>
  );
};

export default MainSection;