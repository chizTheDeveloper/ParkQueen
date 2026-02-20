import React, { useState } from 'react';

interface CreateAccountViewProps {
  onContinue: (phone: string) => void;
}

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onContinue }) => {
  const [phone, setPhone] = useState('');

  return (
    <div 
      className="h-screen w-full flex flex-col items-center justify-center bg-cover bg-no-repeat bg-center p-4"
      style={{ backgroundImage: "url('/assets/splash_screen.svg')" }}
    >
      <div className="w-full max-w-md text-center bg-gray-200/[.65] backdrop-blur-md rounded-2xl p-8">
        <h1 className="text-3xl font-black text-dark-900">Create Account</h1>
        <p className="text-dark-700 mt-2 text-center">Enter your phone number to begin</p>

        <div className="w-full mt-8">
          <label className='text-left w-full block text-dark-700 text-sm'>Mobile Number</label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className='text-dark-900'>🇨🇦/🇺🇸 +1</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-1234"
              className="w-full bg-transparent border-b-2 border-dark-700 p-4 pl-20 text-lg text-dark-900 focus:border-queen-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => onContinue(phone)}
          className="w-full mt-8 bg-cyan-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};
