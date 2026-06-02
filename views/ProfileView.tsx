import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Edit, FileText, Bell, Shield, Info, LogOut, Trash2, Camera, Trophy, Flame, Star } from 'lucide-react';
import { AppView } from '../types';

const ProfileButton = ({ icon, label, onClick, isSwitch = false, isDestructive = false }: { icon: any, label: string, onClick?: () => void, isSwitch?: boolean, isDestructive?: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
      isDestructive
        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
        : 'bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700'
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`text-gray-500 dark:text-gray-400 ${isDestructive ? 'text-red-500' : ''}`}>{icon}</div>
      <span className={`font-semibold ${isDestructive ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>{label}</span>
    </div>
    {isSwitch ? (
        <div className="relative">
            <input type="checkbox" onChange={onClick} className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 dark:bg-dark-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-dark-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
        </div>
    ) : (
      !isDestructive && <ChevronLeft size={20} className="text-gray-400 transform rotate-180" />
    )}
  </button>
);

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
    <div className="bg-gray-100 dark:bg-dark-900 font-sans text-gray-800 dark:text-white">
      <div className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="p-6">
        {user ? (
          <>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-4 group">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-24 h-24 rounded-full border-4 border-blue-200 dark:border-blue-800 object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-blue-200 dark:border-blue-800 bg-gray-200 dark:bg-dark-700 flex items-center justify-center text-gray-400">
                    <i className="fa-solid fa-user text-4xl"></i>
                  </div>
                )}
                <button onClick={triggerUpload} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity">
                  {isUploading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div> : <Camera size={32}/>}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
              <h2 className="text-2xl font-bold">{user.fullName}</h2>
              <p className="text-gray-500 dark:text-gray-400">{user.email}</p>

              {/* Gamification Stats */}
              <div className="flex items-center justify-center gap-6 mt-6 bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 w-full max-w-sm mx-auto">
                <div className="flex flex-col items-center">
                  <Trophy className="text-yellow-500 mb-1" size={24} />
                  <span className="font-bold text-lg">{user.reputationScore || 0}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Reputation</span>
                </div>
                <div className="w-px h-10 bg-gray-200 dark:bg-dark-700"></div>
                <div className="flex flex-col items-center">
                  <Flame className="text-orange-500 mb-1" size={24} />
                  <span className="font-bold text-lg">{user.currentStreak || 0}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Streak</span>
                </div>
                <div className="w-px h-10 bg-gray-200 dark:bg-dark-700"></div>
                <div className="flex flex-col items-center">
                  <Star className="text-queen-500 mb-1" size={24} />
                  <span className="font-bold text-lg text-queen-500">{user.tier || 'Newcomer'}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Tier</span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <ProfileButton icon={<Edit size={20} />} label="Edit Profile" onClick={() => setView(AppView.EDIT_PROFILE)} />
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-gray-500 dark:text-gray-400 mb-2">Parking Details</h3>
                <div className="space-y-3">
                  <ProfileButton icon={<FileText size={20} />} label="Parking Space" onClick={() => setView(AppView.PARKING_SPACE)} />
                  <ProfileButton icon={<Bell size={20} />} label="Notification" isSwitch={true} />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-500 dark:text-gray-400 mb-2">General Details</h3>
                <div className="space-y-3">
                  <ProfileButton icon={<Shield size={20} />} label="Privacy Policy" onClick={() => setView(AppView.PRIVACY_POLICY)} />
                  <ProfileButton icon={<Info size={20} />} label="Terms of Use" onClick={() => setView(AppView.TERMS_OF_USE)} />
                  <ProfileButton icon={<FileText size={20} />} label="Contact Us" onClick={() => setView(AppView.CONTACT_US)} />
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-4">
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 bg-transparent text-gray-600 dark:text-gray-300 font-bold py-3.5 rounded-xl border-2 border-gray-300 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <LogOut size={20} />
                Logout
              </button>
              
              <button onClick={onDeleteAccount} className="w-full flex items-center justify-center gap-3 bg-red-500/10 text-red-500 font-bold py-3.5 rounded-xl border-2 border-transparent hover:border-red-500/50 hover:bg-red-500/20 transition-all">
                <Trash2 size={20} />
                Delete Account
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">Please log in to see your profile.</div>
        )}
      </div>
    </div>
  );
};