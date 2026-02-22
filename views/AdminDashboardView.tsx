
import React, { useState } from 'react';
import { BarChart, Bell, Search, Settings, DollarSign, List, Users, LayoutDashboard, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { UsersPage } from './UsersPage';
import { ListingsPage } from './ListingsPage';
import { FinancialsPage } from './FinancialsPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

const Sidebar = ({ isCollapsed, activePage, setActivePage, onLogout }) => {
  const navItems = [
    { icon: <LayoutDashboard size={20} />, name: 'Dashboard' },
    { icon: <Users size={20} />, name: 'Users' },
    { icon: <List size={20} />, name: 'Listings' },
    { icon: <DollarSign size={20} />, name: 'Financials' },
    { icon: <BarChart size={20} />, name: 'Reports' },
    { icon: <Settings size={20} />, name: 'Settings' },
  ];

  return (
    <aside className={`bg-white h-full flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center p-4 ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
        <img src="https://i.imgur.com/AAl1g2t.png" alt="Logo" className="h-10" />
        {!isCollapsed && <h1 className="text-xl font-bold text-blue-600 ml-2">ParQueen</h1>}
      </div>
      <nav className="flex-1 mt-8 space-y-2 px-2">
        {navItems.map((item) => (
          <a
            key={item.name}
            href="#"
            onClick={() => setActivePage(item.name)}
            className={`flex items-center p-3 rounded-lg text-gray-600 hover:bg-blue-50 transition-colors ${activePage === item.name ? 'bg-blue-100 text-blue-600 font-semibold' : ''} ${isCollapsed ? 'justify-center' : ''}`}
          >
            {item.icon}
            {!isCollapsed && <span className="ml-4">{item.name}</span>}
          </a>
        ))}
      </nav>
      <div className="p-2">
        <a
          href="#"
          onClick={onLogout}
          className={`flex items-center p-3 rounded-lg text-gray-600 hover:bg-red-50 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
          <LogOut size={20} />
          {!isCollapsed && <span className="ml-4">Logout</span>}
        </a>
      </div>
    </aside>
  );
};


export const AdminDashboardView = ({ onLogout }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('Dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <DashboardPage />;
      case 'Users':
        return <UsersPage />;
      case 'Listings':
        return <ListingsPage />;
      case 'Financials':
        return <FinancialsPage />;
      case 'Reports':
        return <ReportsPage />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-gray-50">
      <Sidebar isCollapsed={isSidebarCollapsed} activePage={activePage} setActivePage={setActivePage} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 rounded-md hover:bg-gray-100">
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <img src="https://i.pravatar.cc/40" alt="Admin" className="rounded-full h-8 w-8" />
              <span className="text-sm font-semibold text-gray-700">Admin</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};
