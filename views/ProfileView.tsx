import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Edit, Clock, Shield, Info, Camera, Trophy, Flame, Star, Settings } from 'lucide-react';
import { AppView } from '../types';

export const ProfileView = ({ user, onBack, setView }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      setUploadStatus('Uploading...');
      const storage = getStorage();
      const storageRef = ref(storage, `avatars/${user.id}`);
      try {
        await uploadBytes(storageRef, file);
        setUploadStatus('Checking photo...');

        const moderationRef = doc(db, 'avatarModeration', user.id);
        const timeout = setTimeout(() => {
          unsub();
          setUploadStatus('');
          setIsUploading(false);
          alert('Photo check timed out. Please try again.');
        }, 20000);

        const unsub = onSnapshot(moderationRef, async (snap) => {
          const data = snap.data();
          if (!data || data.status === 'checking') return;

          clearTimeout(timeout);
          unsub();

          if (data.status === 'approved') {
            const avatarUrl = await getDownloadURL(storageRef);
            await updateDoc(doc(db, 'users', user.id), { avatarUrl });
            setUploadStatus('');
          } else {
            setUploadStatus('This photo couldn\'t be used. Please choose a different photo.');
            setTimeout(() => setUploadStatus(''), 4000);
          }
          setIsUploading(false);
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        setUploadStatus('');
        alert("Failed to upload. Please try again.");
        setIsUploading(false);
      }
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      {user ? (
        <div className="max-w-md mx-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Profile</h2>
            <button onClick={() => setView(AppView.SETTINGS)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
              <Settings size={20} />
            </button>
          </div>

          {/* User Info & Avatar */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3.5 group">
              <div className="w-24 h-24 rounded-full border-4 border-[#1e75ff] overflow-hidden shrink-0 relative bg-[var(--color-card)] flex items-center justify-center text-[var(--color-text-secondary)]">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-user text-4xl"></i>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-pulse">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <button 
                onClick={triggerUpload} 
                className="absolute bottom-0 right-0 w-7.5 h-7.5 rounded-full bg-[#1e75ff] border-2 border-[var(--color-bg)] flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 transition-colors shadow-md"
                aria-label="Upload photo"
              >
                <Edit size={12} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
            <h2 className="text-xl font-extrabold text-[var(--color-text)]">{user.username || user.fullName || "User"}</h2>
            {user.username?.startsWith('user_') && (
              <button onClick={() => setView(AppView.EDIT_PROFILE)} className="text-[#1e75ff] text-xs font-semibold mt-1 underline" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                Complete your profile
              </button>
            )}
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{user.email || ""}</p>
            {uploadStatus && (
              <p className={`text-xs mt-2 font-semibold ${uploadStatus.includes('couldn') ? 'text-red-400' : 'text-blue-400'}`}>{uploadStatus}</p>
            )}
          </div>

          {/* Gamification Stats */}
          <div className="grid grid-cols-3 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl p-4 mb-6 text-center">
            {/* Reputation */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-1.5 shrink-0">
                <Trophy size={18} />
              </div>
              <span className="font-extrabold text-base text-[var(--color-text)]">{user.reputationScore || 0}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold mt-0.5">Reputation</span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-12 bg-[var(--color-border)] self-center" />

            {/* Streak */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-1.5 shrink-0">
                <Flame size={18} />
              </div>
              <span className="font-extrabold text-base text-[var(--color-text)]">{user.currentStreak || 0}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold mt-0.5">Streak</span>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-[var(--color-border)] self-center" />

            {/* Tier */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-1.5 shrink-0">
                <Star size={18} />
              </div>
              <span className="font-extrabold text-base text-[#1e75ff]">{user.tier || 'Newcomer'}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold mt-0.5">Tier</span>
            </div>
          </div>

          {/* List Items Groups */}
          <div className="space-y-6">
            {/* Parking Details Group */}
            <div>
              <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">Parking Details</h3>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
                {/* Parking Space row */}
                <button 
                  onClick={() => setView(AppView.PARKING_SPACE)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <Clock size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Parking History</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">View your recent parking activity</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>

                {/* Listings row - Disabled for now as per client feedback */}
                {/*
                <button 
                  onClick={() => setView(AppView.GARAGE_LIST)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <List size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Rentals & Listings</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Rent or share private spots</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>
                */}

                {/* Host Dashboard row - Disabled for now as per client feedback */}
                {/*
                <button 
                  onClick={() => setView(AppView.HOST_DASHBOARD)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <LayoutDashboard size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Host Dashboard</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Manage earnings & list spots</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>
                */}

              </div>
            </div>

            {/* General Details Group */}
            <div>
              <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">General Details</h3>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
                {/* Privacy Policy */}
                <button 
                  onClick={() => setView(AppView.PRIVACY_POLICY)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Privacy Policy</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Learn how we protect you</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>

                {/* Terms of Use */}
                <button 
                  onClick={() => setView(AppView.TERMS_OF_USE)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <Info size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Terms of Use</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Read our terms and conditions</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>

                {/* Contact Us */}
                <button 
                  onClick={() => setView(AppView.CONTACT_US)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">Contact Us</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Get in touch with our team</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-10">Please log in to see your profile.</div>
      )}
    </div>
  );
};