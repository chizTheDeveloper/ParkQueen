import React, { useState } from 'react';
import { DollarSign, TrendingUp, Activity, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Mon', revenue: 400 },
  { name: 'Tue', revenue: 300 },
  { name: 'Wed', revenue: 550 },
  { name: 'Thu', revenue: 480 },
  { name: 'Fri', revenue: 700 },
  { name: 'Sat', revenue: 950 },
  { name: 'Sun', revenue: 850 },
];

const mockPayouts = [
  { id: 1, host: 'Sarah Jenkins', location: 'Astoria Driveway', amount: 145.50, status: 'Pending' },
  { id: 2, host: 'Michael Chen', location: 'LIC Secure Garage', amount: 320.00, status: 'Pending' },
  { id: 3, host: 'Jessica Rivera', location: 'Brooklyn Heights Spot', amount: 85.00, status: 'Paid' },
  { id: 4, host: 'David Kim', location: 'Flushing Driveway', amount: 210.25, status: 'Pending' },
];

export const FinancialsPage = () => {
  const [payouts, setPayouts] = useState(mockPayouts);

  const handlePay = (id: number) => {
    setPayouts(payouts.map(p => p.id === id ? { ...p, status: 'Paid' } : p));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Financial Overview</h1>
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2">
                This Week <ChevronDown size={16} />
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                Export CSV
            </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-lg"><DollarSign size={28} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Gross Volume</p>
            <p className="text-2xl font-bold text-gray-900">$12,450.00</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={28} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">ParQueen Commission (20%)</p>
            <p className="text-2xl font-bold text-gray-900">$2,490.00</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-lg"><Activity size={28} /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Transactions</p>
            <p className="text-2xl font-bold text-gray-900">342</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Revenue Trends</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [`$${value}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payout Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Payout Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="p-4 font-medium">Host</th>
                <th className="p-4 font-medium">Primary Location</th>
                <th className="p-4 font-medium">Amount Owed</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-800">{payout.host}</td>
                  <td className="p-4 text-gray-600">{payout.location}</td>
                  <td className="p-4 font-semibold text-gray-900">${payout.amount.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      payout.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {payout.status === 'Paid' ? <CheckCircle size={14} /> : <Clock size={14} />}
                      {payout.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {payout.status === 'Pending' ? (
                      <button 
                        onClick={() => handlePay(payout.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                      >
                        Pay Host
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium px-3 py-1.5 border border-transparent">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
