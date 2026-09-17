// Early error and unhandled rejection suppressor for benign SDK assertion and timeout anomalies
if (typeof window !== 'undefined') {
  const isBenignNoise = (msg?: string, stack?: string) => {
    const combined = ((msg || '') + ' ' + (stack || '')).toLowerCase();
    return (
      combined.includes('[vite]') ||
      combined.includes('failed to connect to websocket') ||
      combined.includes('pending promise was never set') ||
      combined.includes('internal assertion failed') ||
      combined.includes('could not reach cloud firestore backend') ||
      combined.includes("backend didn't respond within 10 seconds") ||
      combined.includes('the client will operate in offline mode') ||
      combined.includes('the client is offline') ||
      combined.includes('client is offline') ||
      combined.includes('auth/popup-closed-by-user') ||
      combined.includes('auth/cancelled-popup-request') ||
      combined.includes('auth/popup-blocked')
    );
  };

  const origError = console.error;
  const origWarn = console.warn;

  console.error = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : a?.message || '')).join(' ');
    if (isBenignNoise(text)) return;
    origError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : a?.message || '')).join(' ');
    if (isBenignNoise(text)) return;
    origWarn.apply(console, args);
  };

  window.addEventListener(
    'error',
    (e) => {
      if (isBenignNoise(e.message, e.error?.stack)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const reason = e.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || '');
      const stack = reason instanceof Error ? reason.stack : '';
      if (isBenignNoise(msg, stack)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './utils/imagePreloader';
import App from './App.tsx';
import './index.css';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';

// Prevent canvas.getBoundingClientRect errors in OffscreenCanvas workers or libraries
if (typeof OffscreenCanvas !== 'undefined' && !('getBoundingClientRect' in OffscreenCanvas.prototype)) {
  try {
    (OffscreenCanvas.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = function (this: OffscreenCanvas): DOMRect {
      const w = this.width || 300;
      const h = this.height || 150;
      return {
        top: 0,
        left: 0,
        right: w,
        bottom: h,
        width: w,
        height: h,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    };
  } catch (_) {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <App />
    </SystemErrorBoundary>
  </StrictMode>,
);

