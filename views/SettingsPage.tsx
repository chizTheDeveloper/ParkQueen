import React, { useState } from 'react';
import { Settings as SettingsIcon, Percent, Zap, Shield, Save, AlertTriangle } from 'lucide-react';

export const SettingsPage = () => {
  const [platformFee, setPlatformFee] = useState(20);
  const [pingPoints, setPingPoints] = useState(50);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [roleEmail, setRoleEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('Moderator');

  const handleSaveConfig = () => {
    alert("Global configurations saved successfully!");
  };

  const handleAssignRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleEmail) return;
    alert(`Upgraded ${roleEmail} to ${selectedRole}!`);
    setRoleEmail('');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Global Configuration Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <SettingsIcon className="text-blue-600" size={20} />
              Global Configuration
            </h2>
          </div>
          <div className="p-6 space-y-6 flex-1">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Percent size={16} className="text-gray-500" /> Platform Fee Percentage
              </label>
              <div className="relative border border-gray-300 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all overflow-hidden">
                  <input 
                      type="number" 
                      value={platformFee} 
                      onChange={(e) => setPlatformFee(Number(e.target.value))} 
                      className="w-full px-4 py-2.5 focus:outline-none"
                  />
                  <div className="absolute right-0 top-0 bottom-0 bg-gray-50 px-4 border-l border-gray-300 flex items-center text-gray-500 font-semibold">%</div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Cut taken from garage/driveway rentals.</p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Zap size={16} className="text-yellow-500" /> Gamification Constants
              </label>
              <input 
                  type="number" 
                  value={pingPoints} 
                  onChange={(e) => setPingPoints(Number(e.target.value))} 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              />
              <p className="text-xs text-gray-500 mt-1.5">Points awarded per verified street parking ping.</p>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            {maintenanceMode ? <AlertTriangle size={18} className="text-red-500" /> : null}
                            Maintenance Mode
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Places the app in read-only mode for users.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

          </div>
          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button onClick={handleSaveConfig} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition">
              <Save size={18} /> Save Settings
            </button>
          </div>
        </div>

        {/* User Roles Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-fit">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Shield className="text-blue-600" size={20} />
              Role Management
            </h2>
          </div>
          <form onSubmit={handleAssignRole} className="p-6 space-y-6 flex-1">
             <p className="text-sm text-gray-600 mb-2">Upgrade a user's permissions by updating their Firebase Custom Claims. They must relogin for changes to immediately take effect.</p>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">User Email Address</label>
              <input 
                  type="email" 
                  required
                  placeholder="user@example.com"
                  value={roleEmail} 
                  onChange={(e) => setRoleEmail(e.target.value)} 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select New Role</label>
              <div className="grid grid-cols-2 gap-3">
                  <label className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center justify-center text-center transition-all ${selectedRole === 'Moderator' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="role" value="Moderator" checked={selectedRole === 'Moderator'} onChange={() => setSelectedRole('Moderator')} className="sr-only" />
                      <span className="font-bold text-gray-800 text-sm">Moderator</span>
                      <span className="text-xs text-gray-500 mt-1">Can approve listings & manage tickets</span>
                  </label>
                  <label className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center justify-center text-center transition-all ${selectedRole === 'Admin' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="role" value="Admin" checked={selectedRole === 'Admin'} onChange={() => setSelectedRole('Admin')} className="sr-only" />
                      <span className="font-bold text-gray-800 text-sm">Admin</span>
                      <span className="text-xs text-gray-500 mt-1">Full platform & financial access</span>
                  </label>
              </div>
            </div>

            <button type="submit" className="w-full mt-4 px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-lg shadow-md transition">
              Update Roles
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
