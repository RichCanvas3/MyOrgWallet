import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';

import {useNavigate} from 'react-router-dom';

import { useAccount } from 'wagmi';
import { Organization } from "../models/Organization"
import AttestationService, { attestationsEmitter } from "../service/AttestationService";
import { Attestation } from "../models/Attestation"

import { useWallectConnectContext } from "../context/walletConnectContext";
import { Command } from "../models/Command"
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";

import SetupSmartWalletModal from './SetupSmartWalletModal';

import '../custom_styles.css'

interface SetupSmartWalletPageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}


const SetupSmartWalletPage: React.FC<SetupSmartWalletPageProps> = ({className, appCommand}) => {

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchInputValue, setSearchInputValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showSearchOptions, setShowSearchOptions] = useState(false);

    const [orgDid, setOrgDid] = useState<string>();

    const encoder = new TextEncoder();

    const [refreshAttestations, setRefreshAttestations] = useState(0);

    const { chain } = useAccount();

    useEffect(() => {
      loadOrganizations();
    }, []);

    useEffect(() => {
        loadOrganizations();
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

    const loadOrganizations = async () => {
      if (chain) {
        AttestationService.loadOrganizations(chain).then(organizations => {
                setOrganizations(organizations);
            }).catch(error => {
                console.error("Error loading organizations:", error);
            });
        };
      }

    const handleSearch = async (searchString: string) => {
      console.info("hello world")
    }


    return (
      <div className="custom onboarding-page flex">
        <SetupSmartWalletModal />
      </div>
    );
};

export default SetupSmartWalletPage;