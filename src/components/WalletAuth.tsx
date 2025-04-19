
import * as React from 'react';
import { useImperativeHandle, forwardRef, useEffect, useRef } from 'react';

import { useState } from 'react';
import axios from 'axios';


import { ProofRecord, RequestPayload, IssuedChallenge, VerifiableCredential, VerifiableCredentialRecord } from "@gitcoinco/passport-sdk-types" ;


import { useWallectConnectContext } from "../context/walletConnectContext";


import { useAppKit, useAppKitEvents, useAppKitState, useDisconnect } from "@reown/appkit/react";
import { WagmiProvider, useAccount, useConnect, useWalletClient } from 'wagmi';

import { useNavigate } from "react-router-dom";



interface WalletProfile {
  sub: string; // LinkedIn user ID
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}


interface WalletAuthProps {
}

export interface WalletAuthRef {
  openWalletPopup: () => void;
}

export type ValidResponseBody = {
  credential: VerifiableCredential;
  record?: ProofRecord;
};
export type ErrorResponseBody = {
  error?: string;
  code?: number;
};
export type CredentialResponseBody = ValidResponseBody | ErrorResponseBody;



const WalletAuth = forwardRef<WalletAuthRef, WalletAuthProps>((props, ref) => {

  const { } = props;
  
  const { selectedSignatory, connect, orgDid } = useWallectConnectContext();


  const navigate = useNavigate();

  const { open } = useAppKit(); // Hook to control the AppKit modal
  const { connectors } = useConnect();
  const { address, isConnected } = useAccount();

  const { data: walletClient } = useWalletClient();
  const hasFiredOnce = useRef(false);


  const openWalletPopup = () => {
    console.info(">>>>>>>>>>>>>> open wallet popup")
    selectedSignatory.login().then(( owner, signatory ) => {
      console.info("owner: ", owner)
      console.info("signatory: ", signatory)
    })

    /*
    open().then(() => { // Opens the AppKit modal with X login option 
      console.info("returned from open wallet")
      console.info("connectors found: ", connectors)
      if (connectors.length > 0) {
        console.info("...... connectors: ", connectors)
        //walletConnect({ connector: connectors[1] }); // e.g., MetaMask
      }
    })
    */
  };


  // Use useImperativeHandle to expose the method to the parent
  useImperativeHandle(ref, () => ({
    openWalletPopup
  }));

  useEffect(() => {
      console.info("Wallet signed in", address);
      console.info("Wallet Client!", walletClient);
    }, [isConnected, address]);

  useEffect(() => {
    // if wallet is defined and we have not defined smart wallet
    if (walletClient) {

      console.info("WalletClient is available:", walletClient);
      if (isConnected && address && walletClient) {
        if (orgDid == undefined && !hasFiredOnce.current) {
          hasFiredOnce.current = true;
          console.info("fire connect and configure all the smart wallet stuff")
          connect(address, walletClient).then(() => {
            console.info("done with configuration of wallet so go to chat")
            navigate('/chat/')
          })
        }
      }
    } else  {
      //console.info("...... error")
    }
  }, [walletClient]);

  return (
    <div>
    </div>
  );


});

export default WalletAuth;