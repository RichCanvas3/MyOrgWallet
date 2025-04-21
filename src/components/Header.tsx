import React, {useContext, useEffect, useRef, useState} from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography, Box, Button } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import myOrgWalletLogo from "/icon.png"; 
//import { WalletAuthRef } from './WalletAuth';
import UserSettingsModal from './UserSettingsModal';
import SettingsIcon from "@mui/icons-material/Settings";

import ProfileService, {
  Profile,
  ProfileChangeEvent,
  profileEmitter
} from "../service/ProfileService";

//const walletAuthRef = { current: null as WalletAuthRef | null };

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

  const [anchorEl, setAnchorEl] = React.useState(null);

  const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        ProfileService.getProfile().then((profile) => {
            let prof = profile ? profile : null
            setProfile(prof)
        })

    }, []);
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
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
  <Toolbar className="toolbar">
    <div className="logo-container">
      <img src={myOrgWalletLogo} alt="myOrgWallet Logo" className="logo" />
      <Typography variant="h6" className="title">
        myOrgWallet
      </Typography>
    </div>
    <div className="actions-container">
      <div className="profile-box">
        <Typography variant="subtitle2" className="profile-text">
          {profile?.companyName}
        </Typography>
      </div>
      <div className="profile-box">
        <Typography variant="subtitle2" className="profile-text">
          {profile?.fullName}
        </Typography>
      </div>
      <IconButton
        aria-label="settings"
        onClick={openSettingsDialog}
        className="icon-button"
      >
        <SettingsIcon />
      </IconButton>
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
        <MenuItem onClick={handleConnect} className="menu-item">
          Wallet
        </MenuItem>
        <MenuItem onClick={handleMenuClose} className="menu-item">
          Organizations
        </MenuItem>
      </Menu>
    </div>
  </Toolbar>
</AppBar>
  );
};

export default Header;
