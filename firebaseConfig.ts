import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y",
  authDomain: "parkqueen-46475363-ccf36.firebaseapp.com",
  projectId: "parkqueen-46475363-ccf36",
  storageBucket: "parkqueen-46475363-ccf36.firebasestorage.app",
  messagingSenderId: "768131391875",
  appId: "1:768131391875:web:613c5d2a948862333196b6"
};

// ── App Check debug token (DEV only) ─────────────────────────────────────────
// import.meta.env.DEV → false in production builds (Vite static replacement);
// this entire block is dead code that Rollup tree-shakes from prod bundles.
// Set VITE_APPCHECK_DEBUG_TOKEN in .env.local; obtain the token from
// Firebase Console → App Check → Apps → overflow menu → Manage debug tokens.
if (import.meta.env.DEV) {
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
}

// Initialize Firebase — single app instance shared by all service exports.
// getApps() guard makes this idempotent: if firebase.ts evaluates first (e.g., in
// a test or future refactor), App Check and service exports still attach to the
// same [DEFAULT] app rather than throwing app/duplicate-app.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── App Check (TM-12) ────────────────────────────────────────────────────────
// Initializes App Check when VITE_FIREBASE_APPCHECK_SITE_KEY is present.
// Without the key the branch is dead code (Vite replaces the env ref with
// undefined; Rollup eliminates the unreachable if-block from the prod bundle).
// Required before any protected Firebase service call so App Check tokens
// are available when Auth/Firestore/Functions requests are issued.
//
// To enable:
//   1. Register the app in Firebase Console → App Check → Apps
//   2. Add VITE_FIREBASE_APPCHECK_SITE_KEY=<site-key> to .env.production
//   3. Deploy; monitor Firebase Console → App Check → Metrics
//   4. Enable enforceAppCheck:true on callables per docs/APP_CHECK_ROLLOUT.md
//
// Status: SOURCE PREPARED — PROVIDER REGISTRATION AND ENFORCEMENT PENDING
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV) {
  // ponytail: DEV-only warning — tree-shaken from prod bundle
  console.warn('[AppCheck] TM-12 OPEN: VITE_FIREBASE_APPCHECK_SITE_KEY not set. App Check not initialized.');
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export const getFCM = async () => {
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
};
