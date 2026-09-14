import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './lib/session.jsx';
import { LangProvider } from './lib/i18n.jsx';
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

/* Keep the app itself on the phone, so it opens with no signal (public/sw.js).
   Only in a built app: during development a saved copy would hide every change. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the app still works online */ });
  });
}
