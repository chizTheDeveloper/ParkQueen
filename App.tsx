import React, { useState, useEffect } from 'react';
import { MapView } from './views/StreetParkingView';
import { GarageRentalView } from './views/GarageRentalView';
import { HostDashboardView } from './views/HostDashboardView';
import { AssistantView } from './views/AssistantView';
import { MessagesView } from './views/MessagesView';
import { ProfileView } from './views/ProfileView';
import { NotificationsView } from './views/NotificationsView';
import { AppView } from './types';
import { ChevronLeft } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState(AppView.MAP);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleMessageUser = (userId, context) => {
    console.log(`Starting chat with ${userId} about ${context}`);
    setCurrentView(AppView.MESSAGES);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.MAP:
        return (
          <MapView 
            onMessageUser={handleMessageUser} 
            setView={setCurrentView}
          />
        );
      case AppView.GARAGE_LIST:
        return (
          <div className="h-full flex flex-col">
            <div className="pt-4 px-4 flex items-center gap-4 bg-dark-900 border-b border-dark-800 pb-4">
              <button onClick={() => setCurrentView(AppView.MAP)} className="p-2 bg-dark-800 rounded-full text-white"><ChevronLeft size={24} /></button>
              <h1 className="text-xl font-bold">Listings</h1>
            </div>
            <GarageRentalView />
          </div>
        );
      case AppView.HOST_DASHBOARD:
        return (
          <div className="h-full flex flex-col">
            <div className="pt-4 px-4 flex items-center gap-4 bg-dark-900 border-b border-dark-800 pb-4">
              <button onClick={() => setCurrentView(AppView.GARAGE_LIST)} className="p-2 bg-dark-800 rounded-full text-white"><ChevronLeft size={24} /></button>
              <h1 className="text-xl font-bold">Host Dashboard</h1>
            </div>
            <HostDashboardView />
          </div>
        );
      case AppView.AI_ASSISTANT:
        return (
          <div className="h-full flex flex-col">
            <div className="pt-4 px-4 flex items-center gap-4 bg-dark-900 border-b border-dark-800 pb-4">
              <button onClick={() => setCurrentView(AppView.MAP)} className="p-2 bg-dark-800 rounded-full text-white"><ChevronLeft size={24} /></button>
              <h1 className="text-xl font-bold">Sign Scanner</h1>
            </div>
            <AssistantView />
          </div>
        );
      case AppView.MESSAGES:
        return <MessagesView onBack={() => setCurrentView(AppView.MAP)} />;
      case AppView.PROFILE:
        return <ProfileView theme={theme} toggleTheme={toggleTheme} onBack={() => setCurrentView(AppView.MAP)} />;
      case AppView.NOTIFICATIONS:
        return <NotificationsView onBack={() => setCurrentView(AppView.MAP)} />;
      default:
        return <MapView onMessageUser={handleMessageUser} setView={setCurrentView} />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-sans selection:bg-queen-500 selection:text-white transition-colors duration-300">
      <main className="flex-1 overflow-hidden relative">
        {renderView()}
      </main>
    </div>
  );
}
