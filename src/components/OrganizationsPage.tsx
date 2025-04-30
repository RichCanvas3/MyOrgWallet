import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';

import {useNavigate} from 'react-router-dom';
import OrganizationListItem from './OrganizationListItem';
import AttestationList from "./AttestationList";

//import { WalletAuthRef } from "./WalletAuth"
import { Organization } from "../models/Organization"
import AttestationService, { attestationsEmitter } from "../service/AttestationService";
import { Attestation } from "../models/Attestation"

import { useWallectConnectContext } from "../context/walletConnectContext";
import { Command } from "../models/Command"
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";

interface OrganizationsPageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}


const OrganizationsPage: React.FC<OrganizationsPageProps> = ({className, appCommand}) => {

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [searchInputValue, setSearchInputValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [showSearchOptions, setShowSearchOptions] = useState(false);

    const [orgDid, setOrgDid] = useState<string>();

    const [refreshAttestations, setRefreshAttestations] = useState(0);

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
        AttestationService.loadOrganizations().then(organizations => {
            setOrganizations(organizations);
        }).catch(error => {
            console.error("Error loading organizations:", error);
        });
    };
    
    const handleSearch = async (searchString: string) => {
      console.info("hello world")
    }
  
    const OrganizationListItemMemo = React.memo(OrganizationListItem);
  
    return (
      <div className="organization-page flex h-screen">
        <div className="organization-list-container shrink-0">
          <div id="organization-search" className="search-container flex flex-row items-center relative">
              <input
                id="attestationSearchInput"
                className="search-input"
                type="text"
                autoComplete="off"
                placeholder={'search'}
                value={searchInputValue}
                onFocus={() => setShowSearchOptions(true)}
                onBlur={() => setTimeout(() => setShowSearchOptions(false), 200)}
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchInputValue);
                    setShowSearchOptions(false);
                  }
                }}
              />
              <button
                className="search-button"
                onClick={() => {
                  handleSearch(searchInputValue);
                  setShowSearchOptions(false);
                }}
              >
              <MagnifyingGlassIcon className="search-icon" />
            </button>
          </div>
          <div
            id="organization-list"
            ref={scrollContainerRef}
            className="flex-col flex-1 transition-opacity duration-500 -mr-2 pr-2 overflow-y-auto"
          >
            <div className="flex flex-col gap-2 pb-2 text-sm">
              <div className="relative overflow-x-hidden" style={{ height: "auto", opacity: 1 }}>
                <ol>
                  {organizations.map((organization, index) => (
                    <OrganizationListItemMemo
                      key={organization.id}
                      organization={organization}
                      isSelected={selectedId === organization.id}
                      onSelectOrganization={onSelectOrganization}
                      className="organization-list-item" /* Add class */
                    />
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="attestation-list-container flex-1 p-6 flex-1 p-6">
          <AttestationList
            key={refreshAttestations}
            orgDid={orgDid}
            onSelectAttestation={onSelectAttestation}
            className="attestation-list" /* Add class */
          />
        </div>
      </div>
      
    );
};

export default OrganizationsPage;