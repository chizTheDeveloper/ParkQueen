import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser as deleteFirebaseUser } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"; 

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
    const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
    const firebaseUser = userCredential.user;

    const { password, ...profileData } = user;

    await setDoc(doc(db, "users", firebaseUser.uid), {
        ...profileData,
        id: firebaseUser.uid
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

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out: ", error);
    throw error;
  }
};

export const updateUser = async (userId: string, data: Partial<UserProfile>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
    console.log("User profile updated successfully.");
  } catch (error) {
    console.error("Error updating user profile: ", error);
    throw error;
  }
};

export const deleteUser = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No user is currently signed in.");
  }

  try {
    await deleteDoc(doc(db, "users", user.uid));
    await deleteFirebaseUser(user);
  } catch (error) {
    console.error("Error deleting user: ", error);
    throw error;
  }
};
