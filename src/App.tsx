import * as React from 'react';
import {useState, useEffect, type ReactNode} from 'react';


import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {I18nextProvider} from 'react-i18next';
import i18n from './i18n';
import HomePage from "./components/HomePage";
import WelcomePage from "./components/WelcomePage";
import SetupSmartWalletPage from "./components/SetupSmartWalletPage";
import OrganizationsPage from "./components/OrganizationsPage";
import MainPage from "./components/MainPage";
import './App.css';
import {ToastContainer} from "react-toastify";
import ExploreCustomChats from "./components/ExploreCustomChats";
import CustomChatEditor from './components/CustomChatEditor';

import { WalletConnectContextProvider } from "./context/walletConnectContext"




import LinkedinCallback from './components/LinkedinCallback';
import LinkedinModal from './components/LinkedinModal';
import AttestationViewModal from './components/AttestationViewModal';

import XCallback from './components/XCallback';
import XModal from './components/XModal';

import ShopifyCallback from './components/ShopifyCallback';

import Header from "./components/Header";

import { createAppKit } from "@reown/appkit/react";
import { http, createStorage, cookieStorage } from '@wagmi/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Command } from './models/Command'

import { WagmiProvider} from 'wagmi';
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";


import {
  arbitrum,
  base,
  mainnet,
  sepolia,
  hardhat,
  optimismSepolia,
  scrollSepolia,
  polygon,
  fantom,
  optimism,
  zksync,
  linea,
  avalanche,
  scroll,
  shape,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { CommandLineIcon } from '@heroicons/react/24/outline';


const projectId = '15d710bf679b74ce2d7919bb305a9ceb';
export const networks = [optimism];



export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }), // Persist connection state
  ssr: true, // Enable server-side rendering support (useful for Next.js)
  projectId,
  networks,
  transports: {
    [mainnet.id]: http(), // Default transport, can be customized (e.g., Infura/Alchemy)
    [arbitrum.id]: http(),
  },
});

export const config = wagmiAdapter.wagmiConfig;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    },
  },
});

// const metadata = {
//   name: "RichCanvas",
//   description: "RichCanvas Auth",
//   url: "http://localhost:5173",
//   icons: [],
// };
const metadata = {
  name: "RichCanvas",
  description: "RichCanvas Auth",
  url: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  icons: [], // Add icon URLs if needed, e.g., ['/favicon.ico']
};


const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: mainnet,
  metadata,
  features: {
    analytics: true, // Optional, enables analytics
    email: true, // Enable email login
    socials: ['google', 'github'], // Optional social logins
  },
});

interface AppKitProviderProps {
  children: ReactNode;
  cookies?: string | null; // For SSR in Next.js
}


