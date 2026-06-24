import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Edit, FileText, Bell, Shield, Info, LogOut, Trash2, Camera, Trophy, Flame, Star, Settings, List, LayoutDashboard } from 'lucide-react';
import { AppView } from '../types';

export const ProfileView = ({ user, onBack, onLogout, onDeleteAccount, setView, theme, toggleTheme }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      const storage = getStorage();
      const storageRef = ref(storage, `avatars/${user.id}`);
      try {
        await uploadBytes(storageRef, file);
        const avatarUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'users', user.id), { avatarUrl });
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload new avatar. Please try again.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-full bg-dark-900 text-white pt-4 pb-20 px-4">
      {user ? (
        <div className="max-w-md mx-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-white tracking-wide">Profile</h2>
            <button onClick={() => setView(AppView.EDIT_PROFILE)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
              <Settings size={20} />
            </button>
          </div>

          {/* User Info & Avatar */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3.5 group">
              <div className="w-24 h-24 rounded-full border-4 border-[#1e75ff] overflow-hidden shrink-0 relative bg-dark-800 flex items-center justify-center text-gray-500">
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
                className="absolute bottom-0 right-0 w-7.5 h-7.5 rounded-full bg-[#1e75ff] border-2 border-dark-900 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 transition-colors shadow-md"
                aria-label="Upload photo"
              >
                <Edit size={12} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
            <h2 className="text-xl font-extrabold text-white">{user.fullName || "Chi Chima"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{user.email || "chumc554@gmail.com"}</p>
          </div>

          {/* Gamification Stats */}
          <div className="grid grid-cols-3 bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl p-4 mb-6 text-center">
            {/* Reputation */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-1.5 shrink-0">
                <Trophy size={18} />
              </div>
              <span className="font-extrabold text-base text-white">{user.reputationScore || 0}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">Reputation</span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-12 bg-white/5 self-center" />

            {/* Streak */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-1.5 shrink-0">
                <Flame size={18} />
              </div>
              <span className="font-extrabold text-base text-white">{user.currentStreak || 0}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">Streak</span>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-white/5 self-center" />

            {/* Tier */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-1.5 shrink-0">
                <Star size={18} />
              </div>
              <span className="font-extrabold text-base text-[#1e75ff]">{user.tier || 'Newcomer'}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">Tier</span>
            </div>
          </div>

          {/* Edit Profile Block */}
          <button 
            onClick={() => setView(AppView.EDIT_PROFILE)}
            className="w-full bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/60 transition-all mb-6"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                <Edit size={18} />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Edit Profile</h4>
                <p className="text-xs text-gray-400 mt-0.5">Update your information</p>
              </div>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>

          {/* Complete Profile Block */}
          <button
            onClick={() => setView(AppView.COMPLETE_PROFILE)}
            className="w-full bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/60 transition-all mb-6"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-green-500/10 p-2.5 rounded-xl text-green-400 shrink-0">
                <Settings size={18} />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Complete Profile</h4>
                <p className="text-xs text-gray-400 mt-0.5">Add email, password, and more</p>
              </div>
            </div>
            <ChevronLeft size={16} className="text-gray-400 rotate-180" />
          </button>

          {/* List Items Groups */}
          <div className="space-y-6">
            {/* Parking Details Group */}
            <div>
              <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2.5 px-1">Parking Details</h3>
              <div className="bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl divide-y divide-white/5 overflow-hidden">
                {/* Parking Space row */}
                <button 
                  onClick={() => setView(AppView.PARKING_SPACE)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Parking Space</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Manage your parking</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
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
                      <h4 className="font-bold text-white text-sm">Rentals & Listings</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Rent or share private spots</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
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
                      <h4 className="font-bold text-white text-sm">Host Dashboard</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Manage earnings & list spots</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
                </button>
                */}

                {/* Notifications row */}
                <div className="w-full p-4 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Notifications</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Manage your preferences</p>
                    </div>
                  </div>
                  
                  {/* Sliding switch */}
                  <div className="relative shrink-0 flex items-center">
                    <input 
                      type="checkbox" 
                      id="notifications-toggle"
                      className="sr-only peer" 
                      defaultChecked 
                    />
                    <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e75ff]" />
                  </div>
                </div>
              </div>
            </div>

            {/* General Details Group */}
            <div>
              <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2.5 px-1">General Details</h3>
              <div className="bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl divide-y divide-white/5 overflow-hidden">
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
                      <h4 className="font-bold text-white text-sm">Privacy Policy</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Learn how we protect you</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
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
                      <h4 className="font-bold text-white text-sm">Terms of Use</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Read our terms and conditions</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
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
                      <h4 className="font-bold text-white text-sm">Contact Us</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Get in touch with our team</p>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-gray-400 rotate-180" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-10 space-y-3.5">
            <button 
              onClick={onLogout} 
              className="w-full border border-[#1e75ff]/30 bg-transparent text-[#38bdf8] hover:bg-[#1e75ff]/10 active:scale-95 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all text-sm animate-fade-in"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
            
            <button 
              onClick={onDeleteAccount} 
              className="w-full border border-red-500/30 bg-transparent text-red-500 hover:bg-red-500/10 active:scale-95 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all text-sm animate-fade-in"
            >
              <Trash2 size={16} />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">Please log in to see your profile.</div>
      )}
    </div>
  );
};