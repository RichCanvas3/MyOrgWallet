import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';

import detectEthereumProvider from '@metamask/detect-provider';

import { Typography, Card, Button, Box, Paper, CircularProgress } from "@mui/material";
import BusinessIcon from '@mui/icons-material/Business';
import { useWallectConnectContext } from "../context/walletConnectContext";

import { useNavigate } from "react-router-dom";
import { BuildingOfficeIcon, WalletIcon, ArrowRightCircleIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import {ISSUER_PRIVATE_KEY, WEB3_AUTH_NETWORK, WEB3_AUTH_CLIENT_ID, RPC_URL, ETHERSCAN_URL, BUNDLER_URL, PAYMASTER_URL} from "../config";
import { createWeb3AuthSignatoryFactory } from "../signers/web3AuthSignatoryFactory";
import { createInjectedProviderSignatoryFactory } from "../signers/injectedProviderSignatoryFactory";
import { NotificationService } from "../service/NotificationService";

interface HomePageProps {
  className: string;
}

const HomePage: React.FC<HomePageProps> = ({className}) => {

  const navigate = useNavigate();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'web3auth' | 'metamask'>('web3auth');
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);

  const { selectedSignatoryFactory, chain, connect, signatory, isIndividualConnected, orgDid, indivDid, isConnectionComplete, setSelectedSignatoryFactoryName } = useWallectConnectContext();

  useEffect(() => {
    const detectProvider = async () => {
      const provider = await detectEthereumProvider();

      setHasProvider(Boolean(provider));
    };
    detectProvider();
  }, []);

  useEffect(() => {


    // if wallet is defined and we have not defined smart wallet
    //if (isConnected && isIndividualConnected && orgDid && indivDid && !location.pathname.startsWith('/readme')) {
    if (isIndividualConnected && orgDid && indivDid && signatory) {
      setIsLoading(false); // Clear loading state when navigation happens
      setConnectionFailed(false); // Reset connection failed state
      setHasAttemptedConnection(false); // Reset connection attempt state

      // Show success message when user successfully reconnects
      NotificationService.handleSuccess("Wallet reconnected successfully! Welcome back.");

      navigate('/chat/')
    } else if (isConnectionComplete && !isIndividualConnected && hasAttemptedConnection) {
      // Connection process is complete but no accounts found, and user attempted connection
      setIsLoading(false);
      setConnectionFailed(true); // Set connection failed state
    }
  }, [isConnectionComplete, isIndividualConnected, orgDid, indivDid,  hasAttemptedConnection, signatory]);

  const handleConnect = async () => {
    setIsLoading(true);
    setHasAttemptedConnection(true); // Mark that user has attempted connection
    setConnectionFailed(false); // Reset connection failed state

    try {
      if (!chain) {
        throw new Error('Chain not available');
      }

      // Create the signatory directly based on connection method
      let signatoryToUse;
      if (connectionMethod === 'web3auth') {
        const web3AuthSignatoryFactory = createWeb3AuthSignatoryFactory({
          chain: chain,
          web3AuthClientId: WEB3_AUTH_CLIENT_ID,
          web3AuthNetwork: WEB3_AUTH_NETWORK,
          rpcUrl: RPC_URL,
        });
        signatoryToUse = web3AuthSignatoryFactory;
        setSelectedSignatoryFactoryName("web3AuthSignatoryFactory");
      } else {
        const injectedSignatoryFactory = createInjectedProviderSignatoryFactory({
          chain: chain,
          web3AuthClientId: WEB3_AUTH_CLIENT_ID,
          web3AuthNetwork: WEB3_AUTH_NETWORK,
          rpcUrl: RPC_URL,
        });
        signatoryToUse = injectedSignatoryFactory;
        setSelectedSignatoryFactoryName("injectedProviderSignatoryFactory");
      }

      if (signatoryToUse) {
        const loginResp = await signatoryToUse.login()
        if (loginResp && loginResp.signatory && loginResp.owner) {
          await connect(loginResp.owner, loginResp.signatory, "", "", "")
        }
      }

      setIsLoading(false);

    } catch (error: any) {

      /*
      if (error.message === "Signatory not configured") {
        // Handle this specific error with a user-friendly message
        alert("Please configure your wallet signatory before connecting.");
        setIsLoading(false); // Clear loading state on error
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

        if (selectedSignatoryFactory) {
          const loginResp = await selectedSignatoryFactory.login()
          console.info("........ response from login: ", loginResp)
          if (loginResp) {
            await connect(loginResp.owner, loginResp.signatory, "", "", "")
          }
        }

        //alert("Please go to metamask extension and add Optimism");
      } else {
        // Generic error fallback
        alert("An error occurred " + error.message);
        setIsLoading(false); // Clear loading state on error
      }
      */
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

          {/* Connection Method Selection */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={connectionMethod === 'web3auth' ? 'contained' : 'outlined'}
              onClick={() => setConnectionMethod('web3auth')}
              disabled={isLoading}
              size="small"
              sx={{
                flex: 1,
                backgroundColor: connectionMethod === 'web3auth' ? '#48ba2f' : 'transparent',
                color: connectionMethod === 'web3auth' ? 'white' : '#48ba2f',
                borderColor: '#48ba2f',
                '&:hover': {
                  backgroundColor: connectionMethod === 'web3auth' ? '#3a9a25' : 'rgba(72, 186, 47, 0.1)',
                  borderColor: '#3a9a25'
                }
              }}
            >
              Web3Auth
            </Button>
            <Button
              variant={connectionMethod === 'metamask' ? 'contained' : 'outlined'}
              onClick={() => setConnectionMethod('metamask')}
              disabled={isLoading}
              size="small"
              sx={{
                flex: 1,
                backgroundColor: connectionMethod === 'metamask' ? '#48ba2f' : 'transparent',
                color: connectionMethod === 'metamask' ? 'white' : '#48ba2f',
                borderColor: '#48ba2f',
                '&:hover': {
                  backgroundColor: connectionMethod === 'metamask' ? '#3a9a25' : 'rgba(72, 186, 47, 0.1)',
                  borderColor: '#3a9a25'
                }
              }}
            >
              MetaMask
            </Button>
          </Box>

          <Button className="connect" variant="contained" size="large" onClick={handleConnect} sx={{backgroundColor: '#48ba2f'}} disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} /> : `Connect with ${connectionMethod === 'web3auth' ? 'Web3Auth' : 'MetaMask'}`}
          </Button>

          {connectionFailed && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Connection failed. No existing organization found for this wallet.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/welcome/')}
                sx={{ borderColor: '#48ba2f', color: '#48ba2f', '&:hover': { borderColor: '#3a9a25', color: '#3a9a25' } }}
              >
                Get Started
              </Button>
            </Box>
          )}
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