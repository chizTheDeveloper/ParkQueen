import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, ChevronRight, Edit, Clock, FileText, Shield, Info, Settings, Crown, MapPin, Handshake, ParkingSquare } from 'lucide-react';
import { VehicleIcon } from '../utils/vehicleIcon';
import { AppView } from '../types';
import { getNextTitle, getTierForCrowns, TIER_VISUALS } from '../utils/crowns';
import { CrownBadge } from '../utils/CrownBadge';

export const ProfileView = ({ user, onBack, setView }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentActivity, setRecentActivity] = useState<{ id: string; icon: string; action: string; address: string; timeAgo: string; reward: string | null }[]>([]);
  const [showCrownsInfo, setShowCrownsInfo] = useState(false);

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
          items.push({ id: `f-${d.id}`, icon: 'handshake', action: 'Helped Driver', address: addr, reward: '+2', ts });
        } else if (s.pingMode === 'later') {
          items.push({ id: `f-${d.id}`, icon: 'clock', action: 'Scheduled departure', address: addr, reward: null, ts });
        } else {
          items.push({ id: `f-${d.id}`, icon: 'pin', action: 'Shared a spot', address: addr, reward: null, ts });
        }
      });

      const fbSnap = await getDocs(query(collection(db, 'spotFeedback'), where('userId', '==', user.id)));
      fbSnap.docs.forEach(d => {
        const f = d.data();
        const ts = f.createdAt?.toMillis?.() || 0;
        items.push({ id: `d-${d.id}`, icon: 'parking', action: 'Parked', address: f.address || '', reward: '+1', ts });
      });

      items.sort((a, b) => b.ts - a.ts);
      setRecentActivity(items.slice(0, 3).map(i => ({ id: i.id, icon: i.icon, action: i.action, address: i.address, reward: i.reward, timeAgo: fmt(i.ts) })));
    };
    fetchActivity();
  }, [user?.id]);

  const activityIcon = (key: string) => {
    const map: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
      handshake: { icon: <Handshake size={13} />, bg: 'bg-yellow-400/15', color: 'text-yellow-400' },
      parking:   { icon: <ParkingSquare size={13} />, bg: 'bg-green-400/15', color: 'text-green-400' },
      pin:       { icon: <MapPin size={13} />, bg: 'bg-[#1e75ff]/15', color: 'text-[#38bdf8]' },
      clock:     { icon: <Clock size={13} />, bg: 'bg-orange-400/15', color: 'text-orange-400' },
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
        setUploadStatus('Reviewing photo — this may take a moment');

        const moderationRef = doc(db, 'avatarModeration', user.id);
        const timeout = setTimeout(() => {
          unsub();
          setUploadStatus('Photo check timed out — please try again.');
          setIsUploading(false);
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
        setUploadStatus('Upload failed — please try again.');
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
              aria-label="Settings"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1e75ff]/10 border border-[#1e75ff]/20 text-[#38bdf8] hover:bg-[#1e75ff]/20 active:scale-95 transition-all shrink-0"
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

                {/* Crown badge + title */}
                {(() => {
                  const crowns = user.crowns || 0;
                  const tier = getTierForCrowns(crowns);
                  const visual = TIER_VISUALS[tier];
                  return (
                    <div className="mt-3 flex flex-col items-center gap-1.5">
                      <CrownBadge tier={tier} size={40} />
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        <span className="text-sm font-bold" style={{ color: visual.textColor }}>
                          {user.title || 'Newcomer'}
                        </span>
                        {(() => {
                          const ts = user.createdAt;
                          if (!ts) return null;
                          const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
                          return <span className="text-xs text-[var(--color-text-secondary)]">· Joined {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>;
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-text)]">
                        <Crown size={14} className="text-yellow-400" />
                        <span>{crowns} Crown{crowns !== 1 ? 's' : ''}</span>
                        <button
                          onClick={() => setShowCrownsInfo(true)}
                          aria-label="What are crowns?"
                          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors active:scale-90"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Progress bar + next title */}
                {(() => {
                  const crowns = user.crowns || 0;
                  const next = getNextTitle(crowns);
                  if (!next) return (
                    <p className="text-xs font-bold text-[#38bdf8] mt-2">Urban Legend — max rank achieved</p>
                  );
                  const prevThreshold = (() => {
                    const thresholds = [0, 10, 50, 150, 400, 750, 1500, 3000];
                    for (let i = thresholds.length - 1; i >= 0; i--) {
                      if (crowns >= thresholds[i]) return thresholds[i];
                    }
                    return 0;
                  })();
                  const range = (crowns + next.crownsNeeded) - prevThreshold;
                  const progress = range > 0 ? ((crowns - prevThreshold) / range) * 100 : 0;
                  return (
                    <div className="w-full max-w-[240px] mt-3">
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            background: 'linear-gradient(90deg, #1e75ff, #38bdf8)',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        <Crown size={13} className="text-yellow-400" />
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          <span className="font-bold text-[var(--color-text)]">{next.crownsNeeded}</span> crowns until{' '}
                          <span className="font-bold" style={{ color: TIER_VISUALS[next.tier].textColor }}>{next.title}</span>
                        </p>
                      </div>
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
                  <div className="shrink-0 flex items-center justify-center w-9">
                    <VehicleIcon type={user.vehicleType} color={user.vehicleColor} size={24} />
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

      {/* Crowns info modal */}
      {showCrownsInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCrownsInfo(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-yellow-400 shrink-0" />
              <h3 className="text-base font-extrabold text-[var(--color-text)]">Crowns</h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Crowns show how helpful you are in the ParQueen community. Earn crowns by sharing useful spots and confirming parking outcomes.
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              More crowns can unlock higher community titles over time.
            </p>
            <button
              onClick={() => setShowCrownsInfo(false)}
              className="w-full py-3 rounded-xl bg-white/8 border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-white/12 active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
