import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from "firebase/firestore"; 

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  dob: string;
  gender: string;
  password?: string;
}

export const saveUser = async (user: UserProfile) => {
  console.log("Saving user to the database:", user);
  
  if (!user.password) {
    throw new Error("Password is required to create a user.");
  }

  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
    const firebaseUser = userCredential.user;

    // Don't store the password in the database
    const { password, ...profileData } = user;

    // Save the rest of the user's profile to Firestore
    await setDoc(doc(db, "users", firebaseUser.uid), {
        ...profileData,
        id: firebaseUser.uid // Use the Firebase UID as the document ID
    });

    console.log("User created and profile saved to Firestore with ID: ", firebaseUser.uid);

    return firebaseUser;
  } catch (error) {
    console.error("Error creating user or saving profile: ", error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in: ", error);
    throw error;
  }
};
