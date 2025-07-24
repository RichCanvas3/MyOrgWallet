import React, {useContext, useEffect, useRef, useState} from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography, Box, Button } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import UserSettingsModal from './UserSettingsModal';
import SettingsIcon from "@mui/icons-material/Settings";
import { useWallectConnectContext } from "../context/walletConnectContext";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';






interface HeaderProps {
  className: string;
}

const Header: React.FC<HeaderProps> = ({className}) => {

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const { orgName, indivName, signatory, selectedSignatoryFactoryName, selectedSignatoryFactory } = useWallectConnectContext();


  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const disconnect = async () => {
    try {
      console.info("************* disconnect inside: signatory: ", signatory)
      
      // Use the signatory factory's logout method if available
      console.info("************* selectedSignatoryFactoryName: ", selectedSignatoryFactoryName);
      console.info("************* selectedSignatoryFactory: ", selectedSignatoryFactory);
      console.info("************* selectedSignatoryFactory.canLogout(): ", selectedSignatoryFactory?.canLogout());
      console.info("************* selectedSignatoryFactory.logout: ", selectedSignatoryFactory?.logout);
      
      if (selectedSignatoryFactory && selectedSignatoryFactory.canLogout() && selectedSignatoryFactory.logout) {
        console.info("************* calling signatory factory logout")
        await selectedSignatoryFactory.logout();
      } else {

        /*
        console.info("************* signatory factory logout not available, falling back to direct methods")
        
        // Fallback to direct methods
        if (selectedSignatoryFactoryName === 'web3AuthSignatoryFactory') {
          console.info("************* web3AuthSignatoryFactory logout")
          await Web3AuthService.disconnect();
        }
        */
      }
      
      /*
      // For MetaMask, also call wagmi disconnect
      if (selectedSignatoryFactoryName === 'injectedProviderSignatoryFactory') {
        console.info("************* injectedProviderSignatoryFactory disconnect")
        wagmiDisconnect();
      }
        */
      
      // Clear the selected signatory factory
      
      disconnect();
      
      // Navigate back to home
      navigate('/');
      
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const handleWallet = () => {
    navigate('/chat/')
  };

  const handleOrganizations = () => {
    navigate('/organizations/')
  };

  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);

  const openSettingsDialog = () => {
    setSettingsModalVisible(true);
  }

  const handleOnSettingsModalClose = () => {
    setSettingsModalVisible(false);
  }


  return (
    <AppBar position="static" className={`app-bar ${className}`}>
  <UserSettingsModal
    isVisible={isSettingsModalVisible}
    onClose={handleOnSettingsModalClose}
  />
  <Toolbar className="toolbar" sx={{
    backgroundColor: '#2563EB'
  }}>
    <div className="logo-container">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        {/*<img src={myOrgWalletLogo} alt="myOrgWallet Logo" className="logo" />*/}
        <Typography variant="h6" className="title" sx={{
          fontWeight: 'bold'
        }}>
          MyOrgWallet
        </Typography>
      </Link>
    </div>
    <div className="actions-container">

    {signatory && (
      <>
      <div className="profile-box">
        <Typography variant="subtitle2" className="profile-text">
          {orgName}
        </Typography>
      </div>
      <div className="profile-box">
        <Typography variant="subtitle2" className="profile-text">
          {indivName}
        </Typography>
      </div>
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disconnect"
      >
        Disconnect Wallet
      </button>
      <IconButton
        aria-label="settings"
        onClick={openSettingsDialog}
        className="icon-button"
      >
        <SettingsIcon />
      </IconButton>
      </>)}


      <IconButton
        edge="end"
        onClick={handleMenuOpen}
        className="icon-button"
      >
        <MenuIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        classes={{ paper: 'menu' }}
      >
        <MenuItem onClick={handleWallet} className="menu-item">
          Wallet
        </MenuItem>
        <MenuItem onClick={handleOrganizations} className="menu-item">
          Organizations
        </MenuItem>
      </Menu>
    </div>
  </Toolbar>
</AppBar>
  );
};

export default Header;
