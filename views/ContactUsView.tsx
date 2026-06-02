import React from 'react';
import { ChevronLeft, Mail, Globe } from 'lucide-react';

export const ContactUsView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="bg-gray-100 dark:bg-dark-900 font-sans text-gray-800 dark:text-white min-h-full">
      <div className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Contact Us</h1>
        </div>
      </div>
      <div className="p-6">
        <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 space-y-6">
          <p className="text-gray-600 dark:text-gray-300">
            Have questions, feedback, or need support? We'd love to hear from you.
          </p>
          
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-500">
              <Mail size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email us</p>
              <a href="mailto:hello@parqueen.app" className="font-semibold hover:text-blue-500 transition-colors">hello@parqueen.app</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-500">
              <Globe size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Visit our website</p>
              <a href="https://parqueen.app/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-green-500 transition-colors">https://parqueen.app/</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
