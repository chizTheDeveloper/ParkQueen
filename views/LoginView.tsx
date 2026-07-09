
import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import ParqueenLogo from '../assets/Parqueen_Logo.png';
import SplashScreen from '../assets/splash_screen.svg';
import { sendPasswordResetEmail } from '../database';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

interface LoginViewProps {
  onSuccess: () => void;
  onNavigateToCreateAccount: () => void;
}

const InputField = ({ icon, label, value, onChange, placeholder, type = 'text', autoComplete = 'off' }) => {
    return (
        <div className="bg-white/5 p-3.5 rounded-2xl border border-[var(--color-border)] shadow-inner w-full focus-within:border-[#1e75ff] transition-all">
          <div className="flex items-center">
            <div className="text-[var(--color-text-secondary)] mr-3 shrink-0">{icon}</div>
            <input
              type={type}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              autoComplete={autoComplete}
              className="w-full bg-transparent text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)] text-sm"
            />
          </div>
        </div>
    );
};

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onNavigateToCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return;
    setLoginError('');
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (e: any) {
      setLoginError(mapAuthError(e.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setResetError("Please enter your email address.");
      return;
    }
    setIsResetting(true);
    setResetError('');
    setResetMessage('');
    try {
      await sendPasswordResetEmail(email);
      setResetMessage("Password reset email sent! Check your inbox (and spam folder).");
    } catch (error: any) {
      setResetError(error.message || "Failed to send reset email.");
    } finally {
      setIsResetting(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-cover bg-no-repeat bg-center p-4"
           style={{ backgroundImage: `url(${SplashScreen})` }}>
        <div className="w-full max-w-sm bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
              <img src={ParqueenLogo} alt="Logo" className="h-16" />
          </div>
          <h1 className="text-2xl font-bold text-center text-[var(--color-text)]">Reset Password</h1>
          <p className="text-center text-[var(--color-text-secondary)] mb-6 text-sm">Enter your email to receive a password reset link.</p>

          <div className="space-y-4">
            <InputField
              icon={<Mail size={20} />}
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
            />
          </div>

          {resetError && <p role="alert" className="text-red-400 text-sm mt-3 text-center">{resetError}</p>}
          {resetMessage && <p className="text-green-400 text-sm mt-3 text-center">{resetMessage}</p>}

          <div className="mt-6">
            <button
              onClick={handleResetPassword}
              disabled={isResetting}
              className={`w-full bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-blue-500/20 ${isResetting ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {isResetting ? "Sending..." : "Send Reset Link"}
            </button>
          </div>

          <div className="text-center mt-6">
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetMessage('');
                  setResetError('');
                }}
                className="font-bold text-[#38bdf8] hover:underline text-sm">
                  Back to Login
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-cover bg-no-repeat bg-center p-4"
         style={{ backgroundImage: `url(${SplashScreen})` }}>
      <div className="w-full max-w-sm bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
            <img src={ParqueenLogo} alt="Logo" className="h-16" />
        </div>
        <h1 className="text-2xl font-bold text-center text-[var(--color-text)]">Welcome Back!</h1>
        <p className="text-center text-[var(--color-text-secondary)] mb-8 text-sm">Please log in to your account.</p>

        <div className="space-y-4">
          <InputField
            icon={<Mail size={20} />}
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
          />
          <InputField
            icon={<Lock size={20} />}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
        </div>

        {loginError && (
          <p role="alert" className="text-red-400 text-sm mt-4 text-center font-medium">
            {loginError}
          </p>
        )}

        <div className="text-right mt-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                setLoginError('');
                setIsForgotPassword(true);
              }}
              className="text-sm font-semibold text-[#38bdf8] hover:underline">
              Forgot password?
            </button>
        </div>

        <div className="mt-6">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? 'Signing in…' : 'Log In'}
          </button>
        </div>

        <div className="text-center mt-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Don't have an account?{' '}
              <button onClick={onNavigateToCreateAccount} className="font-bold text-[#38bdf8] hover:underline">
                Sign Up
              </button>
            </p>
        </div>
      </div>
    </div>
  );
};
