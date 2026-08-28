import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { handleVitePreloadError } from './utils/staleChunkRecovery';

// Polyfill process for browser environment to prevent "process is not defined" errors
// This is necessary because the Gemini SDK and other libs might reference 'process'
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

// A tab left open across a Hosting deploy can hold a lazy-route reference to
// a chunk hash that no longer exists. Vite's build wraps every dynamic
// import (all of this app's React.lazy() routes) so that a failure like that
// dispatches this event before rethrowing — recover automatically, once per
// distinct failure, instead of letting it reach the ErrorBoundary at all.
window.addEventListener('vite:preloadError', handleVitePreloadError);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);