import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { initKiosk } from './kiosk/kiosk.js';

// Register the offline service worker (scope /player/).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/player/sw.js', { scope: '/player/' }).catch(() => {});
  });
}

initKiosk();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
