import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import { WagmiProvider, useAccount, useConnect, useWalletClient } from 'wagmi';

import detectEthereumProvider from '@metamask/detect-provider';

import { Typography, Card, Button, Box, Paper } from "@mui/material";
import BusinessIcon from '@mui/icons-material/Business';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { useNavigate } from "react-router-dom";
import { BuildingOfficeIcon, WalletIcon, ArrowRightCircleIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, ETHERSCAN_URL, BUNDLER_URL, PAYMASTER_URL} from "../config";

interface HomePageProps {
  className: string;
}





const HomePage: React.FC<HomePageProps> = ({className}) => {

  const navigate = useNavigate();
  const { data: walletClient } = useWalletClient();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  const { selectedSignatory, signatory, connect, isIndividualConnected, orgDid, indivDid } = useWallectConnectContext();
  const { isConnected } = useAccount();

  

  useEffect(() => {

    const detectProvider = async () => {
      const provider = await detectEthereumProvider();

      setHasProvider(Boolean(provider));
    };
    detectProvider();
  }, []);

  useEffect(() => {
    // if wallet is defined and we have not defined smart wallet
    if (isConnected && isIndividualConnected && orgDid && indivDid && !location.pathname.startsWith('/readme')) {
      navigate('/chat/')
    } else  {
      //console.info("...... error")
    }
  }, [isConnected, isIndividualConnected, orgDid, indivDid]);

  const handleConnect = async () => {
    try {
      if (selectedSignatory) {
        const loginResp = await selectedSignatory.login()
        if (loginResp && loginResp.signatory && loginResp.owner) {
          await connect(loginResp.owner, loginResp.signatory, "", "", "")
        }

      }

      //if (walletAuthRef.current) {
      //  walletAuthRef.current.openWalletPopup()
      //}
    } catch (error: any) {

      if (error.message === "Signatory not configured") {
        // Handle this specific error with a user-friendly message
        alert("Please configure your wallet signatory before connecting.");
      } else if (error.message.startsWith("Unrecognized chain ID")) {

        const params = {
          //chainId: '0xa', // 0xa is hexadecimal for 10
          //chainName: 'Optimism',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [ETHERSCAN_URL],
        };

        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
        } catch (error) {
        }

        if (selectedSignatory) {
          const loginResp = await selectedSignatory.login()
          console.info("........ response from login: ", loginResp)
          if (loginResp) {
            await connect(loginResp.owner, loginResp.signatory, "", "", "")
          }
        }

        //alert("Please go to metamask extension and add Optimism");
      } else {
        // Generic error fallback
        alert("An error occurred " + error.message);
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
        bgcolor: 'white',
        flexDirection: 'column',
        p: 2,
        gap: 4
      }}
    >

      {/* Wallet & About Us Container */}

      {/* <Box
        sx={{
          bgcolor: 'background.default',
          height: '250px',
          width: '100%',
          maxWidth: 800,
          padding: '20px',
          boxShadow: 3,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          justifyContent: 'center',
          alignItems: 'center',
          p: 3
        }}
      >

        <WalletIcon className="organization-icon" stroke="#2563EB" />

        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
          Wallet
        </Typography>

        <Typography variant="subtitle2" color="var(--dark-gray-7)">
          Create individual and organizational smart wallets.
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
            About Us
          </Button>
        </Box>
      </Box> */}

      {/* Currently Being Edited */}

      <Box
        sx={{
          maxWidth: 800,
          width: '100%',
          height: '250px',
          p: 3,
          boxShadow: 3,
          borderRadius: 2,
          display: 'flex',
          gap: 3,
          justifyContent: 'center',
        }}
      >

        {/* Wallet */}

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >

          <WalletIcon className="organization-icon" stroke="#2563EB" />

          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            Wallet
          </Typography>

          <Typography variant="subtitle2" color="var(--dark-gray-7)">
            Create individual and organizational smart wallets.
          </Typography>

          <Button className="solid" variant="contained" size="large" onClick={handleWelcome}>
            Get Started
          </Button>
        </Box>

        {/* About Us */}

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >

          <UserGroupIcon className="organization-icon" stroke="#2563EB" />

          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            About Us
          </Typography>

          <Typography variant="subtitle2" color="var(--dark-gray-7)">
            Learn more about who we are and what we do.
          </Typography>

          <Button className="outlined" variant="outlined" size="large" onClick={handleLearnMore}>
             About Us
          </Button>
        </Box>
      </Box>

      {/* Log In & Organizations/Leaders Container */}

      <Box
        sx={{
          maxWidth: 800,
          width: '100%',
          height: '250px',
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
            justifyContent: 'center',
            gap: 2,
          }}
        >

          <ArrowRightCircleIcon className="organization-icon" stroke="#2563EB" />

          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            Log In
          </Typography>

          <Typography variant="subtitle2" color="var(--dark-gray-7)">
            Connect to your Externally Owned Account (EOA).
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
            justifyContent: 'center',
            gap: 2,
          }}
        >

          <BuildingOfficeIcon className="organization-icon" stroke="#2563EB" />

          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>
            Organizations
          </Typography>

          <Typography variant="subtitle2" color="var(--dark-gray-7)">
            View all organizational and individual smart wallets.
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