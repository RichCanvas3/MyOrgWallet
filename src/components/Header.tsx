import React, {useContext, useEffect, useRef, useState} from 'react';
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography, Box, Button } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import UserSettingsModal from './UserSettingsModal';
import SettingsIcon from "@mui/icons-material/Settings";
import { useWallectConnectContext } from "../context/walletConnectContext";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {useConfirmDialog} from './ConfirmDialog';
import {NotificationService} from "../service/NotificationService";
import AttestationService from "../service/AttestationService";






interface HeaderProps {
  className: string;
}

const Header: React.FC<HeaderProps> = ({className}) => {

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const {showConfirmDialog, ConfirmDialog, isOpen} = useConfirmDialog();

  const { orgName, indivName, signatory, selectedSignatoryFactoryName, disconnect, orgDid, indivDid, chain, orgIndivDelegation, orgBurnerDelegation, indivBurnerDelegation, burnerAccountClient } = useWallectConnectContext();


  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const disconnectWallet = async () => {
    try {
      console.info("************* disconnect inside: signatory: ", signatory)
      console.info("************* selectedSignatoryFactoryName: ", selectedSignatoryFactoryName);
      
      // The disconnect function in the context will handle the signatory factory logout
      disconnect();
      
      // Navigate back to home
      navigate('/');
      
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const handleWallet = () => {
    console.info("************* navigating to chat 5")
    //navigate('/chat/')
  };

  const handleOrganizations = () => {
    navigate('/organizations/')
  };

  const handleClearStorage = () => {
    showConfirmDialog({
      message: 'Are you sure you want to clear all local storage? This action cannot be undone.',
      confirmText: 'Clear',
      confirmButtonVariant: 'critical',
      onConfirm: () => {
        localStorage.clear();
        console.info("clear all local storage");
        NotificationService.handleSuccess("All local storage has been successfully cleared.");
      },
    });
  };

  const handleDeleteAllAttestations = async () => {
    showConfirmDialog({
      message: 'Are you sure you want to delete all attestations? This action cannot be undone.',
      confirmText: 'Delete',
      confirmButtonVariant: 'critical',
      onConfirm: async () => {
        try {
          console.info("inside delete all attestations")
          console.info("orgDid: ", orgDid)
          console.info("indivDid: ", indivDid)
          console.info("chain: ", chain)
          console.info("burnerAccountClient: ", burnerAccountClient)

          // Delete organization attestations
          if (orgDid && chain && orgIndivDelegation && orgBurnerDelegation && indivBurnerDelegation && burnerAccountClient) {
            console.info("delete org attestations")
            const orgAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, orgDid, "")
            if (orgAttestations && orgAttestations.length > 0) {
              console.info("signer a: ", signatory)
              const walletSigner = signatory.signer
              const rslt = await AttestationService.deleteAttestations(chain, orgAttestations, walletSigner, [orgBurnerDelegation, orgIndivDelegation], burnerAccountClient)
              console.info("delete organization attestations is done ", rslt)
            }
          }

          // Delete individual attestations
          if (chain && indivDid && indivBurnerDelegation && burnerAccountClient) {
            console.info("delete indiv attestations")
            const indivAttestations = await AttestationService.loadRecentAttestationsTitleOnly(chain, "", indivDid)
            if (indivAttestations && indivAttestations.length > 0) {
              console.info("signer b: ", signatory)
              const walletSigner = signatory.signer
              const rsl = await AttestationService.deleteAttestations(chain, indivAttestations, walletSigner, [indivBurnerDelegation], burnerAccountClient)
              console.info("delete all individual attestations is done ")
            }
          }

          NotificationService.handleSuccess("All attestations have been successfully deleted.");
        } catch (error) {
          console.error('Failed to delete all attestations:', error);
          if (error instanceof Error) {
            NotificationService.handleUnexpectedError(error, "Failed to delete all attestations");
          } else {
            NotificationService.handleUnexpectedError(new Error('An unknown error occurred'), "Failed to delete all attestations");
          }
        }
      },
    });
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
        onClick={() => disconnectWallet()}
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
        <MenuItem onClick={handleClearStorage} className="menu-item">
          Clear Storage
        </MenuItem>
        {signatory && (
          <MenuItem onClick={handleDeleteAllAttestations} className="menu-item">
            Delete All Attestations
          </MenuItem>
        )}
      </Menu>
      {ConfirmDialog}
    </div>
  </Toolbar>
</AppBar>
  );
};

export default Header;
