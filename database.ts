import { auth, db } from './firebaseConfig';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UserProfile {
  fullName: string;
  username?: string;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;
}

export const saveUserProfile = async (profile: UserProfile) => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("No authenticated user. Sign in first.");

  await updateProfile(firebaseUser, { displayName: profile.fullName });

  await setDoc(doc(db, "users", firebaseUser.uid), {
    ...profile,
    id: firebaseUser.uid,
    createdAt: serverTimestamp(),
    crowns: 0,
    title: 'Newcomer',
    moderationStatus: 'active',
    reportCount: 0,
    blockedUsers: [],
    notificationRadius: 1
  });

  return firebaseUser;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const updateUser = async (userId: string, data: Record<string, any>) => {
  await updateDoc(doc(db, 'users', userId), data);
};

export const deleteUser = async () => {
  if (!auth.currentUser) throw new Error("No user is currently signed in.");
  const fn = httpsCallable(getFunctions(undefined, 'us-central1'), 'deleteAccount');
  await fn();
  await signOut(auth);
};
