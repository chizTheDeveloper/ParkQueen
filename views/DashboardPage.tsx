import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Bell } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, getCountFromServer, where, orderBy, limit, Timestamp } from 'firebase/firestore';

const MetricCard = ({ icon, title, value, trend, isWarning }) => (
  <div className="bg-white p-4 rounded-xl shadow-md flex items-start gap-4">
    <div className={`p-2 rounded-full ${isWarning ? 'bg-red-100' : 'bg-blue-100'}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {trend && <p className={`text-xs ${trend.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{trend}</p>}
      {isWarning && <p className="text-xs text-red-500 font-semibold">Action Required</p>}
    </div>
  </div>
);

export const DashboardPage = () => {
  const [stats, setStats] = useState({
    activeSpots: 0,
    totalUsers: 0,
    transactionVolume: 0,
    activeDisputes: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [flaggedListings, setFlaggedListings] = useState([]);

  useEffect(() => {
    if (!db) return;

    // --- Aggregate Stats ---

    const fetchData = async () => {
      try {
        // Total Users
        const usersCol = collection(db, 'users');
        const userSnapshot = await getCountFromServer(usersCol);
        setStats(prev => ({ ...prev, totalUsers: userSnapshot.data().count }));

        // Active Spots (assuming 'spots' collection holds active ones)
        const spotsCol = collection(db, 'spots');
        const spotSnapshot = await getCountFromServer(spotsCol);
        setStats(prev => ({ ...prev, activeSpots: spotSnapshot.data().count }));

        // Active Disputes
        const disputesQuery = query(collection(db, 'disputes'), where('status', '==', 'open'));
        const disputeSnapshot = await getCountFromServer(disputesQuery);
        setStats(prev => ({ ...prev, activeDisputes: disputeSnapshot.data().count }));
      } catch (error) {
        console.error("Error fetching aggregate counts:", error);
      }
    };

    fetchData();
    
    // --- Real-time Subscriptions ---

    // Transaction Volume (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('timestamp', '>=', thirtyDaysAgoTimestamp)
    );
    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      let totalVolume = 0;
      snapshot.forEach(doc => {
        totalVolume += doc.data().amount || 0;
      });
      setStats(prev => ({ ...prev, transactionVolume: totalVolume }));
    }, error => console.error("Error fetching transactions:", error));

    // Recent Registrations
    const recentUsersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
    const unsubUsers = onSnapshot(recentUsersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentRegistrations(users);
    }, error => console.error("Error fetching recent users:", error));

    // Flagged Listings
    const flaggedListingsQuery = query(collection(db, 'listings'), where('isFlagged', '==', true), limit(5));
    const unsubListings = onSnapshot(flaggedListingsQuery, (snapshot) => {
      const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlaggedListings(listings);
    }, error => console.error("Error fetching flagged listings:", error));

    // Cleanup subscriptions on unmount
    return () => {
      unsubTransactions();
      unsubUsers();
      unsubListings();
    };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<Users size={24} className="text-blue-500" />} title="Active Spots" value={stats.activeSpots.toLocaleString()} />
        <MetricCard icon={<Users size={24} className="text-blue-500" />} title="Total Users" value={stats.totalUsers.toLocaleString()} />
        <MetricCard icon={<DollarSign size={24} className="text-blue-500" />} title="Transaction Volume (30d)" value={`$${stats.transactionVolume.toLocaleString()}`} />
        <MetricCard icon={<Bell size={24} className="text-red-500" />} title="Active Disputes" value={stats.activeDisputes.toLocaleString()} isWarning={stats.activeDisputes > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent New User Registrations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm text-gray-500">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Role</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">{user.fullName || 'N/A'}</td>
                    <td className="py-3 px-4 text-gray-600">{user.role || 'Renter'}</td>
                    <td className="py-3 px-4"><span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">Active</span></td>
                    <td className="py-3 px-4"><button className="font-semibold text-blue-600 hover:underline">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Flagged Listings</h2>
          <div className="space-y-4">
            {flaggedListings.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={listing.thumbnail || 'https://via.placeholder.com/40'} alt="Listing" className="h-10 w-10 rounded-lg object-cover" />
                  <div>
                    <p className="font-semibold text-gray-700">{listing.address || 'No Address'}</p>
                    <p className="text-xs text-gray-500">{listing.reason || 'No reason given'}</p>
                  </div>
                </div>
                <button className="text-sm font-semibold text-blue-600 hover:underline">Review</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
