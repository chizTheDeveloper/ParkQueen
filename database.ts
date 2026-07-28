import { auth, db } from './firebaseConfig';
import { signOut, updateProfile, sendPasswordResetEmail as _sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UserProfile {
  fullName?: string;
  username?: string;
}

export const saveUserProfile = async (profile: UserProfile) => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("No authenticated user. Sign in first.");

  // Only update Firebase Auth displayName when a real name is provided
  if (profile.fullName) {
    await updateProfile(firebaseUser, { displayName: profile.fullName });
  }

  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  // Build payload — only include fields with real values to avoid writing undefined or ""
  const updates: Record<string, unknown> = { id: firebaseUser.uid };
  if (profile.fullName)  updates.fullName  = profile.fullName;
  if (profile.username)  updates.username  = profile.username;

  if (!snap.exists()) {
    // First-time creation — set required defaults that must only be established once
    await setDoc(userRef, {
      ...updates,
      createdAt: serverTimestamp(),
      crowns: 0,
      title: 'Newcomer',
    });
    await Promise.all([
      setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'social'), { blockedUsers: [] }),
      setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences'), { notificationRadius: 1 }),
      setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'account'), { moderationStatus: 'active', reportCount: 0 }),
    ]);
  } else {
    // Existing doc — update only the fields this call owns; never reset crowns, title, etc.
    await updateDoc(userRef, updates);
  }

  return firebaseUser;
};

export const logoutUser = async () => {
  // Preserve device-level preferences; clear all account-scoped browser state
  const theme = localStorage.getItem('theme');
  localStorage.clear();
  if (theme !== null) localStorage.setItem('theme', theme);
  await signOut(auth);
};

export const updateUser = async (userId: string, data: Record<string, any>) => {
  await updateDoc(doc(db, 'users', userId), data);
};

export const sendPasswordResetEmail = (email: string) =>
  _sendPasswordResetEmail(auth, email);

export const deleteUser = async () => {
  if (!auth.currentUser) throw new Error("No user is currently signed in.");
  const fn = httpsCallable(getFunctions(undefined, 'us-central1'), 'deleteAccount');
  await fn();
  await signOut(auth);
};
