import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';

import { Typography, Button, Box, Paper } from "@mui/material";


import WalletAuth, { WalletAuthRef } from './WalletAuth';
import { useNavigate } from "react-router-dom";

interface HomePageProps {
  className: string;
}





const HomePage: React.FC<HomePageProps> = ({className}) => {

  const walletAuthRef = { current: null as WalletAuthRef | null };
  const handleConnect = async () => {
    try {
      if (walletAuthRef.current) {
        walletAuthRef.current.openWalletPopup()
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const navigate = useNavigate();
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
        <WalletAuth ref={walletAuthRef} />
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