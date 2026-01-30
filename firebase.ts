import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y",
  authDomain: "parkqueen-46475363-ccf36.firebaseapp.com",
  projectId: "parkqueen-46475363-ccf36",
  storageBucket: "parkqueen-46475363-ccf36.firebasestorage.app",
  messagingSenderId: "768131391875",
  appId: "1:768131391875:web:613c5d2a948862333196b6"
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
