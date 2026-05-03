
import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import ParqueenLogo from '../assets/Parqueen_Logo.png';
import SplashScreen from '../assets/splash_screen.svg';
import { sendPasswordResetEmail } from '../database';

interface LoginViewProps {
  onLogin: (email: string, password: string) => void;
  onNavigateToCreateAccount: () => void;
}

const InputField = ({ icon, label, value, onChange, placeholder, type = 'text', autoComplete = 'off' }) => {
    return (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full">
          <div className="flex items-center">
            <div className="text-gray-400 mr-3">{icon}</div>
            <input
              type={type}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              autoComplete={autoComplete}
              className="w-full bg-transparent text-gray-800 font-semibold outline-none placeholder-gray-400"
            />
          </div>
        </div>
    );
};

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onNavigateToCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = () => {
    onLogin(email, password);
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
      setResetMessage("Password reset email sent! Check your inbox.");
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
        <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-2xl p-8 shadow-lg">
          <div className="flex justify-center mb-6">
              <img src={ParqueenLogo} alt="Logo" className="h-16" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800">Reset Password</h1>
          <p className="text-center text-gray-600 mb-6">Enter your email to receive a password reset link.</p>
          
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

          {resetError && <p className="text-red-500 text-sm mt-3 text-center">{resetError}</p>}
          {resetMessage && <p className="text-green-600 text-sm mt-3 text-center">{resetMessage}</p>}

          <div className="mt-6">
            <button 
              onClick={handleResetPassword} 
              disabled={isResetting}
              className={`w-full bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-600 transition-transform active:scale-95 ${isResetting ? 'opacity-70 cursor-not-allowed' : ''}`}>
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
                className="font-bold text-blue-600 hover:underline text-sm">
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
      <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-2xl p-8 shadow-lg">
        <div className="flex justify-center mb-6">
            <img src={ParqueenLogo} alt="Logo" className="h-16" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800">Welcome Back!</h1>
        <p className="text-center text-gray-600 mb-8">Please log in to your account.</p>
        
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

        <div className="text-right mt-4">
            <button 
              onClick={(e) => {
                e.preventDefault();
                setIsForgotPassword(true);
              }} 
              className="text-sm font-semibold text-blue-600 hover:underline">
              Forgot password?
            </button>
        </div>

        <div className="mt-6">
          <button onClick={handleLogin} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-600 transition-transform active:scale-95">
            Log In
          </button>
        </div>

        <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button onClick={onNavigateToCreateAccount} className="font-bold text-blue-600 hover:underline">
                    Sign Up
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};
