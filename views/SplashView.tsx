import React from 'react';
import { AppView } from '../types';

interface SplashViewProps {
  setView: (view: AppView) => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ setView }) => {
  return (
    <div 
      className="h-full w-full flex flex-col items-center justify-end bg-cover bg-no-repeat bg-center pb-32"
      style={{ backgroundImage: "url('/assets/splash screen.svg')" }}
    >
      <div className="flex flex-col gap-4 w-full max-w-xs px-4">
        <button 
          onClick={() => setView(AppView.MAP)}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-lg font-semibold transition-colors"
        >
          Login
        </button>
        <button 
          onClick={() => setView(AppView.MAP)}
          className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-lg font-semibold transition-colors"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};
