import React, { useState, useRef } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { Camera, RefreshCw, AlertCircle, CheckCircle2, Clock, Bell, ChevronLeft, Ruler, Shield } from 'lucide-react';
import { analyzeParkingSign, SignAnalysisResult } from '../services/geminiService';
import { useParkingTimer } from './street-parking/useParkingTimer';

export const AssistantView = () => {
  const [mode, setMode] = useState<'hub' | 'scan'>('hub');
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SignAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { startTimer, timer } = useParkingTimer();
  useFocusOnMount(headingRef);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setImage(base64String);
        setAnalysis(null);
        analyze(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyze = async (base64Data: string) => {
    setIsLoading(true);
    try {
      const result = await analyzeParkingSign(base64Data);
      setAnalysis(result);
    } catch {
      setAnalysis({
        status: 'ERROR',
        explanation: 'ParQueen Assistant is having trouble right now. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerUpload = () => {
    if (isLoading) return;
    setMode('scan');
    // defer so the input is mounted before click
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const reset = () => {
    setImage(null);
    setAnalysis(null);
  };

  const backToHub = () => {
    reset();
    setMode('hub');
  };

  const reminderSet = !!timer;

  const setReminder = () => {
    if (!analysis) return;
    let minutes = 60;
    if (analysis.restrictionStartsAt) {
      const parsed = new Date(analysis.restrictionStartsAt);
      const diff = Math.ceil((parsed.getTime() - Date.now()) / 60_000);
      if (diff > 0) minutes = diff;
    }
    startTimer(minutes, 'parking sign');
  };

  return (
    <div className="pt-20 pb-24 px-4 h-full bg-[var(--color-bg)] overflow-y-auto no-scrollbar">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {mode === 'scan' && (
          <button
            onClick={backToHub}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] shrink-0"
          >
            <ChevronLeft size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        )}
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-queen-400 to-blue-400 focus:outline-none">
            ParQueen Assistant
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Street-smart parking help</p>
        </div>
      </div>

      {/* Hub */}
      {mode === 'hub' && (
        <div className="space-y-3">
          {/* Scan a Parking Sign — active */}
          <button
            onClick={triggerUpload}
            className="w-full text-left rounded-2xl p-4 border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-white/8 active:scale-[0.98] transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #1e75ff22, #0ea5e922)', border: '1.5px solid #1e75ff44' }}>
              <Camera size={22} className="text-[#38bdf8]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--color-text)]">Scan a Parking Sign</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Take a photo and get a simple explanation.</p>
            </div>
          </button>

          {/* Check Hydrant Distance — coming soon */}
          <div className="w-full rounded-2xl p-4 border border-[var(--color-border)] bg-[var(--color-card)] opacity-50 flex items-center gap-4 cursor-not-allowed select-none">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
              <Ruler size={22} className="text-[var(--color-text-secondary)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-[var(--color-text)]">Check Hydrant Distance</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/8 text-[var(--color-text-secondary)] border border-[var(--color-border)]">Soon</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Estimate if you're far enough from a hydrant.</p>
            </div>
          </div>

          {/* Am I Safe Here? — coming soon */}
          <div className="w-full rounded-2xl p-4 border border-[var(--color-border)] bg-[var(--color-card)] opacity-50 flex items-center gap-4 cursor-not-allowed select-none">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
              <Shield size={22} className="text-[var(--color-text-secondary)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-[var(--color-text)]">Am I Safe Here?</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/8 text-[var(--color-text-secondary)] border border-[var(--color-border)]">Soon</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Use My Car and street rules to understand your parking risk.</p>
            </div>
          </div>
        </div>
      )}

      {/* Scan mode */}
      {mode === 'scan' && (
        <div className="flex flex-col items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {!image ? (
            <div className="w-full max-w-sm flex flex-col items-center pt-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg, #1e75ff22, #0ea5e922)', border: '2px solid #1e75ff33' }}>
                <Camera size={44} className="text-[#38bdf8]" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6 leading-relaxed">
                Take a clear photo of the full parking sign.
              </p>
              <button
                onClick={() => { if (!isLoading) fileInputRef.current?.click(); }}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm active:scale-[0.98] transition-transform mb-3 disabled:opacity-50 disabled:active:scale-100"
                style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
              >
                Open camera
              </button>
              <button
                onClick={() => { if (!isLoading) galleryInputRef.current?.click(); }}
                disabled={isLoading}
                className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors py-2 disabled:opacity-50"
              >
                Choose from photos
              </button>
              <p className="text-[11px] text-gray-500 text-center mt-6 leading-relaxed px-4">
                Camera access is only used to scan the sign you choose.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <div className="relative rounded-3xl overflow-hidden border border-[var(--color-border)] shadow-2xl mb-6">
                <img src={image} alt="Sign" className="w-full h-auto max-h-[400px] object-cover" />
                <button
                  onClick={reset}
                  className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70"
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div aria-live="polite" role="status" className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] min-h-[150px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-10 h-10 border-4 border-queen-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-[var(--color-text-secondary)] animate-pulse motion-reduce:animate-none text-sm">Reading the sign...</p>
                  </div>
                ) : analysis ? (
                  <div className="animate-in fade-in duration-500">
                    {analysis.status === 'YES' ? (
                      <div className="flex items-start gap-3 mb-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-1" size={24} />
                        <span className="font-bold text-green-400 text-xl">Looks like you can park here.</span>
                      </div>
                    ) : analysis.status === 'NO' ? (
                      <div className="flex items-start gap-3 mb-2">
                        <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                        <span className="font-bold text-red-400 text-xl">Do not park here.</span>
                      </div>
                    ) : analysis.status === 'ERROR' ? (
                      <div className="flex items-start gap-3 mb-2">
                        <AlertCircle className="text-yellow-500 shrink-0 mt-1" size={24} />
                        <span className="font-bold text-yellow-400 text-xl">Couldn't read this sign.</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 mb-2">
                        <AlertCircle className="text-yellow-500 shrink-0 mt-1" size={24} />
                        <span className="font-bold text-yellow-400 text-xl">Conditional.</span>
                      </div>
                    )}

                    <p className="text-sm text-[var(--color-text-secondary)] pl-9 border-l-2 border-[var(--color-border)] ml-3 py-2">
                      {analysis.explanation}
                    </p>

                    {analysis.actionableAdvice && (
                      <div className="mt-4 pl-9">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
                            <Clock size={16} /> Actionable Advice
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)]">{analysis.actionableAdvice}</p>
                          <button
                            onClick={setReminder}
                            className="mt-3 w-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                          >
                            <Bell size={16} /> {reminderSet ? 'Reminder set' : 'Set Departure Reminder'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Beta disclaimer */}
                    {analysis.status !== 'ERROR' && (
                      <p className="mt-4 text-[11px] text-[var(--color-text-secondary)] text-center leading-relaxed">
                        Always confirm posted signs before leaving your car.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
