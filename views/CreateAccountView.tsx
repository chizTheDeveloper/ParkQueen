import React, { useState } from 'react';
import splashScreen from '../assets/splash_screen.svg';

interface CreateAccountViewProps {
  onContinue: (phone: string) => void;
}

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onContinue }) => {
  const [phone, setPhone] = useState('');

  return (
    <div 
      className="h-screen w-full flex flex-col items-center justify-center bg-cover bg-no-repeat bg-center p-4"
      style={{ backgroundImage: `url(${splashScreen})` }}
    >
      <div className="w-full max-w-md bg-[#07162c]/65 border border-white/8 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
        <h1 className="text-3xl font-black text-white">Create Account</h1>
        <p className="text-gray-400 mt-2 text-center text-sm">Enter your phone number to begin</p>

        <div className="w-full mt-8 text-left">
          <label className='text-left w-full block text-gray-400 text-sm px-1'>Mobile Number</label>
          <div className="relative mt-2 bg-white/5 rounded-2xl border border-white/10 shadow-inner focus-within:border-[#1e75ff] transition-all">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <span className='text-gray-300 font-semibold text-sm'>🇨🇦/🇺🇸 +1</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-1234"
              className="w-full bg-transparent p-4 pl-24 text-white font-semibold outline-none placeholder-gray-500 text-sm"
            />
          </div>
        </div>

        <button
          onClick={() => onContinue(phone)}
          className="w-full mt-8 bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-md shadow-blue-500/20 transition-all"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};
