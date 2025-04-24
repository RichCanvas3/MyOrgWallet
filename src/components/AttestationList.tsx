import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {MagnifyingGlassIcon} from "@heroicons/react/24/outline";
import {Attestation, OrgAttestation, SocialAttestation, RegisteredDomainAttestation} from '../models/Attestation';


import AttestationService, {
  AttestationChangeEvent,
  attestationsEmitter
} from "../service/AttestationService";
import {iconProps} from "../svg";
import {useTranslation} from "react-i18next";
import {UserContext} from "../UserContext";
import AttestationListItem from './AttestationListItem';
import { isExecutionPatchInitialResult } from '@apollo/client/utilities';



//function useCurrentPath() {
//  return useLocation().pathname;
//}

interface AttestationListProps {
  orgDid: string | undefined;
  onSelectAttestation: (attestation: Attestation) => void;
}


const AttestationList: React.FC<AttestationListProps> = ({ orgDid, onSelectAttestation }) => {
  const {t} = useTranslation();
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [categories, setCategories] = useState<AttestationCategory[]>([]);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const { userSettings } = useContext(UserContext);
  

  useEffect(() => {
    if (orgDid) {
      //console.info("... load attestations: ", orgDid)
      loadAttestationCategories();
      loadAttestations(orgDid);
    }
    
    attestationsEmitter.on('attestationChangeEvent', handleAttestationChange);

    return () => {
      attestationsEmitter.off('attestationChangeEvent', handleAttestationChange);
    };

  }, [orgDid]);


  const loadAttestationCategories = async () => {

    AttestationService.loadAttestationCategories().then(attestationCategories => {
      setCategories(attestationCategories);
    }).catch(error => {
      console.error("Error loading attestations:", error);
    });

  };
  const loadAttestations = async (orgDid: string) => {

    AttestationService.loadRecentAttestationsTitleOnly(orgDid).then(attestations => {
      setAttestations(attestations);
    }).catch(error => {
      console.error("Error loading attestations:", error);
    });

  };

  const handleAttestationChange = (event: AttestationChangeEvent) => {

    if (event.action === 'add') {
      const attestation = event.attestation!;

      let foundAttestation : Attestation | undefined;
      for (const attestation of attestations) {
        if (attestation.entityId == event.entityId) {
          foundAttestation = attestation
          break
        }
      }
      
      if (foundAttestation == undefined) {
        setAttestations(prevAttestations => [attestation, ...prevAttestations]);
      }

      setSelectedEntityId(attestation.entityId);

      if (scrollContainerRef.current) {
        if ("scrollTop" in scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    } 
    else if (event.action === "delete-all") {
      setSelectedEntityId("")
      setAttestations([])
    }
    

  };


  const handleSearch = async (searchString: string) => {
    if (orgDid) {
      loadAttestations(orgDid);
      return;
    }
    searchString = searchString.trim();
    // Check if searchString starts with 'in:attestation'
    if (searchString.toLowerCase().startsWith('in:attestation')) {
      const actualSearchString = searchString.substring('in:attestation'.length).trim();
      if (actualSearchString === '') {
        // Handle the case where there might be no actual search term provided after 'in:attestation'
        setAttestations([]); // or however you wish to handle this case.
        return;
      }
      try {
        const foundAttestations = await AttestationService.searchWithinAttestations(actualSearchString);
        // Assuming you do NOT want to modify the messages in this case, as you're searching within them
        setAttestations(foundAttestations);
      } catch (error) {
        console.error("Error during search within attestations:", error);
      }
    } else {
      // Original search logic for searching by attestation title
      try {
        const foundAttestations = await AttestationService.searchAttestationsByTitle(searchString);
        const modifiedAttestations = foundAttestations.map(attestation => ({
          ...attestation,
          messages: "[]" // Assuming overwriting messages or handling differently was intentional
        }));
        setAttestations(modifiedAttestations);
      } catch (error) {
        console.error("Error during title search:", error);
      }
    }
  };


  const AttestationListItemMemo = React.memo(AttestationListItem);

  return (

    <div className="attestation-list-container">
      <div id="attestation-search" className="search-container">
        <input
          id="attestationSearchInput"
          className="search-input"
          type="text"
          autoComplete="off"
          placeholder={t('search')}
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
        id="attestation-list"
        ref={scrollContainerRef}
        className="list-container"
      >
        <div className="list-content">
          <div className="attestation-list">
            <ol>
              {attestations.map((attestation, index) => (
                <AttestationListItemMemo
                  key={attestation.entityId}
                  attestation={attestation}
                  isSelected={selectedEntityId === attestation.entityId}
                  onSelectAttestation={onSelectAttestation}
                  forceLightTheme={true}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>

  );
};

export default AttestationList;
