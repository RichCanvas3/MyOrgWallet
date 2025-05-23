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
        console.info("........ selected signatory login ....... ")
        const loginResp = await selectedSignatory.login()
        console.info("........ response from login: ", loginResp)
        if (loginResp) {
          await connect(loginResp.owner, loginResp.signatory, "", "", "")
        }

      }

      //if (walletAuthRef.current) {
      //  walletAuthRef.current.openWalletPopup()
      //}
    } catch (error) {

      if (error.message === "Signatory not configured") {
        // Handle this specific error with a user-friendly message
        alert("Please configure your wallet signatory before connecting.");
      } else {
        // Generic error fallback
        alert("An error occurred while connecting your wallet.");
      }
    }
  };

  const handleWelcome = async () => {
    try {
      navigate("/welcome")
    } catch (error) {
      console.error("Welcome Page Connection Failed: ", error)
    }
  };

  const handleLearnMore = async () => {
    try {
      navigate("/aboutus")
    } catch (error) {
      console.error("About Us Page Connection Failed: ", error)
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
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        flexDirection: 'column',
        p: 2,
        gap: 4
      }}
    >

      {/* Wallet */}

      <Box
        sx={{
          bgcolor: 'background.default',
          padding: '20px',
          boxShadow: 3,
          borderRadius: 2,
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

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button className="solid" variant="contained" size="large" onClick={handleWelcome}>
            Get Started
          </Button>

          <Button className="outlined" variant="outlined" size="large" onClick={handleLearnMore}>
            Learn More
          </Button>
        </Box>
      </Box>

      <Box
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

        {/* Log In */}

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

          <Button className="connect" variant="contained" size="large" onClick={handleConnect} sx={{backgroundColor: '#48ba2f'}}>
            Connect Wallet
          </Button>
        </Box>

        {/* Organizations and Leaders */}

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

          <Button className="outlined" variant="outlined" size="large" onClick={handleOrg}>
             View All
          </Button>
        </Box>
      </Box>

    </Box>

  );
};

export default HomePage;