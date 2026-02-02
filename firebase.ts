
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y",
  authDomain: "parkqueen-46475363-ccf36.firebaseapp.com",
  projectId: "parkqueen-46475363-ccf36",
  storageBucket: "parkqueen-46475363-ccf36.firebasestorage.app",
  messagingSenderId: "768131391875",
  appId: "1:768131391875:web:613c5d2a948862333196b6"
};

const app = (() => {
  try {
    if (typeof window === 'undefined') return null;
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (error) {
    console.warn("Firebase App initialization failed.");
    return null;
  }
})();

export const db = app ? getFirestore(app) : null;
export const analytics = app && typeof window !== 'undefined' ? getAnalytics(app) : null;

export const auth = app ? getAuth(app) : null;
if (auth) {
  signInAnonymously(auth).catch((error) => {
    console.error("Anonymous sign-in failed", error);
  });
}
