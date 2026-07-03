import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Adjust this path if needed
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { MoreVertical, Search, X, ShieldCheck, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

// --- Trust System Helpers ---

const trustScoreStyle = (score: number) => {
  if (score >= 85) return { text: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Established' };
  if (score >= 65) return { text: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',   label: 'Trusted' };
  if (score >= 40) return { text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'New' };
  return              { text: 'text-red-700',   bg: 'bg-red-50 border-red-200',     label: 'Flagged' };
};

const statFieldLabel = (statField: string) => {
  if (statField === 'handoffsCompleted') return 'Handoff Completed';
  if (statField === 'handoffsCancelledByFinder') return 'Handoff Cancelled (Finder)';
  return statField;
};

const computeTrustFlags = (stats: any, score: number) => {
  const completed = stats?.handoffsCompleted || 0;
  const cancelled = stats?.handoffsCancelledByFinder || 0;
  const total = completed + cancelled;
  const flags: { icon: React.ReactNode; label: string; severity: 'high' | 'medium' | 'low' }[] = [];

  if (total >= 3 && cancelled / total > 0.4)
    flags.push({ icon: <ShieldAlert size={14} />, label: 'High Cancellation Rate', severity: 'high' });
  if (score < 40)
    flags.push({ icon: <ShieldAlert size={14} />, label: 'Low Trust Score', severity: 'high' });
  else if (score < 65)
    flags.push({ icon: <AlertTriangle size={14} />, label: 'Below Average Trust', severity: 'medium' });
  if (total === 0)
    flags.push({ icon: <Info size={14} />, label: 'No Trust Activity Yet', severity: 'low' });
  return flags;
};

const severityStyle = { high: 'bg-red-50 text-red-700 border-red-200', medium: 'bg-yellow-50 text-yellow-700 border-yellow-200', low: 'bg-gray-50 text-gray-600 border-gray-200' };

// --- Helper Functions & Components ---

const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

const UserDetailsModal = ({ user, isOpen, onClose }) => {
  const [hostDetails, setHostDetails] = useState(null);
  const [trustEvents, setTrustEvents] = useState<any[]>([]);
  const [trustEventsLoading, setTrustEventsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user && user.role === 'Host') {
      const listingsQuery = query(collection(db, 'listings'), where('hostId', '==', user.id));
      const unsubscribe = onSnapshot(listingsQuery, (snapshot) => {
        setHostDetails({ listingCount: snapshot.size });
      }, (error) => {
          console.error("Error fetching host listings:", error);
          setHostDetails({ listingCount: 0 });
      });
      return () => unsubscribe();
    } else {
        setHostDetails(null);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !user) { setTrustEvents([]); return; }
    setTrustEventsLoading(true);
    const eventsQuery = query(
      collection(db, 'users', user.id, 'processedTrustEvents'),
      orderBy('processedAt', 'desc'),
      limit(20)
    );
    getDocs(eventsQuery)
      .then(snap => setTrustEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setTrustEvents([]))
      .finally(() => setTrustEventsLoading(false));
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const DetailItem = ({ label, value, children }: { label: string; value?: any; children?: React.ReactNode }) => (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {children ? children : <p className="text-gray-900 mt-1">{value}</p>}
    </div>
  );

  const score = user.trustScore ?? 75;
  const stats = user.trustStats || {};
  const trustStyle = trustScoreStyle(score);
  const flags = computeTrustFlags(stats, score);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <div className="flex items-center space-x-4 mb-6">
            {user.avatar ? (
              <img src={user.avatar} alt="User Avatar" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                <i className="fa-solid fa-user text-2xl"></i>
              </div>
            )}
            <div>
                <h2 className="text-2xl font-bold text-gray-800">{user.fullName || 'N/A'}</h2>
                <p className="text-md text-gray-500">{user.email}</p>
            </div>
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-gray-500 mb-3 text-sm uppercase tracking-wider">General Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailItem label="Role" value={user.role || 'Renter'} />
              <DetailItem label="Join Date" value={formatDate(user.createdAt)} />
              <DetailItem label="Status">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Suspended' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {user.status || 'Active'}
                </span>
              </DetailItem>
            </div>
          </div>

          {/* Trust Overview */}
          <div>
            <h3 className="font-bold text-gray-500 mb-3 text-sm uppercase tracking-wider">Trust Overview</h3>
            <div className={`flex items-center gap-4 p-4 rounded-lg border mb-4 ${trustStyle.bg}`}>
              <ShieldCheck size={32} className={trustStyle.text} />
              <div>
                <p className={`text-3xl font-extrabold ${trustStyle.text}`}>{score}</p>
                <p className={`text-xs font-semibold uppercase tracking-wide ${trustStyle.text}`}>{trustStyle.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              <DetailItem label="Handoffs Completed" value={stats.handoffsCompleted ?? 0} />
              <DetailItem label="Cancelled by Finder" value={stats.handoffsCancelledByFinder ?? 0} />
              <DetailItem label="Pings Created" value={stats.pingsCreated ?? 0} />
              <DetailItem label="Claims Cancelled" value={stats.claimsCancelledByClaimer ?? 0} />
              <DetailItem label="Abuse Flags" value={stats.abuseFlagCount ?? 0} />
              <DetailItem label="Rapid Cancel Strikes" value={stats.rapidCancelStrikes ?? 0} />
            </div>
          </div>

          {/* Trust Flags */}
          {flags.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-500 mb-3 text-sm uppercase tracking-wider">Trust Flags</h3>
              <div className="space-y-2">
                {flags.map((flag, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${severityStyle[flag.severity]}`}>
                    {flag.icon}
                    <span>{flag.label}</span>
                    <span className="ml-auto text-xs uppercase tracking-wide opacity-60">{flag.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trust Event Log */}
          <div>
            <h3 className="font-bold text-gray-500 mb-3 text-sm uppercase tracking-wider">Trust Events <span className="normal-case font-normal text-gray-400">(last 20)</span></h3>
            {trustEventsLoading ? (
              <p className="text-gray-400 text-sm">Loading events…</p>
            ) : trustEvents.length === 0 ? (
              <p className="text-gray-400 text-sm">No trust events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm text-left">
                  <thead><tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Reference ID</th>
                    <th className="px-3 py-2">Processed At</th>
                  </tr></thead>
                  <tbody>
                    {trustEvents.map(ev => (
                      <tr key={ev.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{statFieldLabel(ev.statField)}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{ev.source || 'user'}</td>
                        <td className="px-3 py-2 text-gray-400 font-mono text-xs truncate max-w-[140px]" title={ev.id}>{ev.id}</td>
                        <td className="px-3 py-2 text-gray-500">{formatDate(ev.processedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {user.role === 'Host' && (
            <div>
              <h3 className="font-bold text-gray-500 mb-3 text-sm uppercase tracking-wider">Parking Details</h3>
              {hostDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailItem label="Active Listings" value={hostDetails.listingCount} />
                </div>
              ) : (
                <p className="text-gray-500">Loading host details...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EditUserModal = ({ user, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<{ fullName?: string; role?: string }>({});

  useEffect(() => {
    if (user) {
      setFormData({ fullName: user.fullName || '', role: user.role || 'Renter' });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = (e) => { e.preventDefault(); onSave(user.id, formData); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit User</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" name="fullName" id="fullName" value={formData.fullName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" id="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option>Renter</option><option>Host</option><option>Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const userRole = user.role || 'Renter';
    const matchesRole = roleFilter === 'All' || userRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAction = async (action, user) => {
    setOpenMenu(null);
    setSelectedUser(user);
    if (action === 'view') setViewModalOpen(true);
    else if (action === 'edit') setEditModalOpen(true);
    else if (action === 'suspend') {
      const userRef = doc(db, 'users', user.id);
      const newStatus = (user.status || 'Active') === 'Active' ? 'Suspended' : 'Active';
      await updateDoc(userRef, { status: newStatus });
    } else if (action === 'toggleRole') {
      const userRef = doc(db, 'users', user.id);
      const newRole = (user.role || 'Renter') === 'Renter' ? 'Host' : 'Renter';
      await updateDoc(userRef, { role: newRole });
    }
  };

  const handleUpdateUser = async (userId, updatedData) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updatedData);
    setEditModalOpen(false);
  };

  const renderTableBody = () => {
    if (loading) return (
      <>
        {[1,2,3,4,5].map(i => (
          <tr key={i} className="border-b border-gray-100 px-4 py-3">
             <td className="p-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div></td>
             <td className="p-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div></td>
             <td className="p-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div></td>
             <td className="p-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div></td>
             <td className="p-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-16"></div></td>
             <td className="p-4"><div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse mx-auto"></div></td>
          </tr>
        ))}
      </>
    );
    if (filteredUsers.length === 0) return <tr><td colSpan={6} className="text-center p-8">No user profiles found in the database.</td></tr>;
    return filteredUsers.map((user) => (
      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="p-4 font-medium text-gray-800">{user.fullName || (user.email ? user.email.split('@')[0] : 'Anonymous User')}</td>
        <td className="p-4 text-gray-600">{user.email}</td>
        <td className="p-4 text-gray-600">{user.role || 'Renter'}</td>
        <td className="p-4 text-gray-600">{formatDate(user.createdAt)}</td>
        <td className="p-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Suspended' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{user.status || 'Active'}</span></td>
        <td className="p-4 text-center relative">
          <button onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)} className="p-2 rounded-full hover:bg-gray-200"><MoreVertical size={20} /></button>
          {openMenu === user.id && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl z-10 border border-gray-100">
              <button onClick={() => handleAction('view', user)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">View Details</button>
              <button onClick={() => handleAction('toggleRole', user)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Make {(user.role || 'Renter') === 'Renter' ? 'Host' : 'Renter'}</button>
              <button onClick={() => handleAction('edit', user)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit User</button>
              <button onClick={() => handleAction('suspend', user)} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-gray-100">{user.status === 'Suspended' ? 'Unsuspend' : 'Suspend'}</button>
            </div>
          )}
        </td>
      </tr>
    ));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 w-full max-w-md">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by name or email..." className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 outline-none">
               <option value="All">All Roles</option>
               <option value="Renter">Renters</option>
               <option value="Host">Hosts</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left"><thead><tr className="text-sm font-semibold text-gray-500 bg-gray-50"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Join Date</th><th className="p-4">Status</th><th className="p-4 text-center">Actions</th></tr></thead>
            <tbody>{renderTableBody()}</tbody>
          </table>
        </div>
      </div>
      <UserDetailsModal user={selectedUser} isOpen={isViewModalOpen} onClose={() => setViewModalOpen(false)} />
      <EditUserModal user={selectedUser} isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSave={handleUpdateUser} />
    </div>
  );
};
