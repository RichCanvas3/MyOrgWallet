import * as React from 'react';
import { useEffect, useState } from "react";
import {Link, useNavigate} from 'react-router-dom';
import {Cog8ToothIcon, PlusIcon, Squares2X2Icon} from "@heroicons/react/24/outline";
import {CloseSideBarIcon, iconProps, OpenSideBarIcon} from "../svg";
import {useTranslation} from 'react-i18next';
import Tooltip from "./Tooltip";

import MainSection from "./MainSection";
import { Attestation } from "../models/Attestation"
import { Account } from "../models/Account"
import { Command } from "../models/Command"

import { useWallectConnectContext } from "../context/walletConnectContext";

interface RightSideProps {
  className: string;
  appCommand: (cmd: Command) => void;
  onRefreshAttestations?: () => void;
  onRefreshAccounts?: () => void;
}

const RightSide: React.FC<RightSideProps> = ({className, appCommand, onRefreshAttestations, onRefreshAccounts}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();

  const { orgDid, indivDid } = useWallectConnectContext();

  const [profileData, setProfileData] = useState<{
    companyName: string | null;
    fullName: string | null;
  }>({
    companyName: null,
    fullName: null,
  });

  const handleSelectAttestation = (att: Attestation) => {
    console.log("************ att: ", att)
    const cmd : Command = {
      action: "edit",
      did: att.attester,
      entityId: att.entityId,
      displayName: att.displayName,
    }
    appCommand(cmd)
  };

  const handleSelectAccount = (account: Account) => {
    // TODO: Implement account selection handling
    console.log('Selected account:', account);
  };

  useEffect(() => {
    // For demo, set static data; replace with fetchLinkedInData() for real use
    setProfileData({ companyName: "Example Corp" , fullName: "John Doe" });
  }, []);

  return (
    <div className={`${className}`}>
      <div className="scrollbar-trigger relative flex-1 items-start border-white/20">
        <h2 className="sr-only">Attestation and Account Management</h2>
        <nav className="flex flex-col p-2" aria-label="Main navigation">
          <MainSection 
            orgDid={orgDid} 
            indivDid={indivDid} 
            onSelectAttestation={handleSelectAttestation}
            onSelectAccount={handleSelectAccount}
            onRefreshAttestations={onRefreshAttestations}
            onRefreshAccounts={onRefreshAccounts}
          />
        </nav>
      </div>
    </div>
  );
};

export default RightSide;
