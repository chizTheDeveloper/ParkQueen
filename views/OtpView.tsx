import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface OtpViewProps {
  phone: string;
  onBack: () => void;
}

export const OtpView: React.FC<OtpViewProps> = ({ phone, onBack }) => {
  return (
    <div className="h-screen bg-gradient-to-b from-sky-300 to-sky-100 flex flex-col justify-between">
      <div className="p-4">
        <button onClick={onBack} className="text-gray-800">
          <ChevronLeft size={24} />
        </button>
      </div>
      <div className="flex-grow flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800">Enter OTP</h1>
        <p className="text-gray-600 mt-2">A 6 digit code has been sent to</p>
        <p className="text-gray-800 font-semibold">{`+1${phone}`}</p>

        <div className="flex justify-center gap-2 mt-8">
          {[...Array(6)].map((_, index) => (
            <input
              key={index}
              type="text"
              maxLength={1}
              className="w-12 h-14 text-center text-2xl border border-gray-300 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          ))}
        </div>

        <button
          className="w-full max-w-sm mt-6 bg-cyan-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          Verify
        </button>
      </div>
      <div />
    </div>
  );
};
