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
          bgcolor: 'background.default',
          padding: '20px',
          boxShadow: 3,
          borderRadius: 2,
          top: '130px',      // increased spacing (~1 inch)
          right: 'center',    // increased spacing (~1 inch)
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >

        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
          Wallet
        </Typography>

        <Typography variant="subtitle2" color="var(--dark-gray-7)">
          Create your individual and organizational smart wallets.
        </Typography>

        <Button variant="contained" size="large" onClick={handleWelcome}>
          Get Started
        </Button>
      </Box>

      <Card
        sx={{
          maxWidth: 700,
          width: '100%',
          p: 3,
          boxShadow: 3,
          borderRadius: 2,
          display: 'flex',
          gap: 3,
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

          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            Log In
          </Typography>

          <Typography variant="subtitle2" color="var(--dark-gray-7)">
            Connect to your externally owned account (EOA).
          </Typography>

          <Button variant="contained" size="large" onClick={handleConnect} sx={{backgroundColor: '#48ba2f'}}>
            Connect Wallet
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
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            Organizations & Leaders
          </Typography>

         <Typography variant="subtitle2" color="var(--dark-gray-7)">
            View smart wallets on the chain.
          </Typography>

          <Button variant="outlined" size="large" onClick={handleOrg}>
             View All
          </Button>
        </Box>

      </Card>
    </Box>


  );
};

export default HomePage;