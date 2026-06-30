import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, ChevronRight, Edit, Clock, FileText, Shield, Info, Settings, Crown, Car, MapPin } from 'lucide-react';
import { AppView } from '../types';
import { getNextTitle } from '../utils/crowns';

export const ProfileView = ({ user, onBack, setView }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentActivity, setRecentActivity] = useState<{ id: string; icon: string; action: string; address: string; timeAgo: string; reward: string | null }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchActivity = async () => {
      const now = Date.now();
      const fmt = (ms: number) => {
        const min = Math.round((now - ms) / 60000);
        if (min < 1) return 'Just now';
        if (min < 60) return `${min} min ago`;
        const hr = Math.round(min / 60);
        if (hr < 24) return `${hr} hr ago`;
        return `${Math.round(hr / 24)}d ago`;
      };

      const items: { id: string; icon: string; action: string; address: string; reward: string | null; ts: number }[] = [];

      const spotsSnap = await getDocs(query(collection(db, 'spots'), where('finderId', '==', user.id)));
      spotsSnap.docs.forEach(d => {
        const s = d.data();
        const ts = s.reportedAt?.toMillis?.() || 0;
        const addr = s.address || '';
        if (s.status === 'occupied') {
          items.push({ id: `f-${d.id}`, icon: 'crown', action: 'Helped Driver', address: addr, reward: '+2', ts });
        } else if (s.pingMode === 'later') {
          items.push({ id: `f-${d.id}`, icon: 'clock', action: 'Leaving Later', address: addr, reward: null, ts });
        } else {
          items.push({ id: `f-${d.id}`, icon: 'pin', action: 'Pinged Spot', address: addr, reward: null, ts });
        }
      });

      const fbSnap = await getDocs(query(collection(db, 'spotFeedback'), where('userId', '==', user.id)));
      fbSnap.docs.forEach(d => {
        const f = d.data();
        const ts = f.createdAt?.toMillis?.() || 0;
        items.push({ id: `d-${d.id}`, icon: 'car', action: 'Parked', address: f.address || '', reward: '+1', ts });
      });

      items.sort((a, b) => b.ts - a.ts);
      setRecentActivity(items.slice(0, 3).map(i => ({ id: i.id, icon: i.icon, action: i.action, address: i.address, reward: i.reward, timeAgo: fmt(i.ts) })));
    };
    fetchActivity();
  }, [user?.id]);

  const activityIcon = (key: string) => {
    const map: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
      crown: { icon: <Crown size={13} />, bg: 'bg-yellow-400/15', color: 'text-yellow-400' },
      car:   { icon: <Car size={13} />,   bg: 'bg-green-400/15',  color: 'text-green-400' },
      pin:   { icon: <MapPin size={13} />, bg: 'bg-[#1e75ff]/15', color: 'text-[#38bdf8]' },
      clock: { icon: <Clock size={13} />, bg: 'bg-orange-400/15', color: 'text-orange-400' },
    };
    const m = map[key] || map['pin'];
    return (
      <div className={`w-7 h-7 rounded-lg ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
        {m.icon}
      </div>
    );
  };

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
            setUploadStatus("This photo couldn't be used. Please choose a different photo.");
            setTimeout(() => setUploadStatus(''), 4000);
          }
          setIsUploading(false);
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        setUploadStatus('');
        alert('Failed to upload. Please try again.');
        setIsUploading(false);
      }
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      {user ? (
        <div className="max-w-md mx-auto flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Profile</h2>
            <button
              onClick={() => setView(AppView.SETTINGS)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Cards */}
          <div className="space-y-3">

            {/* Identity Hero Card */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="flex flex-col items-center text-center px-4 pt-6 pb-5">

                {/* Avatar */}
                <div className="relative mb-3">
                  <div className="w-[108px] h-[108px] rounded-full border-4 border-[#1e75ff] overflow-hidden shrink-0 relative bg-[var(--color-card)] flex items-center justify-center text-[var(--color-text-secondary)] shadow-lg shadow-[#1e75ff]/20">
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
                    className="absolute bottom-1 right-1 w-[31px] h-[31px] rounded-full bg-[#1e75ff] border-2 border-[var(--color-bg)] flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 active:scale-95 transition-all shadow-md"
                    aria-label="Upload photo"
                  >
                    <Edit size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>

                {/* Username */}
                <h2 className="text-xl font-extrabold text-[var(--color-text)]">{user.username || user.fullName || 'User'}</h2>

                {user.username?.startsWith('user_') && (
                  <button
                    onClick={() => setView(AppView.EDIT_PROFILE)}
                    className="mt-1.5 px-3 py-1 rounded-full bg-[#1e75ff]/15 border border-[#1e75ff]/30 text-[#38bdf8] text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Complete your profile
                  </button>
                )}

                {/* Title + Joined */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="text-sm font-bold text-[#38bdf8]">{user.title || 'Newcomer'}</span>
                  {(() => {
                    const ts = user.createdAt;
                    if (!ts) return null;
                    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
                    return <span className="text-xs text-[var(--color-text-secondary)]">· Joined {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>;
                  })()}
                </div>

                {/* Crown count with glow */}
                <div className="mt-3 flex items-center gap-1.5">
                  <Crown size={16} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
                  <span
                    className="text-base font-bold text-[var(--color-text)]"
                    style={{ textShadow: '0 0 12px rgba(250,204,21,0.25)' }}
                  >
                    {user.crowns || 0} Crown{(user.crowns || 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Motivational text */}
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-center">
                  {(user.crowns || 0) === 0
                    ? 'Ping a parking spot to earn your first Crowns.'
                    : (user.crowns || 0) < 10
                    ? 'Help another driver to become a Trusted Driver.'
                    : (user.crowns || 0) < 50
                    ? 'Keep helping your community.'
                    : "You're making a real difference for drivers."}
                </p>

                {/* Progress bar */}
                {(() => {
                  const crowns = user.crowns || 0;
                  const next = getNextTitle(crowns);
                  if (!next) return null;
                  const prevThreshold = (() => {
                    const thresholds = [0, 10, 50, 150, 400, 750, 1500, 3000];
                    for (let i = thresholds.length - 1; i >= 0; i--) {
                      if (crowns >= thresholds[i]) return thresholds[i];
                    }
                    return 0;
                  })();
                  const nextThreshold = crowns + next.crownsNeeded;
                  const range = nextThreshold - prevThreshold;
                  const progress = range > 0 ? ((crowns - prevThreshold) / range) * 100 : 0;
                  return (
                    <div className="w-full max-w-[220px] mt-3">
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#1e75ff] to-[#38bdf8] rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 text-center">
                        {next.crownsNeeded} Crown{next.crownsNeeded !== 1 ? 's' : ''} until{' '}
                        <span className="text-[#38bdf8] font-semibold">{next.title}</span>
                      </p>
                    </div>
                  );
                })()}

                {uploadStatus && (
                  <p className={`text-xs mt-2 font-semibold ${uploadStatus.includes('couldn') ? 'text-red-400' : 'text-blue-400'}`}>
                    {uploadStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Recent Activity</p>
              </div>
              {recentActivity.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-[var(--color-text-secondary)]">No recent activity yet</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 opacity-60">Start by pinging a parking spot</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {recentActivity.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      {activityIcon(item.icon)}
                      <p className="flex-1 text-xs font-semibold text-[var(--color-text)] truncate">
                        {item.action}
                        {item.address ? <span className="text-[var(--color-text-secondary)] font-normal"> · {item.address}</span> : null}
                        <span className="text-[var(--color-text-secondary)] font-normal"> · {item.timeAgo}</span>
                      </p>
                      {item.reward && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="text-xs font-bold text-yellow-400">{item.reward}</span>
                          <Crown size={11} className="text-yellow-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setView(AppView.PARKING_SPACE)}
                className="w-full py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#38bdf8] border-t border-[var(--color-border)] hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                View all activity
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Vehicle Card */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Vehicle</p>
              </div>
              <button
                onClick={() => setView(AppView.EDIT_VEHICLE)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1e75ff]/10 flex items-center justify-center text-[#38bdf8] shrink-0">
                    <Car size={18} />
                  </div>
                  <div>
                    {user.vehicleBrand || user.vehicleColor || user.vehicleType ? (
                      <p className="text-sm font-semibold text-[var(--color-text)] text-left">
                        {[user.vehicleColor, user.vehicleBrand].filter(Boolean).join(' ')}
                        {user.vehicleType ? <span className="text-[var(--color-text-secondary)] font-normal"> • {user.vehicleType}</span> : null}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--color-text)]">No vehicle added</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Add your vehicle to help drivers identify you</p>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-secondary)] shrink-0" />
              </button>
            </div>

            {/* Account Card */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Account</p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">

                <button
                  onClick={() => setView(AppView.PRIVACY_POLICY)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
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
                  <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                </button>

                <button
                  onClick={() => setView(AppView.TERMS_OF_USE)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
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
                  <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                </button>

                <button
                  onClick={() => setView(AppView.CONTACT_US)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
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
                  <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
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
