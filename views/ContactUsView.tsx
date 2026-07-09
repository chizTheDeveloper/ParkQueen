import React from 'react';
import { ChevronLeft, Mail, Globe } from 'lucide-react';

export const ContactUsView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Contact Us</h1>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-6 shadow-xl text-[var(--color-text-secondary)] text-sm space-y-6">
        <p className="text-[var(--color-text-secondary)]">
          Have questions, feedback, or need support? We'd love to hear from you.
        </p>
        
        <div className="flex items-center gap-4">
          <div className="bg-[#1e75ff]/10 p-3 rounded-2xl text-[#38bdf8] shrink-0">
            <Mail size={22} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">Email us</p>
            <a href="mailto:hello@parqueen.app" className="font-bold text-[var(--color-text)] hover:text-[#38bdf8] transition-colors">hello@parqueen.app</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-[#1e75ff]/10 p-3 rounded-2xl text-[#38bdf8] shrink-0">
            <Globe size={22} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">Visit our website</p>
            <a href="https://parqueen.app/" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--color-text)] hover:text-[#38bdf8] transition-colors">parqueen.app</a>
          </div>
        </div>
      </div>
    </div>
  );
};
