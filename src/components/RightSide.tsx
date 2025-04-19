import * as React from 'react';
import { useEffect, useState } from "react";
import {Link, useNavigate} from 'react-router-dom';
import {Cog8ToothIcon, PlusIcon, Squares2X2Icon} from "@heroicons/react/24/outline";
import {CloseSideBarIcon, iconProps, OpenSideBarIcon} from "../svg";
import {useTranslation} from 'react-i18next';
import Tooltip from "./Tooltip";

import AttestationList from "./AttestationList";
import { Attestation } from "../models/Attestation"
import { Command } from "../models/Command"

import { useWallectConnectContext } from "../context/walletConnectContext";

interface RightSideProps {
  className: string;
  appCommand: (cmd: Command) => void;
}

const RightSide: React.FC<RightSideProps> = ({className, appCommand}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();

  const { orgDid } = useWallectConnectContext();

  const [profileData, setProfileData] = useState<{
    companyName: string | null;
    fullName: string | null;
  }>({
    companyName: null,
    fullName: null,
  });



  const handleSelectAttestation = (att: Attestation) => {
    const cmd : Command = {
                    action: "edit",
                    orgDid: att.attester,
                    entityId: att.entityId,
                  }
    appCommand(cmd)
    
  };

  useEffect(() => {
    // For demo, set static data; replace with fetchLinkedInData() for real use
    setProfileData({ companyName: "Example Corp" , fullName: "John Doe" });
  }, []);

  return (
        <div className={`${className} `}>
        
          <div className="scrollbar-trigger relative flex-1 items-start border-white/20">
            <h2 className="sr-only">Attestation history</h2>
            <nav className="flex flex-col p-2" aria-label="Attestation history">
              <AttestationList orgDid={orgDid} onSelectAttestation={handleSelectAttestation}/>
            </nav>
          </div>
      </div>
  )

}

export default RightSide;
