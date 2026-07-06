import React from 'react';
import { Shield } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-blue-600" size={20} />
            Admin Role Management
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Role management is not available here.</strong> To grant or revoke admin access,
            use the Firebase Console or run the{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">bootstrapAdmin</code> Cloud Function
            directly via the CLI. The admin role is a Firebase Custom Claim and requires a
            server-side call that has not yet been wired to this UI.
          </div>
        </div>
      </div>
    </div>
  );
};
