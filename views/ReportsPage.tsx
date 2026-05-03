import React from 'react';
import { Map, MapPin, CheckCircle, XCircle, MessageSquare, AlertTriangle, UserX, Clock, Camera } from 'lucide-react';

const mockHeatmapData = [
  { rank: 1, neighborhood: 'Astoria, Queens', pings: 1245, trend: '+12%' },
  { rank: 2, neighborhood: 'Williamsburg, Brooklyn', pings: 980, trend: '+5%' },
  { rank: 3, neighborhood: 'Upper West Side, Manhattan', pings: 850, trend: '-2%' },
  { rank: 4, neighborhood: 'Park Slope, Brooklyn', pings: 620, trend: '+8%' },
  { rank: 5, neighborhood: 'Long Island City, Queens', pings: 590, trend: '+15%' },
];

const mockAiScans = [
  { id: 'scan-1', time: '10 mins ago', image: 'https://images.unsplash.com/photo-1549887552-cb1ca7890aa9?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80', result: 'YES (Valid until 7PM)', isAccurate: true },
  { id: 'scan-2', time: '45 mins ago', image: 'https://images.unsplash.com/photo-1494515151522-83506c9e034e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80', result: 'NO (Street Cleaning)', isAccurate: true },
  { id: 'scan-3', time: '2 hours ago', image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80', result: 'CONDITIONAL (Permit Only)', isAccurate: false },
];

const mockTickets = [
  { id: 'TKT-892', user: 'johndoe88', issue: 'Host cancelled driveway last minute', severity: 'High', status: 'Open' },
  { id: 'TKT-891', user: 'sarah_m', issue: 'Fake spot pinged in Astoria', severity: 'Medium', status: 'Open' },
  { id: 'TKT-889', user: 'mike_p_nyc', issue: 'App crashed during navigation', severity: 'Low', status: 'Resolved' },
];

export const ReportsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">System Reports & Analytics</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Activity Heatmap List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Map className="text-blue-600" size={20} />
              Ping Heatmap (Top Neighborhoods)
            </h2>
          </div>
          <div className="flex-1 p-6">
            <div className="space-y-4">
              {mockHeatmapData.map((item) => (
                <div key={item.neighborhood} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent transition">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {item.rank}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{item.neighborhood}</p>
                      <p className="text-sm text-gray-500">{item.pings.toLocaleString()} pings this month</p>
                    </div>
                  </div>
                  <div className={`font-semibold ${item.trend.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                    {item.trend}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Decoder Accuracy Logs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">AI Decoder Accuracy Log</h2>
            <p className="text-sm text-gray-500 mt-1">Review Gemini Vision API performance on tricky NYC signs.</p>
          </div>
          <div className="flex-1 p-6 overflow-y-auto max-h-[400px] no-scrollbar">
            <div className="space-y-4">
              {mockAiScans.map((scan) => (
                <div key={scan.id} className="flex gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                  <div className="w-20 h-20 rounded-lg shadow-sm bg-gray-200 flex items-center justify-center shrink-0">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-xs text-gray-500 font-medium">{scan.time}</p>
                      {scan.isAccurate ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle size={12}/> Success</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><XCircle size={12}/> Failed / Retrained</span>
                      )}
                    </div>
                    <p className="font-mono text-sm font-semibold text-gray-800 mt-1">{scan.result}</p>
                    {/* Interactive toggle for admin to correct AI */}
                    <div className="mt-2 flex gap-2">
                        <button className="text-xs px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 font-medium transition-colors">Verify Correct</button>
                        <button className="text-xs px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 font-medium transition-colors">Flag as Error</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Support Tickets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="text-blue-600" size={20} />
              Recent Support Tickets
            </h2>
            <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                  <th className="p-4 font-medium pl-6">ID</th>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Issue Summary</th>
                  <th className="p-4 font-medium">Severity</th>
                  <th className="p-4 font-medium pr-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-4 pl-6 font-mono text-sm text-gray-600">{ticket.id}</td>
                    <td className="p-4 font-medium text-gray-800">{ticket.user}</td>
                    <td className="p-4 text-gray-600">{ticket.issue}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        ticket.severity === 'High' ? 'bg-red-100 text-red-700' : 
                        ticket.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {ticket.severity === 'High' && <AlertTriangle size={12}/>}
                        {ticket.severity}
                      </span>
                    </td>
                    <td className="p-4 pr-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        ticket.status === 'Open' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
