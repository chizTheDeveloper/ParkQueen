import React, { useState, useRef } from 'react';
import { Camera, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { analyzeParkingSign } from '../services/geminiService';

export const AssistantView = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Ensure result is a string to prevent React rendering errors
      setAnalysis(String(result));
    } catch (err) {
      setAnalysis("Error: Could not complete analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const reset = () => {
    setImage(null);
    setAnalysis(null);
  };

  return (
    <div className="pt-20 pb-24 px-4 h-full bg-dark-900 overflow-y-auto no-scrollbar flex flex-col items-center">
      <div className="text-center mb-8 max-w-xs">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-queen-400 to-blue-400 mb-2">
          AI Sign Decoder
        </h2>
        <p className="text-gray-400 text-sm">
          Confused by NYC parking signs? Snap a photo and let ParQueen's AI tell you if you're safe.
        </p>
      </div>

      {!image ? (
        <div 
          onClick={triggerUpload}
          className="w-full max-w-sm aspect-square rounded-3xl border-2 border-dashed border-dark-700 bg-dark-800 flex flex-col items-center justify-center cursor-pointer hover:border-queen-500 hover:bg-dark-700/50 transition-all group"
        >
          <div className="w-20 h-20 bg-dark-700 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Camera size={40} className="text-queen-400" />
          </div>
          <span className="font-bold text-gray-300">Tap to Scan Sign</span>
          <span className="text-xs text-gray-500 mt-2">or upload from gallery</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <div className="relative rounded-3xl overflow-hidden border border-dark-700 shadow-2xl mb-6">
            <img src={image} alt="Sign" className="w-full h-auto max-h-[400px] object-cover" />
            <button 
              onClick={reset}
              className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700 min-h-[150px] relative">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-10 h-10 border-4 border-queen-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 animate-pulse text-sm">Analyzing complex rules...</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="text-queen-400">Analysis Result</span>
                </h3>
                <div className="text-lg leading-relaxed text-gray-200">
                    {analysis && analysis.toLowerCase().includes("yes") ? (
                        <div className="flex items-start gap-3 mb-2">
                             <CheckCircle2 className="text-green-500 shrink-0 mt-1" size={24} />
                             <span className="font-bold text-green-400 text-xl">You can park here.</span>
                        </div>
                    ) : analysis && analysis.toLowerCase().includes("no") ? (
                        <div className="flex items-start gap-3 mb-2">
                             <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                             <span className="font-bold text-red-400 text-xl">Do not park here.</span>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 mb-2">
                             <AlertCircle className="text-yellow-500 shrink-0 mt-1" size={24} />
                             <span className="font-bold text-yellow-400 text-xl">Conditional.</span>
                        </div>
                    )}
                    <p className="text-sm text-gray-400 pl-9 border-l-2 border-dark-700 ml-3 py-2">
                        {analysis ? String(analysis).replace(/^(YES|NO|CONDITIONAL)[\s:.]*/i, '') : 'No data available.'}
                    </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};