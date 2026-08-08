import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, MapPin, Activity, Car, FileWarning, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { fetchDashboardCounts } from '../utils/adminReadService';

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  isWarning?: boolean;
  onClick?: () => void;
}

const MetricCard = ({ icon, title, value, subtitle, isWarning = false, onClick }: MetricCardProps) => (
  <div
    onClick={onClick}
    className={`bg-white p-4 rounded-xl shadow-md flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
  >
    <div className={`p-2 rounded-full shrink-0 ${isWarning ? 'bg-red-100' : 'bg-blue-100'}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className={`text-xs mt-0.5 ${isWarning ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{subtitle}</p>}
    </div>
  </div>
);

interface Counts {
  totalUsers: number;
  activePings: number;
  activeSessions: number;
  parseFailures: number;
  needsReview: number;
  reports: number;
}

const EMPTY_COUNTS: Counts = {
  totalUsers: 0, activePings: 0, activeSessions: 0,
  parseFailures: 0, needsReview: 0, reports: 0,
};

export const DashboardPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoadingCounts(true);
    setError(null);
    try {
      const data = await fetchDashboardCounts();
      setCounts({
        totalUsers: data.totalUsers,
        activePings: data.activePings,
        activeSessions: data.activeSessions,
        parseFailures: data.parseFailures,
        needsReview: data.needsReview,
        reports: data.reports,
      });
      setRecentUsers(data.recentUsers);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
    } finally {
      setLoadingCounts(false);
    }
  };

  useEffect(() => { load(); }, []);

  const attentionItems: { label: string; page?: string }[] = [
    counts.parseFailures > 0  && { label: `${counts.parseFailures} unresolved parse failure${counts.parseFailures !== 1 ? 's' : ''}`, page: 'Streets' },
    counts.needsReview > 0    && { label: `${counts.needsReview} segment${counts.needsReview !== 1 ? 's' : ''} flagged for review`, page: 'Streets' },
    counts.reports > 0        && { label: `${counts.reports} pending report${counts.reports !== 1 ? 's' : ''} to review`, page: 'Reports' },
  ].filter(Boolean) as { label: string; page?: string }[];

  const val = (n: number) => loadingCounts ? '—' : n.toLocaleString();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Operations Overview</h1>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          icon={<Users size={22} className="text-blue-500" />}
          title="Total Users"
          value={val(counts.totalUsers)}
          onClick={() => onNavigate('Users')}
        />
        <MetricCard
          icon={<MapPin size={22} className="text-blue-500" />}
          title="Active Parking Pings"
          subtitle="Live count"
          value={val(counts.activePings)}
          onClick={() => onNavigate('Pings')}
        />
        <MetricCard
          icon={<Car size={22} className="text-blue-500" />}
          title="Active My Car Sessions"
          subtitle="Users with active == true"
          value={val(counts.activeSessions)}
        />
        <MetricCard
          icon={<FileWarning size={22} className={counts.parseFailures > 0 ? 'text-red-500' : 'text-gray-400'} />}
          title="Unresolved Parse Failures"
          value={val(counts.parseFailures)}
          isWarning={counts.parseFailures > 0}
          subtitle={counts.parseFailures > 0 ? 'Needs attention' : undefined}
          onClick={() => onNavigate('Streets')}
        />
        <MetricCard
          icon={<Activity size={22} className={counts.needsReview > 0 ? 'text-amber-500' : 'text-gray-400'} />}
          title="Segments Needing Review"
          value={val(counts.needsReview)}
          isWarning={counts.needsReview > 0}
          subtitle={counts.needsReview > 0 ? 'Needs attention' : undefined}
          onClick={() => onNavigate('Streets')}
        />
        <MetricCard
          icon={<ShieldAlert size={22} className={counts.reports > 0 ? 'text-orange-500' : 'text-gray-400'} />}
          title="Pending Reports"
          subtitle={counts.reports > 0 ? 'Needs attention' : 'No pending reports'}
          isWarning={counts.reports > 0}
          value={val(counts.reports)}
          onClick={() => onNavigate('Reports')}
        />
      </div>

      {/* Attention Needed */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Attention Needed</h2>
        {!loadingCounts && attentionItems.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <CheckCircle size={18} />
            No urgent admin issues right now.
          </div>
        ) : loadingCounts ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {attentionItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                {item.page ? (
                  <button
                    onClick={() => onNavigate(item.page!)}
                    className="text-blue-600 hover:underline text-left"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="text-gray-700">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Registrations */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Registrations</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm text-gray-500">
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 px-4 text-center text-gray-400 text-sm">No recent registrations.</td>
              </tr>
            )}
            {recentUsers.map((user: any) => (
              <tr key={user.id} className="border-b border-gray-100">
                <td className="py-3 px-4 font-medium text-gray-700">
                  {user.fullName || user.username || 'N/A'}
                  {user.username && user.fullName && <span className="text-gray-400 text-xs ml-1">@{user.username}</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.status === 'suspended' || user.status === 'Suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {user.status === 'suspended' || user.status === 'Suspended' ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 text-sm">
                  {user.createdAt?.toDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(user.createdAt.toDate()) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
