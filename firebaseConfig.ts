import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y",
  authDomain: "parkqueen-46475363-ccf36.firebaseapp.com",
  projectId: "parkqueen-46475363-ccf36",
  storageBucket: "parkqueen-46475363-ccf36.firebasestorage.app",
  messagingSenderId: "768131391875",
  appId: "1:768131391875:web:613c5d2a948862333196b6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
