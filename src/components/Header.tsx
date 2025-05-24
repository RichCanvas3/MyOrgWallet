import React, {useContext, useEffect, useRef, useState} from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography, Box, Button } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import myOrgWalletLogo from "/icon.png";
import { useDisconnect } from 'wagmi';
import UserSettingsModal from './UserSettingsModal';
import SettingsIcon from "@mui/icons-material/Settings";
import { useAccount, useWalletClient } from 'wagmi';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import ProfileService, {
  Profile,
  ProfileChangeEvent,
  profileEmitter
} from "../service/ProfileService";



const handleConnect = async () => {
    //try {
    //  if (walletAuthRef.current) {
    //    walletAuthRef.current.openWalletPopup()
    //  }
    //} catch (error) {
    //  console.error("Wallet connection failed:", error);
    //}
  };

  interface HeaderProps {
    className: string;
  }

const Header: React.FC<HeaderProps> = ({className}) => {

  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();

  const [anchorEl, setAnchorEl] = React.useState(null);

  const { orgName, indivName } = useWallectConnectContext();

    const navigate = useNavigate();

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
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

    {isConnected && (
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
