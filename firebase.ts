import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBn7DP3Wm1kGoEo7jn-ZAatiXhgtIuJbBs",
  authDomain: "gen-lang-client-0911917934.firebaseapp.com",
  projectId: "gen-lang-client-0911917934",
  storageBucket: "gen-lang-client-0911917934.firebasestorage.app",
  messagingSenderId: "584580846540",
  appId: "1:584580846540:web:fb0a7cb5b21cfe066cc369",
  measurementId: "G-KDEJ3Q03D9"
};

// Initialize Firebase App singleton safely
const app = (() => {
  try {
    if (typeof window === 'undefined') return null;
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (error) {
    console.warn("Firebase App initialization failed (likely configuration or environment issue).");
    return null;
  }
})();

// Initialize Firestore with a safety wrapper
export const db = (() => {
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (error) {
    console.warn("Firestore service is not available.");
    return null;
  }
})();

// Initialize Analytics with environment and support checks
export const analytics = (() => {
  if (!app || typeof window === 'undefined') return null;
  try {
    return getAnalytics(app);
  } catch (error) {
    // Analytics failure shouldn't crash the app
    return null;
  }
})();