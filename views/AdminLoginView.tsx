import React, { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import parqueenLogo from '../assets/Parqueen_Logo.png';

const ADMIN_DOMAIN = '@parqueen.app';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

interface AdminLoginViewProps {
  onVerified: () => void;
}

export const AdminLoginView = ({ onVerified }: AdminLoginViewProps) => {
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when a @parqueen.app account is signed in but has no role yet
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // If we land here with a user already signed in (e.g. after onAuthStateChanged
  // routed an authenticated-but-not-yet-admin account back here), detect their state.
  useEffect(() => {
    const current = auth.currentUser;
    if (!current) return;
    if (current.email?.endsWith(ADMIN_DOMAIN)) {
      current.getIdTokenResult(true).then(token => {
        if (token.claims.role === 'admin') {
          onVerified();
        } else {
          setPendingEmail(current.email);
        }
      });
    } else if (current.email) {
      // Non-parqueen.app account somehow signed in — sign them out
      signOut(auth);
    }
  }, [onVerified]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Hint the Google picker to show @parqueen.app accounts first
      provider.setCustomParameters({ hd: 'parqueen.app' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email?.endsWith(ADMIN_DOMAIN)) {
        await signOut(auth);
        setError('Access denied. Sign in with your @parqueen.app Google Workspace account.');
        setLoading(false);
        return;
      }

      // Force-refresh to get latest claims
      const token = await user.getIdTokenResult(true);
      if (token.claims.role === 'admin') {
        onVerified();
        return;
      }

      // @parqueen.app but no role yet — offer bootstrap if first-time setup
      setPendingEmail(user.email);
      setLoading(false);
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Sign-in failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setError(null);
    try {
      const functions = getFunctions();
      const bootstrapAdmin = httpsCallable(functions, 'bootstrapAdmin');
      await bootstrapAdmin({});
      // Force-refresh token to pick up the new role claim immediately
      await auth.currentUser?.getIdToken(true);
      onVerified();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('already-exists')) {
        setError('Admin access has already been claimed. Contact your administrator.');
      } else {
        setError(msg || 'Bootstrap failed. Please try again.');
      }
      setBootstrapping(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setPendingEmail(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        <img src={parqueenLogo} alt="ParQueen" className="h-12 mx-auto mb-2" />
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin Portal</h1>
        <p className="text-sm text-gray-500 mb-8">
          Sign in with your <span className="font-semibold">@parqueen.app</span> account
        </p>

        {!pendingEmail ? (
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <GoogleIcon />
            {loading ? 'Signing in…' : 'Sign in with Google'}
          </button>
        ) : (
          <div className="text-left space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Signed in as {pendingEmail}</p>
              <p className="text-blue-700">
                This account doesn't have admin access yet. If you're setting up ParQueen admin for the first time, click below to claim access.
              </p>
            </div>
            <button
              onClick={handleBootstrap}
              disabled={bootstrapping}
              className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {bootstrapping ? 'Setting up admin access…' : 'Claim Admin Access'}
            </button>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign out and use a different account
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-left">
            {error}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">ParQueen Admin · Restricted Access</p>
      </div>
    </div>
  );
};
