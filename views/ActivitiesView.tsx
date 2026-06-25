import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const ActivitiesView = ({ user, onBack }: { user: any, onBack: () => void }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchActivities = async () => {
      try {
        const q = query(
          collection(db, 'spots'),
          where('finderId', '==', user.id)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort client side
        data.sort((a: any, b: any) => b.reportedAt?.toMillis() - a.reportedAt?.toMillis());
        setActivities(data);
      } catch (err) {
        console.error("Error fetching activities", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [user]);

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Parking Space</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage your active and past parking spot pings</p>
        </div>
      </div>

      <div>
        <h2 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-3 px-1">Previous Activities</h2>
        {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
        ) : activities.length === 0 ? (
            <div className="text-center p-10 text-gray-500 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl">
                <MapPin className="mx-auto mb-3.5 text-gray-500 opacity-80" size={32} />
                <p className="text-sm">No parking activities found.</p>
            </div>
        ) : (
            <div className="space-y-3">
                {activities.map((activity) => (
                    <div key={activity.id} className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:bg-[#0b2240]/60 relative">
                        <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[var(--color-text)] text-base truncate">{activity.type === 'free' ? 'Street Parking' : 'Paid Spot'}</h3>
                            <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5 mt-1">
                                <Clock size={13} className="text-gray-500 shrink-0" /> 
                                <span>{activity.reportedAt ? activity.reportedAt.toDate().toLocaleString() : 'Unknown time'}</span>
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                activity.status === 'claimed' 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                    : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                                {activity.status || 'available'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
