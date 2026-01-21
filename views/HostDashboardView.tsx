import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, DollarSign, Calendar } from 'lucide-react';
import { generateListingDescription } from '../services/geminiService';

const DATA = [
  { month: 'Jan', amount: 320, rentals: 8 },
  { month: 'Feb', amount: 450, rentals: 12 },
  { month: 'Mar', amount: 280, rentals: 6 },
  { month: 'Apr', amount: 590, rentals: 15 },
  { month: 'May', amount: 720, rentals: 20 },
  { month: 'Jun', amount: 850, rentals: 24 },
];

export const HostDashboardView = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFeatures, setNewFeatures] = useState('');
  const [generatedDesc, setGeneratedDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = async () => {
    if (!newFeatures) return;
    setIsGenerating(true);
    const featuresList = newFeatures.split(',').map(s => s.trim());
    const desc = await generateListingDescription(featuresList);
    setGeneratedDesc(desc);
    setIsGenerating(false);
  };

  return (
    <div className="pt-20 pb-24 px-4 h-full overflow-y-auto no-scrollbar bg-dark-900 text-white">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">Host Dashboard</h2>
          <p className="text-gray-400 text-sm">Welcome back, Queen!</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-queen-600 hover:bg-queen-700 text-white p-2 rounded-full shadow-lg shadow-queen-900/50"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <DollarSign size={16} />
            <span className="text-xs uppercase font-bold tracking-wider">Total Earnings</span>
          </div>
          <div className="text-2xl font-bold text-white">$3,210</div>
          <div className="text-xs text-green-400 mt-1">+12% from last month</div>
        </div>
        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar size={16} />
            <span className="text-xs uppercase font-bold tracking-wider">Bookings</span>
          </div>
          <div className="text-2xl font-bold text-white">85</div>
          <div className="text-xs text-queen-400 mt-1">5 active now</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 mb-8 h-72">
        <h3 className="font-bold text-lg mb-4">Monthly Revenue</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA}>
            <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
            <Tooltip 
              cursor={{fill: '#2D2D2D'}}
              contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#2D2D2D', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {DATA.map((entry, index) => (
                // Changed fills from Purple (#7c3aed, #4c1d95) to Blue (#2563eb, #1e3a8a)
                <Cell key={`cell-${index}`} fill={index === DATA.length - 1 ? '#2563eb' : '#1e3a8a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Add Listing Modal (Simplified) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-md rounded-2xl p-6 border border-dark-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">List Your Spot</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Features (comma separated)</label>
                <input 
                  type="text" 
                  value={newFeatures}
                  onChange={(e) => setNewFeatures(e.target.value)}
                  placeholder="e.g. Gated, CCTV, Wide, Easy Entry"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white focus:border-queen-500 outline-none"
                />
              </div>
              
              <button 
                onClick={handleGenerateAI}
                disabled={isGenerating || !newFeatures}
                className="text-xs bg-gradient-to-r from-queen-600 to-cyan-600 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1 w-fit ml-auto"
              >
                 {isGenerating ? 'Thinking...' : '✨ Generate Description with AI'}
              </button>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea 
                  value={generatedDesc}
                  onChange={(e) => setGeneratedDesc(e.target.value)}
                  placeholder="Marketing copy will appear here..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white h-24 focus:border-queen-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 text-gray-400 font-medium hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white text-dark-900 font-bold py-3 rounded-xl hover:bg-queen-100"
                >
                  Create Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
