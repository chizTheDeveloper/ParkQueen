import React, { useState } from 'react';
import { Settings, Users, LayoutDashboard, ChevronLeft, ChevronRight, LogOut, MapPin, ShieldAlert, ClipboardList } from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { UsersPage } from './UsersPage';
import { SettingsPage } from './SettingsPage';
import { StreetSegmentsPage } from './admin/StreetSegmentsPage';
import { ReportsPage } from './admin/ReportsPage';
import { PingsPage } from './admin/PingsPage';
import { AuditLogPage } from './admin/AuditLogPage';
import { auth } from "../firebase";
import parqueenLogo from '../assets/Parqueen_Logo.png';

const Sidebar = ({ isCollapsed, activePage, setActivePage, onLogout }) => {
  const navItems = [
    { icon: <LayoutDashboard size={20} />, name: 'Dashboard' },
    { icon: <Users size={20} />, name: 'Users' },
    { icon: <MapPin size={20} />, name: 'Streets' },
    { icon: <ShieldAlert size={20} />, name: 'Reports' },
    { icon: <MapPin size={20} />, name: 'Pings' },
    { icon: <ClipboardList size={20} />, name: 'Audit Log' },
    { icon: <Settings size={20} />, name: 'Settings' },
  ];

  return (
    <aside className={`bg-white h-full flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center p-4 ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
        <img src={parqueenLogo} alt="Logo" className="h-10" />
        {!isCollapsed && <h1 className="text-xl font-bold text-blue-600 ml-2">ParQueen</h1>}
      </div>
      <nav className="flex-1 mt-8 space-y-2 px-2">
        {navItems.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setActivePage(item.name)}
            className={`w-full flex items-center p-3 rounded-lg text-gray-600 hover:bg-blue-50 transition-colors ${activePage === item.name ? 'bg-blue-100 text-blue-600 font-semibold' : ''} ${isCollapsed ? 'justify-center' : ''}`}
          >
            {item.icon}
            {!isCollapsed && <span className="ml-4">{item.name}</span>}
          </button>
        ))}
      </nav>
      <div className="p-2">
        <button
          type="button"
          onClick={onLogout}
          className={`w-full flex items-center p-3 rounded-lg text-gray-600 hover:bg-red-50 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="ml-4">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export const AdminDashboardView = ({ onLogout }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard': return <DashboardPage onNavigate={setActivePage} />;
      case 'Users':     return <UsersPage />;
      case 'Streets':   return <StreetSegmentsPage />;
      case 'Reports':   return <ReportsPage />;
      case 'Pings':      return <PingsPage />;
      case 'Audit Log':  return <AuditLogPage />;
      case 'Settings':   return <SettingsPage />;
      default:          return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-gray-50">
      <Sidebar isCollapsed={isSidebarCollapsed} activePage={activePage} setActivePage={setActivePage} onLogout={onLogout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 rounded-md hover:bg-gray-100">
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 overflow-hidden shrink-0">
              <i className="fa-solid fa-user text-sm"></i>
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {auth?.currentUser?.email ?? 'Admin'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};
