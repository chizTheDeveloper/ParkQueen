import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { MoreVertical, Search, X, ShieldCheck, Flag, Check, XCircle } from 'lucide-react';

const mockApprovalQueue = [
  { id: 'aq1', address: '123 Fake St Driveway', hostName: 'Brian K.', pricePerHour: 15, thumbnail: 'https://images.unsplash.com/photo-1590634628863-7c5ef4c1775f?w=150&q=80', status: 'Pending Review' },
  { id: 'aq2', address: 'Secure Basement Garage Manhattan', hostName: 'Lisa M.', pricePerHour: 25, thumbnail: 'https://plus.unsplash.com/premium_photo-1661962386290-7cb756a2bb03?w=150&q=80', status: 'Pending Review' }
];

const mockReportedSpots = [
  { id: 'rs1', location: '45th & 3rd Ave', reportedBy: 'user_992', reason: 'Hydrant blocking spot', time: '2 hours ago' },
  { id: 'rs2', location: 'Park Slope 11th St', reportedBy: 'anon_driver', reason: 'Spot already taken when I arrived', time: '5 hours ago' }
];

const ListingDetailsModal = ({ listing, isOpen, onClose }) => {
  if (!isOpen || !listing) return null;
  const DetailItem = ({ label, value, children }: { label: string, value?: string | number, children?: React.ReactNode }) => (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {children ? children : <p className="text-gray-900 mt-1">{value}</p>}
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-2"><X size={20} /></button>
        <div className="flex items-center space-x-5 mb-8 pt-2">
            <img src={listing.image || listing.thumbnail || `https://via.placeholder.com/150`} alt="Listing Cover" className="w-28 h-28 rounded-xl object-cover shadow-sm bg-gray-200" />
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{listing.title || listing.address || 'Unnamed Listing'}</h2>
                <p className="text-md text-blue-600 font-semibold mt-1">${listing.pricePerHour || 0}/hr <span className="text-gray-500 font-normal"> • Host: {listing.hostName || listing.hostId || 'Unknown'}</span></p>
                <span className={`inline-block mt-3 px-3 py-1 text-xs font-semibold rounded-full ${listing.isFlagged || listing.status === 'Suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {listing.isFlagged || listing.status === 'Suspended' ? 'Flagged / Suspended' : 'Active'}
                </span>
            </div>
        </div>
        <div className="space-y-8">
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
            <h3 className="font-bold text-gray-500 mb-4 text-xs uppercase tracking-wider">General Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailItem label="Vehicle Type" value={listing.vehicleType || 'Any'} />
              <DetailItem label="Parking Type" value={listing.parkingType || 'Unknown'} />
              {listing.reason && <DetailItem label="Flag Reason" value={listing.reason} />}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wider">Description & Amenities</h3>
            <p className="text-gray-700 text-sm mb-4 leading-relaxed">{listing.description || 'No description provided by host.'}</p>
            {listing.amenities && listing.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {listing.amenities.map((a: string) => <span key={a} className="text-xs font-medium tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1.5 rounded-md">{a}</span>)}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ListingsPage = () => {
  const [activeTab, setActiveTab] = useState<'Active' | 'Approval' | 'Reported'>('Active');
  
  // Real Data State
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI State
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);

  // Mock State for other tabs
  const [approvalQueue, setApprovalQueue] = useState(mockApprovalQueue);
  const [reportedSpots, setReportedSpots] = useState(mockReportedSpots);
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);

  useEffect(() => {
    const listingsQuery = query(collection(db, 'listings'));
    const unsubscribe = onSnapshot(listingsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(data);
      setLoading(false);
    }, (error) => {
        console.error(error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async (action: string, listing: any) => {
    setOpenMenu(null);
    setSelectedListing(listing);
    
    if (action === 'view') {
        setViewModalOpen(true);
    } else if (action === 'flag') {
      const ref = doc(db, 'listings', listing.id);
      const currentlyFlagged = listing.isFlagged === true || listing.status === 'Suspended';
      await updateDoc(ref, { 
          isFlagged: !currentlyFlagged, 
          status: currentlyFlagged ? 'Active' : 'Suspended',
          ...(currentlyFlagged && { reason: '' })
      });
    } else if (action === 'delete') {
      if (window.confirm("Are you sure you want to permanently delete this listing?")) {
        await deleteDoc(doc(db, 'listings', listing.id));
      }
    }
  };

  const handleApprove = (id: string) => {
      setApprovalQueue(approvalQueue.filter(i => i.id !== id));
      alert("Listing Approved & Published!");
  };

  const handleReject = (id: string) => {
      setApprovalQueue(approvalQueue.filter(i => i.id !== id));
      alert("Listing Rejected. Host notified.");
  };

  const handleDismissReport = (id: string) => {
      setReportedSpots(reportedSpots.filter(r => r.id !== id));
  };

  const handleToggleApprovalSelect = (id: string) => {
      setSelectedApprovalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const handleSelectAllApproval = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) setSelectedApprovalIds(approvalQueue.map(i => i.id));
      else setSelectedApprovalIds([]);
  };

  const handleBatchApprove = () => {
      setApprovalQueue(approvalQueue.filter(i => !selectedApprovalIds.includes(i.id)));
      setSelectedApprovalIds([]);
      alert(`${selectedApprovalIds.length} listings approved!`);
  };

  const handleBlacklist = (id: string) => {
      setReportedSpots(reportedSpots.filter(r => r.id !== id));
      alert("GPS Coordinates blacklisted.");
  };


  const renderActiveTable = () => {
    const filteredListings = listings.filter(listing => {
        const title = (listing.title || listing.address || '').toLowerCase();
        return title.includes(searchTerm.toLowerCase());
    });
    
    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-sm font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="p-4 pl-6">Listing Detail</th>
                        <th className="p-4">Host</th><th className="p-4">Type</th>
                        <th className="p-4">Price</th><th className="p-4">Verif. Status</th>
                        <th className="p-4 text-center pr-6">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loading && (
                      <>
                        {[1, 2, 3].map((i) => (
                          <tr key={i} className="border-b border-gray-50"><td colSpan={6} className="p-4"><div className="h-10 bg-gray-200 rounded-lg animate-pulse w-full"></div></td></tr>
                        ))}
                      </>
                    )}
                    {!loading && filteredListings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12">
                          <div className="text-center">
                              <Search className="mx-auto mb-4 text-gray-300" size={48} />
                              <h3 className="text-lg font-medium text-gray-900">No active listings found</h3>
                              <p className="text-gray-500 mb-4">Try adjusting your filters or search terms.</p>
                              <button onClick={() => setSearchTerm('')} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors">Clear Filters</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading && filteredListings.map(listing => {
                      const isFlagged = listing.isFlagged === true || listing.status === 'Suspended';
                      return (
                        <tr key={listing.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 pl-6">
                                <div className="flex items-center gap-3">
                                    <img src={listing.image || listing.thumbnail || `https://via.placeholder.com/40`} alt="Thumb" className="w-10 h-10 rounded-lg object-cover bg-gray-200 shadow-sm" />
                                    <span className="font-semibold text-gray-800 line-clamp-1 max-w-[200px]">{listing.title || listing.address || 'Unnamed Listing'}</span>
                                </div>
                            </td>
                            <td className="p-4 text-gray-600 font-medium">{listing.hostName || listing.hostId || 'N/A'}</td>
                            <td className="p-4 text-gray-600">{listing.parkingType || 'N/A'}</td>
                            <td className="p-4 text-gray-900 font-bold">${listing.pricePerHour || 0}/hr</td>
                            <td className="p-4">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${isFlagged ? 'bg-red-100 text-red-700' : (listing.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>
                                    {isFlagged ? 'Suspended' : (listing.status === 'Pending' ? 'Pending Rev' : 'Verified Active')}
                                </span>
                            </td>
                            <td className="p-4 pr-6 text-center relative flex justify-center">
                              <button onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><MoreVertical size={20} /></button>
                              {openMenu === listing.id && (
                                <div className="absolute right-10 top-2 mt-2 w-44 bg-white rounded-xl shadow-xl z-20 border border-gray-100 py-1">
                                  <button onClick={() => handleAction('view', listing)} className="w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">View Details</button>
                                  <button onClick={() => handleAction('flag', listing)} className={`w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-gray-50 ${isFlagged ? 'text-green-600' : 'text-amber-600'}`}>
                                      {isFlagged ? 'Unsuspend Listing' : 'Suspend Listing'}
                                  </button>
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <button onClick={() => handleAction('delete', listing)} className="w-full text-left px-5 py-2.5 text-sm text-red-600 font-bold hover:bg-red-50">Delete Permanently</button>
                                </div>
                              )}
                            </td>
                        </tr>
                      )
                    })}
                </tbody>
            </table>
        </div>
    );
  };

  const renderApprovalQueue = () => {
    return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-sm font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="p-4 pl-6 w-12"><input type="checkbox" onChange={handleSelectAllApproval} checked={selectedApprovalIds.length === approvalQueue.length && approvalQueue.length > 0} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /></th>
                        <th className="p-4">New Submission</th>
                        <th className="p-4">Host</th><th className="p-4">Price</th><th className="p-4 text-center">Images</th>
                        <th className="p-4 text-right pr-6">
                            {selectedApprovalIds.length > 0 ? (
                                <button onClick={handleBatchApprove} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">Approve Selected ({selectedApprovalIds.length})</button>
                            ) : "Review Action"}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {approvalQueue.length === 0 && <tr><td colSpan={5} className="text-center p-8 text-gray-500">Queue is empty.</td></tr>}
                    {approvalQueue.map(listing => (
                        <tr key={listing.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="p-4 pl-6"><input type="checkbox" checked={selectedApprovalIds.includes(listing.id)} onChange={() => handleToggleApprovalSelect(listing.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /></td>
                            <td className="p-4 font-semibold text-gray-800">{listing.address}</td>
                            <td className="p-4 text-gray-600 font-medium">{listing.hostName}</td>
                            <td className="p-4 text-gray-900 font-bold">${listing.pricePerHour}/hr</td>
                            <td className="p-4 text-center">
                                <img src={listing.thumbnail} alt="Proof" className="w-16 h-12 rounded bg-gray-200 object-cover mx-auto mx-auto border" />
                            </td>
                            <td className="p-4 pr-6 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleReject(listing.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"><XCircle size={20}/></button>
                                    <button onClick={() => handleApprove(listing.id)} className="p-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"><Check size={20}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  const renderReportedSpots = () => {
      return (
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-sm font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                        <th className="p-4 pl-6">Reported Location</th>
                        <th className="p-4">Reason</th><th className="p-4">Reporter</th><th className="p-4">Time</th><th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {reportedSpots.length === 0 && <tr><td colSpan={5} className="text-center p-8 text-gray-500">No flags reported.</td></tr>}
                    {reportedSpots.map(spot => (
                        <tr key={spot.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="p-4 pl-6 font-semibold text-gray-800 flex items-center gap-2"><Flag className="text-amber-500" size={16}/> {spot.location}</td>
                            <td className="p-4 text-gray-700">{spot.reason}</td>
                            <td className="p-4 text-gray-500 text-sm font-mono">{spot.reportedBy}</td>
                            <td className="p-4 text-gray-500 text-sm">{spot.time}</td>
                            <td className="p-4 pr-6 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleBlacklist(spot.id)} className="px-3 py-1.5 text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-100">Blacklist GPS</button>
                                    <button onClick={() => handleDismissReport(spot.id)} className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg">Dismiss Flag</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Quality & Marketplace Health</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
            <button 
                onClick={() => setActiveTab('Active')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${activeTab === 'Active' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
                Active & Pending Garages
            </button>
            <button 
                onClick={() => setActiveTab('Approval')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${activeTab === 'Approval' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
                <ShieldCheck size={18} />
                Approval Queue
                {approvalQueue.length > 0 && <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs">{approvalQueue.length}</span>}
            </button>
            <button 
                onClick={() => setActiveTab('Reported')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${activeTab === 'Reported' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
                <Flag size={18} />
                Reported Street Spots
                {reportedSpots.length > 0 && <span className="bg-red-100 text-red-700 py-0.5 px-2 rounded-full text-xs">{reportedSpots.length}</span>}
            </button>
        </div>

        {/* Tab Content Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-full max-w-sm">
            {activeTab === 'Active' && (
                <>
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search Listings by address or title..." className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </>
            )}
            {activeTab === 'Approval' && <p className="text-gray-600 text-sm py-2">Review host-submitted driveway and garage photos to ensure they are legitimate.</p>}
            {activeTab === 'Reported' && <p className="text-gray-600 text-sm py-2">Manage flags generated by the community for street parking spots.</p>}
          </div>
        </div>

        {/* Dynamic Table Area */}
        {activeTab === 'Active' && renderActiveTable()}
        {activeTab === 'Approval' && renderApprovalQueue()}
        {activeTab === 'Reported' && renderReportedSpots()}

      </div>
      <ListingDetailsModal listing={selectedListing} isOpen={isViewModalOpen} onClose={() => setViewModalOpen(false)} />
    </div>
  );
};
