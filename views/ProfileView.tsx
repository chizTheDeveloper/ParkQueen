import React, { useState } from 'react';
import { Star, MapPin, Calendar, Settings, Edit2, X, Moon, Sun, ChevronRight, User, Mail, Bell, Shield, LogOut, ArrowLeft } from 'lucide-react';

const MOCK_PROFILE = {
  id: 'me',
  username: 'QueenBee',
  fullName: 'Jessica Miller',
  bio: 'NYC Native. Always know the best parking spots in SoHo. Drive a Honda Civic.',
  avatarUrl: 'https://i.pravatar.cc/300?u=me',
  rating: 4.8,
  reviewCount: 24,
  joinedDate: 'Mar 2023',
  reviews: [
    { id: 'r1', reviewerName: 'James', rating: 5, comment: 'Great guest, left the garage spotless.', date: new Date('2023-11-15') },
    { id: 'r2', reviewerName: 'Alex', rating: 5, comment: 'Thanks for the spot ping!', date: new Date('2023-12-01') },
    { id: 'r3', reviewerName: 'DriverX', rating: 4, comment: 'Good communication.', date: new Date('2024-01-10') },
  ]
};

export const ProfileView = ({ theme, toggleTheme, onBack }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState(MOCK_PROFILE);

  const renderSettingsModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center transition-opacity animate-in fade-in duration-300">
      <div className="bg-white dark:bg-dark-800 w-full max-w-lg sm:rounded-[32px] rounded-t-[40px] p-8 shadow-2xl border-t sm:border border-dark-200 dark:border-dark-700 animate-in slide-in-from-bottom-10 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h2>
          <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-100 dark:bg-dark-700 rounded-full text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-dark-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {/* Theme Toggle */}
          <div className="group">
             <label className="text-[10px] uppercase font-black text-slate-400 dark:text-gray-500 tracking-[0.2em] mb-3 block">Appearance</label>
             <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-dark-900/50 rounded-2xl border border-slate-200 dark:border-dark-700 hover:border-queen-500 transition-all"
             >
                <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-queen-50 dark:bg-queen-900/20 text-queen-600 dark:text-queen-400 rounded-xl">
                      {theme === 'dark' ? <Moon size={22} /> : <Sun size={22} />}
                   </div>
                   <div className="text-left">
                      <div className="font-bold text-slate-900 dark:text-white">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-500">Currently active</div>
                   </div>
                </div>
                <div className={`w-14 h-8 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-queen-600' : 'bg-slate-300'}`}>
                   <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
             </button>
          </div>

          {/* Account Settings */}
          <div className="space-y-3">
             <label className="text-[10px] uppercase font-black text-slate-400 dark:text-gray-500 tracking-[0.2em] mb-1 block">Account</label>
             {[
               { icon: User, label: 'Personal Information', sub: 'Edit name and bio' },
               { icon: Mail, label: 'Email Address', sub: 'jess.miller@gmail.com' },
               { icon: Bell, label: 'Notifications', sub: 'Sound and alerts' },
               { icon: Shield, label: 'Privacy & Security', sub: 'Manage your data' },
             ].map((item, i) => (
                <button key={i} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-dark-900/50 rounded-2xl border border-slate-200 dark:border-dark-700 hover:border-queen-500 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-slate-200 dark:bg-dark-800 text-slate-600 dark:text-gray-400 rounded-xl group-hover:bg-queen-500 group-hover:text-white transition-colors">
                         <item.icon size={20} />
                      </div>
                      <div className="text-left">
                         <div className="font-bold text-slate-900 dark:text-white text-sm">{item.label}</div>
                         <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">{item.sub}</div>
                      </div>
                   </div>
                   <ChevronRight size={18} className="text-slate-400 dark:text-gray-600 group-hover:translate-x-1 transition-transform" />
                </button>
             ))}
          </div>
          
          <button className="w-full flex items-center justify-center gap-3 p-5 rounded-3xl text-red-500 font-black text-sm uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors mt-4">
             <LogOut size={20} />
             Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-dark-900 overflow-y-auto no-scrollbar pt-6 pb-24 transition-colors duration-300">
      {showSettings && renderSettingsModal()}

      {/* Header Actions */}
      <div className="px-6 flex items-center justify-between mb-8">
        {onBack && (
          <button onClick={onBack} className="p-3 bg-slate-100 dark:bg-dark-800 rounded-2xl text-slate-500 dark:text-gray-400 hover:text-queen-600 dark:hover:text-white border border-slate-200 dark:border-dark-700 transition-all">
            <ArrowLeft size={24} />
          </button>
        )}
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-slate-100 dark:bg-dark-800 rounded-2xl text-slate-500 dark:text-gray-400 hover:text-queen-600 dark:hover:text-white hover:bg-white dark:hover:bg-dark-700 shadow-sm border border-slate-200 dark:border-dark-700 transition-all"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Profile Header */}
      <div className="px-6 mb-8">
        <div className="flex justify-between items-start mb-6">
           <div className="relative">
             <div className="w-28 h-28 rounded-[40px] overflow-hidden border-4 border-slate-50 dark:border-dark-800 shadow-2xl ring-1 ring-slate-200 dark:ring-white/10">
               <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
             </div>
             <button className="absolute -bottom-2 -right-2 bg-queen-600 p-2.5 rounded-2xl border-4 border-white dark:border-dark-900 text-white shadow-lg active:scale-90 transition-transform">
               <Edit2 size={16} strokeWidth={3} />
             </button>
           </div>
        </div>
        
        <div className="mb-6">
           <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{profile.fullName}</h2>
           <div className="flex items-center gap-2 mt-1">
             <span className="text-queen-600 dark:text-queen-400 text-sm font-black uppercase tracking-widest">@{profile.username}</span>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-dark-700" />
             <span className="text-slate-400 dark:text-gray-500 text-xs font-bold">New York City</span>
           </div>
        </div>
        
        <div className="flex items-center gap-6 py-4 border-y border-slate-100 dark:border-dark-800">
           <div className="flex items-center gap-2">
             <div className="bg-yellow-400/10 p-1.5 rounded-lg">
                <Star className="text-yellow-500 fill-current" size={18} />
             </div>
             <div>
                <div className="text-slate-900 dark:text-white font-black text-sm">{profile.rating}</div>
                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-tighter">{profile.reviewCount} Reviews</div>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <div className="bg-queen-500/10 p-1.5 rounded-lg">
                <Calendar className="text-queen-600 dark:text-queen-400" size={18} />
             </div>
             <div>
                <div className="text-slate-900 dark:text-white font-black text-sm">{profile.joinedDate}</div>
                <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-tighter">Joined Date</div>
             </div>
           </div>
        </div>

        <p className="mt-6 text-slate-600 dark:text-gray-400 leading-relaxed text-sm font-medium">
          {profile.bio}
        </p>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { label: 'Pinged', val: '12' },
            { label: 'Rentals', val: '8' },
            { label: 'Rating', val: '4.9' },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-50 dark:bg-dark-800 rounded-3xl p-4 text-center border border-slate-100 dark:border-dark-700 shadow-sm">
               <div className="text-2xl font-black text-slate-900 dark:text-white">{stat.val}</div>
               <div className="text-[9px] uppercase text-slate-400 dark:text-gray-500 font-black tracking-widest mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-6">
           <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Recent Activity</h3>
           <button className="text-queen-600 text-xs font-black uppercase tracking-widest">See All</button>
        </div>
        <div className="space-y-4">
           {profile.reviews.map(review => (
             <div key={review.id} className="bg-slate-50 dark:bg-dark-800 p-5 rounded-3xl border border-slate-100 dark:border-dark-700 shadow-sm transition-transform active:scale-[0.98]">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-queen-600 to-cyan-500 flex items-center justify-center text-sm font-black text-white shadow-md">
                        {review.reviewerName[0]}
                      </div>
                      <div>
                        <span className="font-black text-sm text-slate-900 dark:text-white">{review.reviewerName}</span>
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">{review.date.toLocaleDateString()}</div>
                      </div>
                   </div>
                   <div className="flex gap-0.5 bg-white dark:bg-dark-700 px-2 py-1 rounded-lg">
                     {[...Array(5)].map((_, i) => (
                       <Star key={i} size={10} className={i < review.rating ? "text-yellow-400 fill-current" : "text-slate-200 dark:text-dark-600"} />
                     ))}
                   </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-gray-300 italic font-medium leading-relaxed">"{review.comment}"</p>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
