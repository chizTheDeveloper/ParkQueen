import { initializeApp } from 'firebase/app';
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

// ── App Check (TM-12) ────────────────────────────────────────────────────────
// Debug token is injected in dev builds only. import.meta.env.DEV is replaced
// with `false` by Vite in production, so this block is tree-shaken from the
// prod bundle — the debug token never ships to production.
// Production enforcement requires a reCAPTCHA site key; see docs/APP_CHECK_ROLLOUT.md.
if (import.meta.env.DEV) {
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export const getFCM = async () => {
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
};
