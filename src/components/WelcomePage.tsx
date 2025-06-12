import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';

import {useNavigate} from 'react-router-dom';

//import { WalletAuthRef } from "./WalletAuth"
import { Organization } from "../models/Organization"
import AttestationService, { attestationsEmitter } from "../service/AttestationService";
import { Attestation } from "../models/Attestation"

import { useWallectConnectContext } from "../context/walletConnectContext";
import { Command } from "../models/Command"
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";

import WelcomeModal from './WelcomeModal';

import { useAccount } from 'wagmi';

import '../custom_styles.css'

import { type Chain } from 'viem'

interface WelcomePageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}


const WelcomePage: React.FC<WelcomePageProps> = ({className, appCommand}) => {

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchInputValue, setSearchInputValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showSearchOptions, setShowSearchOptions] = useState(false);

    const [orgDid, setOrgDid] = useState<string>();

    const { chain } = useAccount();

    const encoder = new TextEncoder();

    const [refreshAttestations, setRefreshAttestations] = useState(0);

    useEffect(() => {
      loadOrganizations(chain);
    }, []);

    useEffect(() => {
        loadOrganizations(chain);
      }, [ orgDid ]);



    useEffect(() => {
      //const sortedOrganizations = [...organizations];  // Sort by timestamp if not already sorted
      //const sortedOrganizations = [...organizations].sort((a, b) => b.name - a.name);  // Sort by timestamp if not already sorted
    }, [organizations]);


    const onSelectOrganization = async(orgDid: string) => {
        setOrgDid(orgDid)
    }



    const onSelectAttestation = async(att: Attestation) => {
      const cmd : Command = {
                      action: "show",
                      did: att.attester,
                      entityId: att.entityId,
                    }
      appCommand(cmd)


    }

    const loadOrganizations = async (chain: Chain | undefined) => {
        if (!chain) return;
        const organizations = await AttestationService.loadOrganizations(chain)
        setOrganizations(organizations);
    };

    const handleSearch = async (searchString: string) => {
      console.info("hello world")
    }


    return (
      <div className="custom welcome-page flex">
        <WelcomeModal />
      </div>
    );
};

export default WelcomePage;