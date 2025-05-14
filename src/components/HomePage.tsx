import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { WagmiProvider, useAccount, useConnect, useWalletClient } from 'wagmi';

import { Typography, Card, Button, Box, Paper } from "@mui/material";

import { useWallectConnectContext } from "../context/walletConnectContext";

import { useNavigate } from "react-router-dom";

interface HomePageProps {
  className: string;
}





const HomePage: React.FC<HomePageProps> = ({className}) => {

  const navigate = useNavigate();
  const { data: walletClient } = useWalletClient();


  const { selectedSignatory, signatory, connect, isIndividualConnected } = useWallectConnectContext();
  const { isConnected } = useAccount();

  useEffect(() => {
    console.info("check if going to chat: ", isConnected, isIndividualConnected)
    // if wallet is defined and we have not defined smart wallet
    if (isConnected && isIndividualConnected && !location.pathname.startsWith('/readme')) {
      console.info(".......... navigate to chat")
      navigate('/chat/')
    } else  {
      //console.info("...... error")
    }
  }, [isConnected, isIndividualConnected]);

  const handleConnect = async () => {
    try {
      if (selectedSignatory) {
        const loginResp = await selectedSignatory.login()
        if (loginResp) {
          await connect(loginResp.owner, loginResp.signatory, "", "", "")
        }
        
      }

      //if (walletAuthRef.current) {
      //  walletAuthRef.current.openWalletPopup()
      //}
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const handleWelcome = async () => {
    try {
      navigate("/welcome")
    } catch (error) {
      
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

    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      {/* Top Right Sign In */}
      <Box
        sx={{
          top: '96px',      // increased spacing (~1 inch)
          right: '96px',    // increased spacing (~1 inch)
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="subtitle1" color="text.secondary">
          Sign in:
        </Typography>
        <Button variant="contained" size="small" onClick={handleConnect}>
          Connect Wallet
        </Button>
      </Box>

      <Card
        sx={{
          maxWidth: 800,
          width: '100%',
          p: 3,
          boxShadow: 3,
          borderRadius: 2,
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
        }}
      >
        {/* Wallet Card */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.primary">
            Wallet
          </Typography>
          <Button variant="contained" size="medium" onClick={handleWelcome}>
            Let's Get Started
          </Button>
        </Box>

        {/* Organization Card */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.primary">
            Organizations & Leaders
          </Typography>
          <Button variant="outlined" size="medium" onClick={handleOrg}>
             Explorer
          </Button>
        </Box>

      </Card>
    </Box>

    
  );
};

export default HomePage;