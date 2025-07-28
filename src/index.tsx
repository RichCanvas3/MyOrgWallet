import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css';
import './globalStyles.css';
import 'react-toastify/dist/ReactToastify.css';
import {UserProvider} from "./UserContext";
import App from "./App";
import './i18n'; // sideEffects: true

// Suppress Lit dev mode warnings from WalletConnect/Web3Modal
const originalWarn = console.warn;
console.warn = function(msg, ...args) {
  if (typeof msg === 'string' && msg.includes('Lit is in dev mode')) {
    return; // Suppress Lit dev mode warnings
  }
  originalWarn.apply(console, [msg, ...args]);
};


window.addEventListener("load", async () => {
  await caches.delete("app-cache");
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
      <UserProvider>
        <App/>
      </UserProvider>
    </React.StrictMode>
);
