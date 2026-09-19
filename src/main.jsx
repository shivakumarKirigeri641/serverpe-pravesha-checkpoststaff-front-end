import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './lib/session.jsx';
import { LangProvider } from './lib/i18n.jsx';
import { startPwa } from './lib/pwa.js';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </LangProvider>
  </React.StrictMode>
);

/* Install offer, the saved copy for no signal, and news of a new version (lib/pwa.js). */
startPwa();
