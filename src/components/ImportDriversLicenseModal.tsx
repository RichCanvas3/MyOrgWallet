import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import axios from 'axios'

import QRCode from 'react-qr-code'

import {
  XMarkIcon
} from "@heroicons/react/24/outline";
import './UserSettingsModal.css';
import {useTranslation} from 'react-i18next';
import {Transition} from '@headlessui/react';


import AttestationService from '../service/AttestationService';
import { useWallectConnectContext } from "../context/walletConnectContext";
import { useWalletClient } from 'wagmi';




interface ImportDriversLicenseModalProps {
  isVisible: boolean;
  onClose: () => void;
}


const ImportDriversLicenseModal: React.FC<ImportDriversLicenseModalProps> = ({isVisible, onClose}) => {
  
  const CALLBACK_URI = `${import.meta.env.VITE_API_URL}/driverslicense` || 'http://localhost:4000/driverslicense';
  const GET_URI = `${import.meta.env.VITE_API_URL}/driverslicenses` || 'http://localhost:4000/driverslicenses';
  const STARTSESSION_URI = `${import.meta.env.VITE_API_URL}/startsession` || 'http://localhost:4000/startsession';

  const {t} = useTranslation();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { veramoAgent, credentialManager, signatory, orgDid, indivDid, privateIssuerDid, orgIndivDelegation, orgIssuerDelegation, indivIssuerDelegation, orgAccountClient, indivAccountClient, privateIssuerAccount, burnerAccountClient } = useWallectConnectContext();
  const { data: walletClient } = useWalletClient();

  const [driversLicenses, setDriversLicenses] = useState<string[]>([])
  const [session, setSession] = useState<any>(null)

  const handleClose = () => {
    onClose();
  };



  useEffect(() => {

    if (isVisible) {
      console.info("get drivers licenses url: ", GET_URI)
      const fetchDriversLicenses = async () => {
        const getDriversLicenses = GET_URI
        const res = await axios.get(getDriversLicenses)
        setDriversLicenses(res.data)
      }
      fetchDriversLicenses().then(() => {
        console.info("fetch drivers licenses from server")
      })


      console.info("get drivers license session id using uri: ", STARTSESSION_URI)
      const fetchSession = async () => {
        console.info("fetch drivers license session from server: ", STARTSESSION_URI )
        const res = await axios.get(STARTSESSION_URI)
        console.info("set drivers license qr code request session: ", res.data)
        setSession(res.data)
      }

      fetchSession().then(() => {
        console.info("fetch drivers license session from server")
      })

    }
    
  }, [isVisible]);
  

  return (

          <Transition show={isVisible} as={React.Fragment}>
            <div  className="modal-overlay fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50 px-4">
              <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
              >
                <div ref={dialogRef}
                     className="flex flex-col bg-white  rounded-lg w-full max-w-md mx-auto overflow-hidden"
                     style={{ zIndex: 100000000, maxHeight: "90vh", minWidth: "43em", overflowY: "auto" }}>
                  <div id='modal-header'
                       className="flex justify-between items-center border-b border-gray-200 p-4">
                    <h1 className="modal-title text-lg font-semibold">{('Import Drivers License')}</h1>
                    <button onClick={handleClose}
                            className="text-gray-700 hover:text-gray-900">
                      <XMarkIcon className="h-8 w-8" aria-hidden="true"/>
                    </button>
                  </div>
                  <div id='approve-content' className="flex flex-1">
                    <div className="flex flex-col flex-1">
    
                      <div style={{ padding: 40, textAlign: 'center' }}>
                        <h2>Scan to Share Verifiable Credential</h2>
                        <div style={{ background: 'white', padding: '16px' }}>
                          <QRCode value={JSON.stringify(session)} size={256} />
                        </div>
                        
                        <p>Use your mDL or identity wallet to scan and share your credentials.</p>

                        <pre style={{ marginTop: 10, background: '#f0f0f0', padding: 10, maxHeight: 300, overflowY: 'auto' }}>
                          {JSON.stringify(driversLicenses, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
    
              </Transition.Child>
            </div>
          </Transition>


  );
};

export default ImportDriversLicenseModal;
