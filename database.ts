import { auth, db } from './firebaseConfig';
import { signOut, updateProfile, sendPasswordResetEmail as _sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UserProfile {
  fullName?: string;
  username?: string;
  phone?: string;
  email?: string;
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
  if (profile.phone)     updates.phone     = profile.phone;
  if (profile.email)     updates.email     = profile.email;

  if (!snap.exists()) {
    // First-time creation — set required defaults that must only be established once
    await setDoc(userRef, {
      ...updates,
      createdAt: serverTimestamp(),
      crowns: 0,
      title: 'Newcomer',
      moderationStatus: 'active',
      reportCount: 0,
      blockedUsers: [],
      notificationRadius: 1,
    });
  } else {
    // Existing doc — update only the fields this call owns; never reset crowns, title, etc.
    await updateDoc(userRef, updates);
  }

  return firebaseUser;
};

export const logoutUser = async () => {
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
