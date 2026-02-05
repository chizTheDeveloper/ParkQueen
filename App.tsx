import React, { useState, useEffect } from 'react';
import { MapView } from './views/StreetParkingView';
import { GarageRentalView } from './views/GarageRentalView';
import { HostDashboardView } from './views/HostDashboardView';
import { AssistantView } from './views/AssistantView';
import { MessagesView } from './views/MessagesView';
import { ProfileView } from './views/ProfileView';
import { NotificationsView } from './views/NotificationsView';
import { CreateAccountView } from './views/CreateAccountView';
import { SetupProfileView } from './views/SetupProfileView';
import { EditProfileView } from './views/EditProfileView';
import { LoginView } from './views/LoginView';
import { AppView } from './types';
import { ChevronLeft } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import { saveUser, loginUser, logoutUser, deleteUser } from './database';

export default function App() {
  const [currentView, setCurrentView] = useState(AppView.LOGIN);
  const [signupPhone, setSignupPhone] = useState("");
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

  const handleCreateAccount = (phone: string) => {
    setSignupPhone(phone);
    setCurrentView(AppView.SETUP_PROFILE);
  }

  const handleSaveProfile = async (profileData: { fullName: string; email: string; dob: string; gender: string; avatar: File | null; password: string }) => {
    const { avatar, ...userData } = profileData;
    try {
      await saveUser({ ...userData, id: signupPhone });
      setCurrentView(AppView.MAP);
    } catch (error) {
      console.error("Failed to create account: ", error);
      alert("Failed to create account. The email might already be in use or your password is too weak.");
    }
  };

  const handleLogin = async (email, password) => {
    try {
      await loginUser(email, password);
      setCurrentView(AppView.MAP);
    } catch (error) {
      console.error("Failed to login: ", error);
      alert("Failed to login. Please check your email and password.");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentView(AppView.LOGIN);
    } catch (error) {
      console.error("Failed to logout: ", error);
      alert("Failed to logout.");
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        await deleteUser();
        setCurrentView(AppView.LOGIN);
      } catch (error) {
        console.error("Failed to delete account: ", error);
        alert("Failed to delete account.");
      }
    }
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.LOGIN:
        return <LoginView onLogin={handleLogin} onNavigateToCreateAccount={() => setCurrentView(AppView.CREATE_ACCOUNT)} />;
      case AppView.CREATE_ACCOUNT:
        return <CreateAccountView onContinue={handleCreateAccount} />;
      case AppView.SETUP_PROFILE:
        return <SetupProfileView phone={signupPhone} onSave={handleSaveProfile} />;
      case AppView.EDIT_PROFILE:
        return <EditProfileView onBack={() => setCurrentView(AppView.PROFILE)} />;
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
        return <ProfileView setView={setCurrentView} onBack={() => setCurrentView(AppView.MAP)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} theme={theme} toggleTheme={toggleTheme} />;
      case AppView.NOTIFICATIONS:
        return <NotificationsView onBack={() => setCurrentView(AppView.MAP)} />;
      default:
        return <LoginView onLogin={handleLogin} onNavigateToCreateAccount={() => setCurrentView(AppView.CREATE_ACCOUNT)} />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-sans selection:bg-queen-500 selection:text-white transition-colors duration-300">
      <main className="flex-1 overflow-hidden relative">
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </main>
    </div>
  );
}
