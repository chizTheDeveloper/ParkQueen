import React, { useState, useEffect, lazy, Suspense } from 'react';
// LoginView is kept as an eager import since it's the first screen most users see.
import { LoginView } from './views/LoginView';
import SplashScreen from './assets/splash_screen.svg';
import { OnboardingView } from './views/OnboardingView';

// All other views are lazy-loaded so the initial bundle only contains what's
// needed for the login screen. Each view is brought in on demand the first
// time its AppView is rendered, which keeps heavy dependencies (mapbox-gl,
// leaflet, recharts, the Gemini-backed assistant, the admin dashboard, etc.)
// out of the critical path for users who never visit those screens.
const MapView = lazy(() => import('./views/StreetParkingView').then(m => ({ default: m.MapView })));
const GarageRentalView = lazy(() => import('./views/GarageRentalView').then(m => ({ default: m.GarageRentalView })));
const HostDashboardView = lazy(() => import('./views/HostDashboardView').then(m => ({ default: m.HostDashboardView })));
const AssistantView = lazy(() => import('./views/AssistantView').then(m => ({ default: m.AssistantView })));
const MessagesView = lazy(() => import('./views/MessagesView').then(m => ({ default: m.MessagesView })));
const ProfileView = lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const NotificationsView = lazy(() => import('./views/NotificationsView').then(m => ({ default: m.NotificationsView })));
const CreateAccountView = lazy(() => import('./views/CreateAccountView').then(m => ({ default: m.CreateAccountView })));
const SetupProfileView = lazy(() => import('./views/SetupProfileView').then(m => ({ default: m.SetupProfileView })));
const VerifyPhoneView = lazy(() => import('./views/VerifyPhoneView').then(m => ({ default: m.VerifyPhoneView })));
const NameEntryView = lazy(() => import('./views/NameEntryView').then(m => ({ default: m.NameEntryView })));
const EditProfileView = lazy(() => import('./views/EditProfileView').then(m => ({ default: m.EditProfileView })));
const AdminDashboardView = lazy(() => import('./views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const ActivitiesView = lazy(() => import('./views/ActivitiesView').then(m => ({ default: m.ActivitiesView })));
const PrivacyPolicyView = lazy(() => import('./views/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfUseView = lazy(() => import('./views/TermsOfUseView').then(m => ({ default: m.TermsOfUseView })));
const ContactUsView = lazy(() => import('./views/ContactUsView').then(m => ({ default: m.ContactUsView })));
import { AppView } from './types';
import { ChevronLeft } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import { saveUser, loginUser, logoutUser, deleteUser } from './database';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from 'firebase/messaging';
import { getFCM } from './firebaseConfig';

export default function App() {
  const [currentView, setCurrentView] = useState(AppView.LOGIN);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [activeChatContext, setActiveChatContext] = useState<{ userId: string; context: string } | null>(null);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let userProfileUnsubscribe = () => {};

    const authStateUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      userProfileUnsubscribe();
      setLoading(true);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // FCM Setup
        getFCM().then(messaging => {
            if (messaging) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        getToken(messaging).then(currentToken => {
                            if (currentToken) {
                                updateDoc(userDocRef, { fcmToken: currentToken }).catch(e => console.warn('FCM save error', e));
                            }
                        }).catch(e => console.warn('FCM getToken error', e));
                    }
                });

                onMessage(messaging, (payload) => {
                    console.log("Foreground message received:", payload);
                    alert(`👑 ${payload.notification?.title}\n${payload.notification?.body}`);
                });
            }
        });
        
        // Listen for profile data changes
        userProfileUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() });
          } else {
            setUser({ id: firebaseUser.uid });
          }
        });

        // Check for admin claims and route accordingly
        const token = await firebaseUser.getIdTokenResult();
        const isAdmin = token.claims.admin === true;

        if (isAdmin) {
          setCurrentView(AppView.ADMIN_DASHBOARD);
        } else {
          // For non-admins, check if their profile is set up
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setCurrentView(AppView.MAP);
          } else {
            setCurrentView(AppView.SETUP_PROFILE);
          }
        }
      } else {
        // No user is logged in
        setUser(null);
        setCurrentView(localStorage.getItem('hasSeenOnboarding') ? AppView.LOGIN : AppView.ONBOARDING);
      }
      setLoading(false);
    });

    return () => {
      authStateUnsubscribe();
      userProfileUnsubscribe();
    };
  }, []);


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
    setActiveChatContext({ userId, context });
    setCurrentView(AppView.MESSAGES);
  };

  const handleCreateAccount = (phone: string) => {
    setPhone(phone);
    setCurrentView(AppView.VERIFY_PHONE);
  };

  const handleNameComplete = async (fullName: string) => {
    // TEMPORARY: placeholder email/password until real Firebase phone auth
    // (signInWithPhoneNumber + RecaptchaVerifier) replaces email/password as
    // the auth method. Both these values are meaningless to the user and must
    // be removed/replaced when phone auth is implemented.
    const digits = phone.replace(/\D/g, '');
    const placeholderEmail = `phone${digits}@parkqueen.placeholder`;
    const placeholderPassword = crypto.randomUUID();
    try {
      await saveUser({ id: '', fullName, email: placeholderEmail, dob: '', gender: '', password: placeholderPassword, phone });
      setCurrentView(AppView.MAP);
    } catch (error: any) {
      console.error("Failed to save profile: ", error);
      alert(error.message || "Failed to save profile.");
    }
  };

  const handleSaveProfile = async (profileData) => {
    try {
      await saveUser({
        id: '',
        fullName: profileData.fullName,
        email: profileData.email,
        dob: profileData.dob,
        gender: profileData.gender,
        password: profileData.password,
        phone: phone
      });
      setCurrentView(AppView.MAP);
    } catch (error: any) {
      console.error("Failed to save profile: ", error);
      alert(error.message || "Failed to save profile.");
    }
  };

  const handleLogin = async (email, password) => {
    try {
      await loginUser(email, password);
    } catch (error) {
      console.error("Failed to login: ", error);
      alert("Failed to login. Please check your email and password.");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Failed to logout: ", error);
      alert("Failed to logout.");
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        await deleteUser();
      } catch (error) {
        console.error("Failed to delete account: ", error);
        alert("Failed to delete account.");
      }
    }
  };

  const renderView = () => {
    if (loading) {
      return <div className="h-full w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${SplashScreen})` }} />;
    }

    switch (currentView) {
      case AppView.ONBOARDING:
        return <OnboardingView onComplete={() => { localStorage.setItem('hasSeenOnboarding', '1'); setCurrentView(AppView.LOGIN); }} />;
      case AppView.LOGIN:
        return <LoginView onLogin={handleLogin} onNavigateToCreateAccount={() => setCurrentView(AppView.CREATE_ACCOUNT)} />;
      case AppView.CREATE_ACCOUNT:
        return <CreateAccountView onContinue={handleCreateAccount} />;
      case AppView.VERIFY_PHONE:
        return <VerifyPhoneView phone={phone} onVerify={() => setCurrentView(AppView.SETUP_PROFILE)} onEditNumber={() => setCurrentView(AppView.CREATE_ACCOUNT)} />;
      case AppView.SETUP_PROFILE:
        return <NameEntryView onComplete={handleNameComplete} />;
      case AppView.COMPLETE_PROFILE:
        return <SetupProfileView phone={phone} onSave={handleSaveProfile} onSkip={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.EDIT_PROFILE:
        return <EditProfileView user={user} onBack={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.MAP:
        return (
          <MapView 
            user={user}
            onMessageUser={handleMessageUser} 
            setView={setCurrentView}
          />
        );
      case AppView.GARAGE_LIST:
        return (
          <div className="h-full flex flex-col bg-dark-900">
            <div className="pt-4 px-4 flex items-center gap-4 mb-4">
              <button onClick={() => setCurrentView(AppView.MAP)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">Listings</h1>
                <p className="text-xs text-gray-400">Browse and book private parking rentals</p>
              </div>
            </div>
            <GarageRentalView />
          </div>
        );
      case AppView.HOST_DASHBOARD:
        return (
          <div className="h-full flex flex-col bg-dark-900">
            <div className="pt-4 px-4 flex items-center gap-4 mb-4">
              <button onClick={() => setCurrentView(AppView.GARAGE_LIST)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">Host Dashboard</h1>
                <p className="text-xs text-gray-400">Manage your shared spaces and host earnings</p>
              </div>
            </div>
            <HostDashboardView />
          </div>
        );
      case AppView.AI_ASSISTANT:
        return (
          <div className="h-full flex flex-col bg-dark-900">
            <div className="pt-4 px-4 flex items-center gap-4 mb-4">
              <button onClick={() => setCurrentView(AppView.MAP)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">Sign Scanner</h1>
                <p className="text-xs text-gray-400">Interpret street rules instantly with AI</p>
              </div>
            </div>
            <AssistantView />
          </div>
        );
      case AppView.MESSAGES:
        return (
          <MessagesView 
            user={user} 
            activeChatContext={activeChatContext} 
            onBack={() => {
              setActiveChatContext(null);
              setCurrentView(AppView.MAP);
            }} 
          />
        );
      case AppView.PROFILE:
        return <ProfileView user={user} setView={setCurrentView} onBack={() => setCurrentView(AppView.MAP)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} theme={theme} toggleTheme={toggleTheme} />;
      case AppView.NOTIFICATIONS:
        return <NotificationsView user={user} onBack={() => setCurrentView(AppView.MAP)} />;
      case AppView.ADMIN_DASHBOARD:
        return <AdminDashboardView onLogout={handleLogout} />;
      case AppView.PARKING_SPACE:
        return <ActivitiesView user={user} onBack={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.PRIVACY_POLICY:
        return <PrivacyPolicyView onBack={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.TERMS_OF_USE:
        return <TermsOfUseView onBack={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.CONTACT_US:
        return <ContactUsView onBack={() => setCurrentView(AppView.PROFILE)} />;
      default:
        return <LoginView onLogin={handleLogin} onNavigateToCreateAccount={() => setCurrentView(AppView.CREATE_ACCOUNT)} />;
    }
  };

  const isMapView = currentView === AppView.MAP;

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-dark-900 text-slate-900 dark:text-white font-sans selection:bg-queen-500 selection:text-white transition-colors duration-300">
      <main className={`flex-1 relative ${isMapView ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <ErrorBoundary>
          <Suspense fallback={<div className="h-full w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${SplashScreen})` }} />}>
            {renderView()}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
