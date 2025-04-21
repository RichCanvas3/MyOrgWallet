import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { WagmiProvider, useAccount, useConnect, useWalletClient } from 'wagmi';

import { Typography, Button, Box, Paper } from "@mui/material";

import { useWallectConnectContext } from "../context/walletConnectContext";
//import WalletAuth, { WalletAuthRef } from './WalletAuth';
import { useNavigate } from "react-router-dom";

interface HomePageProps {
  className: string;
}





const HomePage: React.FC<HomePageProps> = ({className}) => {

  const navigate = useNavigate();
  const { data: walletClient } = useWalletClient();


  const { selectedSignatory, signatory, connect, orgAccountClient } = useWallectConnectContext();
  

  useEffect(() => {
    console.info("**************  check if selected signatory ************")

    // if wallet is defined and we have not defined smart wallet
    if (selectedSignatory) {
      console.info("**************  yes try to login ************")
      selectedSignatory.login().then(( loginResp ) => {
        console.info("owner: ", loginResp.owner)
        console.info("signatory: ", loginResp.signatory)
        connect(loginResp.owner, loginResp.signatory).then(() => {
        })
      })
    } else  {
      //console.info("...... error")
    }
  }, [walletClient]);

  useEffect(() => {
    // if wallet is defined and we have not defined smart wallet
    if (orgAccountClient) {
      console.info("**************************** navigate to chat")
      navigate('/chat/')
    } else  {
      //console.info("...... error")
    }
  }, [orgAccountClient]);

  const handleConnect = async () => {
    try {
      selectedSignatory.login().then(( loginResp ) => {
        console.info("owner: ", loginResp.owner)
        console.info("signatory: ", loginResp.signatory)
        connect(loginResp.owner, loginResp.signatory).then(() => {
        })
      })

      //if (walletAuthRef.current) {
      //  walletAuthRef.current.openWalletPopup()
      //}
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const handleOrg = async () => {
    try {
      navigate("/organizations")
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  return (

    <div className="flex flex-col items-center justify-center min-h-screen">
      <div>
      </div>
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh" gap={4}>
        <Paper elevation={3} style={{ padding: 20, borderRadius: 20, textAlign: "center", width: 300 }}>
          <Typography variant="h5" gutterBottom>Wallet</Typography>
          <Button variant="contained" color="primary" onClick={handleConnect}>Go to Wallet</Button>
        </Paper>
        <Paper elevation={3} style={{ padding: 20, borderRadius: 20, textAlign: "center", width: 300 }}>
          <Typography variant="h5" gutterBottom>Organizations</Typography>
          <Button variant="contained" color="secondary" onClick={handleOrg}>Go to Organization</Button>
        </Paper>
      </Box>

      
      
    </div>

    
  );
};

export default HomePage;