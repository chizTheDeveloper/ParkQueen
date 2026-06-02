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
    <div className="bg-gray-100 dark:bg-dark-900 font-sans text-gray-800 dark:text-white min-h-full">
      <div className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Parking Space</h1>
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-500 dark:text-gray-400">Previous Activities</h2>
        {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
        ) : activities.length === 0 ? (
            <div className="text-center p-10 text-gray-500">
                <MapPin className="mx-auto mb-4 opacity-50" size={48} />
                <p>No parking activities found.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-500 shrink-0">
                            <MapPin size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold">{activity.type === 'free' ? 'Street Parking' : 'Paid Spot'}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock size={14} /> 
                                {activity.reportedAt ? activity.reportedAt.toDate().toLocaleString() : 'Unknown time'}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${activity.status === 'claimed' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
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
