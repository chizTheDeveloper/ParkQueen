import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Adjust this path if needed
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { MoreVertical, Search, X } from 'lucide-react';

// --- Helper Functions & Components ---

const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

const UserDetailsModal = ({ user, isOpen, onClose }) => {
  const [hostDetails, setHostDetails] = useState(null);

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

  if (!isOpen || !user) return null;

  const DetailItem = ({ label, value, children }) => (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {children ? children : <p className="text-gray-900 mt-1">{value}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <div className="flex items-center space-x-4 mb-6">
            <img src={user.avatar || `https://i.pravatar.cc/64?u=${user.id}`} alt="User Avatar" className="w-16 h-16 rounded-full" />
            <div>
                <h2 className="text-2xl font-bold text-gray-800">{user.fullName || 'N/A'}</h2>
                <p className="text-md text-gray-500">{user.email}</p>
            </div>
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-gray-500 dark:text-gray-400 mb-3 text-sm uppercase tracking-wider">General Details</h3>
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
          {user.role === 'Host' && (
            <div>
              <h3 className="font-bold text-gray-500 dark:text-gray-400 mb-3 text-sm uppercase tracking-wider">Parking Details</h3>
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
  const [formData, setFormData] = useState({});

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

  const filteredUsers = users.filter(user => 
    (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async (action, user) => {
    setOpenMenu(null);
    setSelectedUser(user);
    if (action === 'view') setViewModalOpen(true);
    else if (action === 'edit') setEditModalOpen(true);
    else if (action === 'suspend') {
      const userRef = doc(db, 'users', user.id);
      const newStatus = (user.status || 'Active') === 'Active' ? 'Suspended' : 'Active';
      await updateDoc(userRef, { status: newStatus });
    }
  };

  const handleUpdateUser = async (userId, updatedData) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updatedData);
    setEditModalOpen(false);
  };

  const renderTableBody = () => {
    if (loading) return <tr><td colSpan={6} className="text-center p-8">Loading users...</td></tr>;
    if (filteredUsers.length === 0) return <tr><td colSpan={6} className="text-center p-8">No user profiles found in the database.</td></tr>;
    return filteredUsers.map((user) => (
      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="p-4 font-medium text-gray-800">{user.fullName || 'N/A'}</td>
        <td className="p-4 text-gray-600">{user.email}</td>
        <td className="p-4 text-gray-600">{user.role || 'Renter'}</td>
        <td className="p-4 text-gray-600">{formatDate(user.createdAt)}</td>
        <td className="p-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'Suspended' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{user.status || 'Active'}</span></td>
        <td className="p-4 text-center relative">
          <button onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)} className="p-2 rounded-full hover:bg-gray-200"><MoreVertical size={20} /></button>
          {openMenu === user.id && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl z-10 border border-gray-100">
              <button onClick={() => handleAction('view', user)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">View Details</button>
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
          <div className="relative w-full max-w-xs">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or email..." className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
