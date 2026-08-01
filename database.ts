import { auth, db } from './firebaseConfig';
import { signOut, updateProfile, sendPasswordResetEmail as _sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
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

  // Remove this browser's FCM token from Firestore before signing out.
  // Prevents the token from remaining associated with this UID after sign-out:
  // if a different account signs in on the same device, getToken() returns the
  // same browser registration, and without this cleanup both accounts would share
  // the token — notifications intended for the previous user would reach the new one.
  const uid = auth.currentUser?.uid;
  if (uid) {
    await updateDoc(
      doc(db, 'users', uid, 'private', 'preferences'),
      { fcmToken: deleteField() }
    ).catch(() => {}); // best-effort: offline or missing doc must never block logout
  }

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