const App = () => {

  const [selectedDid, setSelectedDid] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");

  const [isLinkedinModalVisible, setLinkedinModalVisible] = useState(false);
  const [isXModalVisible, setXModalVisible] = useState(false);
  const [isAttestationViewModalVisible, setAttestationViewModalVisible] = useState(false);
  



  const appCommand = (cmd: Command) => {

    if (cmd.action == "edit" && cmd.entityId == "indiv" && cmd.did) {
      setSelectedEntityId("indiv")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "indiv" && cmd.did) {
      setSelectedEntityId("indiv")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "indiv-org" && cmd.did) {
      setSelectedEntityId("indiv-org")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "indiv-org" && cmd.did) {
      setSelectedEntityId("indiv-org")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "org" && cmd.did) {
      setSelectedEntityId("org")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "org" && cmd.did) {
      setSelectedEntityId("org")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "domain" && cmd.did) {
      setSelectedEntityId("domain")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "domain" && cmd.did) {
      setSelectedEntityId("domain")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "state-registration" && cmd.did) {
      setSelectedEntityId("state-registration")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "state-registration" && cmd.did) {
      setSelectedEntityId("state-registration")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    
    if (cmd.action == "edit" && cmd.entityId == "linkedin" && cmd.did) {
      setSelectedEntityId("linkedin")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "linkedin" && cmd.did) {
      setSelectedEntityId("linkedin")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "x" && cmd.did) {
      setSelectedEntityId("x")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "x" && cmd.did) {
      setSelectedEntityId("x")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "shopify" && cmd.did) {
      setSelectedEntityId("shopify")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "shopify" && cmd.did) {
      setSelectedEntityId(cmd.entityId)
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "insurance" && cmd.did) {
      setSelectedEntityId("insurance")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "insurance" && cmd.did) {
      setSelectedEntityId(cmd.entityId)
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "website" && cmd.did) {
      setSelectedEntityId("website")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "website" && cmd.did) {
      setSelectedEntityId("website")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "email" && cmd.did) {
      setSelectedEntityId("email")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "email" && cmd.did) {
      setSelectedEntityId("email")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "edit" && cmd.entityId == "indiv-email" && cmd.did) {
      console.info("************************** edit indiv email")
      setSelectedEntityId("indiv-email")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }
    if (cmd.action == "show" && cmd.entityId == "indiv-email" && cmd.did) {
      setSelectedEntityId("indiv-email")
      setSelectedDid(cmd.did)
      setAttestationViewModalVisible(true)
    }

    
    //console.info("app command: ", cmd)
  };


  
  const handleOnLinkedinModalClose = () => {
    setLinkedinModalVisible(false);
  }

  const handleOnXModalClose = () => {
    setXModalVisible(false);
  }

  const handleOnAttestationViewModalClose = () => {
    setAttestationViewModalVisible(false);
  }








  useEffect(() => {
  
      return () => {
      };
    }, []);


  interface MainPageProps {
    className: string;
    appCommand: (cmd: Command) => void;
  }


  const MainPageWithProps: React.FC<Partial<MainPageProps>> = (props) => (
      <MainPage
          className={'main-content'}
          appCommand={appCommand}
          {...props}
      />
  );



  interface HomePageProps {
    className: string;
  }
  interface HeaderProps {
    className: string;
  }
  interface WelcomePageProps {
    className: string;
    appCommand: (cmd: Command) => void;
  }
  interface SetupWalletPageProps {
    className: string;
    appCommand: (cmd: Command) => void;
  }


  const HomePageWithProps: React.FC<Partial<HomePageProps>> = (props) => (
    <HomePage
        className={'main-content'}
        {...props}
    />
  );

  
  const WelcomePageWithProps: React.FC<Partial<WelcomePageProps>> = (props) => (
    <WelcomePage
        className={'main-content'}
        appCommand={appCommand}
        {...props}
    />
  );

  const SetupWalletPageWithProps: React.FC<Partial<SetupWalletPageProps>> = (props) => (
    <SetupSmartWalletPage
        className={'main-content'}
        appCommand={appCommand}
        {...props}
    />
  );

  const HeaderWithProps: React.FC<Partial<HeaderProps>> = (props) => (
    <Header
        className={'main-content'}
        {...props}
    />
  );


  interface OrganizationsPageProps {
    className: string;
    appCommand: (cmd: Command) => void;
  }

  const OrganizationsPageWithProps: React.FC<Partial<OrganizationsPageProps>> = (props) => (
    <OrganizationsPage
        className={'organization-content'}
        appCommand={appCommand}
        {...props}
    />
  );


  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <WalletConnectContextProvider>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <div
            className="App h-screen flex flex-col"
          >
            <HeaderWithProps />
            <ToastContainer />
            <div className="flex overflow-hidden w-full h-full relative z-0">
            
              <LinkedinModal
                isVisible={isLinkedinModalVisible}
                onClose={handleOnLinkedinModalClose}
              />
              <AttestationViewModal
                did={selectedDid}
                entityId={selectedEntityId}
                isVisible={isAttestationViewModalVisible}
                onClose={handleOnAttestationViewModalClose}
              />
              <XModal isVisible={isXModalVisible} onClose={handleOnXModalClose} />


              <div className="grow overflow-hidden">
                <Routes>
                  <Route path="/" element={<HomePageWithProps />} />
                  <Route
                    path="/welcome"
                    element={<WelcomePageWithProps />}
                  />
                  <Route
                    path="/setup"
                    element={<SetupWalletPageWithProps />}
                  />
                  <Route
                    path="/organizations"
                    element={<OrganizationsPageWithProps />}
                  />

                  <Route path="linkedincallback" element={<LinkedinCallback />} />
                  <Route path="xcallback" element={<XCallback />} />
                  <Route path="shopifycallback" element={<ShopifyCallback />} />

                  <Route
                    path="/chat/*"
                    element={
                      <div className="flex h-full w-full" >
                        <Routes>
                          <Route path="/" element={<MainPageWithProps />} />
                          <Route path="c/:id" element={<MainPageWithProps />} />
                        </Routes>
                      </div>
                    }
                  />
                  <Route path="*" element={<Navigate to="/chat/" replace />} />
                </Routes>
              </div>
            </div>
          </div>
        </I18nextProvider>
      </BrowserRouter>
    </WalletConnectContextProvider>
  </QueryClientProvider>
</WagmiProvider>
  );
};

export default App;
