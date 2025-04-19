
import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { useAppKit, useAppKitEvents, useAppKitState, useDisconnect } from "@reown/appkit/react";

import { WagmiProvider, useAccount, useConnect, useWalletClient } from 'wagmi';
import { useWallectConnectContext } from "../context/walletConnectContext";

import ProfileService, {
    Profile,
    ProfileChangeEvent,
    profileEmitter
  } from "../service/ProfileService";


const CompanyUserPanel: React.FC = () => {

    const [profile, setProfile] = useState<Profile | null>(null);

    const handleProfileChange = (event: ProfileChangeEvent) => {
        console.info("....... ok set profile")
        let prof = event.profile ? event.profile : null
        setProfile(prof)
    }

    useEffect(() => {
        ProfileService.getProfile().then((profile) => {
            let prof = profile ? profile : null
            setProfile(prof)
        })

        profileEmitter.on('profileChangeEvent', handleProfileChange);
    
        return () => {
            profileEmitter.off('profileChangeEvent', handleProfileChange);
        };

    }, []);

 

  return (

    <div className="panel">
      <h2>Company</h2>
      <div className="panel-content">
        <div className="field">
            <span>{profile?.companyName ?? "Not provided"}</span>
        </div>
        <div className="field">
          <span>{profile?.website ?? "Not provided"}</span>
        </div>
      </div>
      <h2>Owner</h2>
      <div className="panel-content">
        <div className="field">
          <span>{profile?.fullName ?? "Not provided"}</span>
        </div>

        <div className="field">
          <span>{profile?.email ?? "Not provided"}</span>
        </div>
      </div>
        
      </div>
      

  );
};

export default CompanyUserPanel;