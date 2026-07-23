import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LoadingScreen } from './components/LoadingScreen';
import { OnboardingView } from './views/OnboardingView';
const LocationPromptView = lazy(() => import('./views/LocationPromptView').then(m => ({ default: m.LocationPromptView })));

// All other views are lazy-loaded so the initial bundle only contains what's
// needed for the login screen. Each view is brought in on demand the first
// time its AppView is rendered, which keeps heavy dependencies (mapbox-gl,
// leaflet, recharts, the Gemini-backed assistant, the admin dashboard, etc.)
// out of the critical path for users who never visit those screens.
const MapView = lazy(() => import('./views/StreetParkingView').then(m => ({ default: m.MapView })));
const AssistantView = lazy(() => import('./views/AssistantView').then(m => ({ default: m.AssistantView })));
const MessagesView = lazy(() => import('./views/MessagesView').then(m => ({ default: m.MessagesView })));
const ProfileView = lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const NotificationsView = lazy(() => import('./views/NotificationsView').then(m => ({ default: m.NotificationsView })));
const NotificationsSettingsView = lazy(() => import('./views/NotificationsSettingsView').then(m => ({ default: m.NotificationsSettingsView })));
const LocationSettingsView = lazy(() => import('./views/LocationSettingsView').then(m => ({ default: m.LocationSettingsView })));
const LanguageSettingsView = lazy(() => import('./views/LanguageSettingsView').then(m => ({ default: m.LanguageSettingsView })));
const CreateAccountView = lazy(() => import('./views/CreateAccountView').then(m => ({ default: m.CreateAccountView })));
const SetupProfileView = lazy(() => import('./views/SetupProfileView').then(m => ({ default: m.SetupProfileView })));
const VerifyPhoneView = lazy(() => import('./views/VerifyPhoneView').then(m => ({ default: m.VerifyPhoneView })));
const NameEntryView = lazy(() => import('./views/NameEntryView').then(m => ({ default: m.NameEntryView })));
const EditProfileView = lazy(() => import('./views/EditProfileView').then(m => ({ default: m.EditProfileView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const AdminDashboardView = lazy(() => import('./views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const AdminLoginView = lazy(() => import('./views/AdminLoginView').then(m => ({ default: m.AdminLoginView })));

// Admin portal lives at admin.parqueen.app. On localhost, add ?admin to test it.
const isAdminDomain = window.location.hostname === 'admin.parqueen.app'
  || (window.location.hostname === 'localhost' && new URLSearchParams(window.location.search).has('admin'));

const ActivitiesView = lazy(() => import('./views/ActivitiesView').then(m => ({ default: m.ActivitiesView })));
const EditVehicleView = lazy(() => import('./views/EditVehicleView').then(m => ({ default: m.EditVehicleView })));
const ParsonaCreatorView = lazy(() => import('./views/ParsonaCreatorView').then(m => ({ default: m.ParsonaCreatorView })));
const ParsonaPresetPickerView = lazy(() => import('./views/ParsonaPresetPickerView').then(m => ({ default: m.ParsonaPresetPickerView })));
// DEV-only Art Lab — tree-shaken out of production builds
const ParsonaArtLabView = import.meta.env.DEV
  ? lazy(() => import('./views/ParsonaArtLabView').then(m => ({ default: m.ParsonaArtLabView })))
  : null;
const PrivacyPolicyView = lazy(() => import('./views/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfUseView = lazy(() => import('./views/TermsOfUseView').then(m => ({ default: m.TermsOfUseView })));
const ContactUsView = lazy(() => import('./views/ContactUsView').then(m => ({ default: m.ContactUsView })));
import { AppView } from './types';
import { readPersistedAccess, persistAccessChoice, shouldShowPrimer, resolveFromPermissions, type LocationAccess } from './utils/locationAccess';
import { nearbyPermissionState, type LocationCallbacks } from './utils/nearbyActivity';
import { getLang, setLang } from './i18n';
import { getLanguageHydrationAction } from './utils/languageHydration';
import { ChevronLeft } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import { saveUserProfile, logoutUser, deleteUser } from './database';
import { ConfirmationResult } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getToken, onMessage } from 'firebase/messaging';
import { getFCM } from './firebaseConfig';

export default function App() {
  const [currentView, setCurrentView] = useState(AppView.CREATE_ACCOUNT);
  const [vehicleOnboarding, setVehicleOnboarding] = useState(false);
  const [locationAccess, setLocationAccess] = useState<LocationAccess>(() => readPersistedAccess());
  const [pendingSpotId, setPendingSpotId] = useState<string | null>(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [activeChatContext, setActiveChatContext] = useState<{ userId: string; context: string } | null>(null);
  const [chatReturnSpotId, setChatReturnSpotId] = useState<string | null>(null);
  const [pushToast, setPushToast] = useState<{ title: string; body: string } | null>(null);
  const [titleUnlock, setTitleUnlock] = useState<string | null>(null);
  const prevTitleRef = useRef<string | null>(null);
  // phone stores canonical E.164 (e.g. "+15555551234", "+51987654321")
  const [phone, setPhone] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    let userProfileUnsubscribe = () => {};

    const authStateUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      userProfileUnsubscribe();
      setLoading(true);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Admin domain: skip FCM and profile listener — just check the claim
        if (isAdminDomain) {
          const token = await firebaseUser.getIdTokenResult();
          if (token.claims.role === 'admin') {
            setCurrentView(AppView.ADMIN_DASHBOARD);
          } else {
            setCurrentView(AppView.ADMIN_LOGIN);
          }
          setLoading(false);
          return;
        }

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
                    // Skip spot notifications the current user created — defense in depth
                    // against the CF self-filter failing or running a stale version.
                    if (payload.data?.finderId && payload.data.finderId === firebaseUser.uid) return;
                    setPushToast({ title: payload.notification?.title || '', body: payload.notification?.body || '' });
                    setTimeout(() => setPushToast(null), 5000);
                });
            }
        });
        
        // Listen for profile data changes
        userProfileUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ id: userDoc.id, ...userData });
            const newTitle = userData.title || 'Newcomer';
            if (prevTitleRef.current && prevTitleRef.current !== newTitle && newTitle !== 'Newcomer') {
              setTitleUnlock(newTitle);
              setTimeout(() => setTitleUnlock(null), 5000);
            }
            prevTitleRef.current = newTitle;
          } else {
            setUser({ id: firebaseUser.uid });
          }
        });

        // Check for admin claims and route accordingly
        const token = await firebaseUser.getIdTokenResult();
        const isAdmin = token.claims.role === 'admin';

        if (isAdmin) {
          setCurrentView(AppView.ADMIN_DASHBOARD);
        } else {
          // For non-admins, check if their profile is set up
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            // Read stored access, then reconcile against actual browser permission.
            // This corrects stale 'declined' state (Not now recovery, legacy users) and
            // catches browser permission revocations before the map mounts.
            let access = readPersistedAccess();
            if (navigator.permissions) {
              try {
                const perm = await navigator.permissions.query({ name: 'geolocation' });
                const reconciled = resolveFromPermissions(perm.state, access);
                if ((reconciled === 'granted' || reconciled === 'denied') && reconciled !== access) {
                  persistAccessChoice(reconciled);
                  access = reconciled;
                }
              } catch {}
            }
            // Sync React state — ensures allowLocationTracking is correct when MapView mounts
            setLocationAccess(access);
            setCurrentView(shouldShowPrimer(access) ? AppView.LOCATION_PROMPT : AppView.MAP);
          } else {
            setCurrentView(AppView.SETUP_PROFILE);
          }
        }
      } else {
        // No user is logged in
        setUser(null);
        if (isAdminDomain) {
          setCurrentView(AppView.ADMIN_LOGIN);
        } else {
          const hasSeen = !!localStorage.getItem('hasSeenOnboarding');
          setCurrentView(hasSeen ? AppView.CREATE_ACCOUNT : AppView.ONBOARDING);
        }
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

  // Web lifecycle: recheck permission when returning to foreground on the Notifications screen.
  // Native adapters use AppState.addEventListener('change', ...) instead.
  useEffect(() => {
    if (currentView !== AppView.NOTIFICATIONS) return;
    const pState = nearbyPermissionState(locationAccess);
    if (pState !== 'permanently_blocked' && pState !== 'services_disabled') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') locationCallbacks.recheckPermission();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentView, locationAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Language hydration: when a signed-in user's Firestore profile has a valid
  // lang value that differs from the active locale, adopt it as the account
  // source of truth. Only fires when user.lang actually changes.
  useEffect(() => {
    if (!user) return;
    const action = getLanguageHydrationAction(user.lang, getLang());
    if (action.shouldUpdate) setLang(action.language);
  }, [user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleMessageUser = (userId: string, context: string, returnSpotId?: string) => {
    console.log(`Starting chat with ${userId} about ${context}`);
    setActiveChatContext({ userId, context });
    setChatReturnSpotId(returnSpotId ?? null);
    setCurrentView(AppView.MESSAGES);
  };

  const handleCreateAccount = (phone: string, result: ConfirmationResult) => {
    setPhone(phone);
    setConfirmationResult(result);
    setCurrentView(AppView.VERIFY_PHONE);
  };

  const handleNameComplete = async (username: string) => {
    // phone is canonical E.164 — store directly
    try {
      // Only write the fields this step owns — fullName is collected later
      await saveUserProfile({ phone, username });
      setVehicleOnboarding(true);
      setCurrentView(AppView.EDIT_VEHICLE);
    } catch (error: any) {
      console.error("Failed to save profile: ", error);
      alert(error.message || "Failed to save profile.");
    }
  };

  const handleSaveProfile = async (profileData) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");
      const { doc: fsDoc, updateDoc, setDoc } = await import("firebase/firestore");
      // Public fields only — demographics go to the private subcollection
      await updateDoc(fsDoc(db, 'users', uid), {
        fullName: profileData.fullName,
        email: profileData.email,
      });
      // dob and gender are private — write to owner-only subcollection
      const privateUpdates: Record<string, string> = {};
      if (profileData.dob)    privateUpdates.dob    = profileData.dob;
      if (profileData.gender) privateUpdates.gender = profileData.gender;
      if (Object.keys(privateUpdates).length > 0) {
        await setDoc(fsDoc(db, 'users', uid, 'private', 'profile'), privateUpdates, { merge: true });
      }
      setCurrentView(AppView.MAP);
    } catch (error: any) {
      console.error("Failed to save profile: ", error);
      alert(error.message || "Failed to save profile.");
    }
  };


  // Web beta adapter for the native LocationCallbacks interface.
  // The future React Native layer replaces this object with native module calls.
  const locationCallbacks: LocationCallbacks = {
    requestLocationPermission: () => {
      if (!navigator.geolocation) { persistAccessChoice('denied'); setLocationAccess('denied'); return; }
      navigator.geolocation.getCurrentPosition(
        () => { persistAccessChoice('granted'); setLocationAccess('granted'); },
        () => { persistAccessChoice('denied'); setLocationAccess('denied'); },
        { enableHighAccuracy: false, timeout: 15000 }
      );
    },
    openAppSettings: () => {
      // Web beta: no deep-link to app settings; recheck in case the user already changed it
      locationCallbacks.recheckPermission();
    },
    openLocationServicesSettings: () => {
      // Web beta: device-wide Location Services does not apply; no-op
    },
    canOpenAppSettings: false,              // web cannot deep-link to app settings
    canOpenLocationServicesSettings: false, // web cannot open device Location Services
    recheckPermission: async () => {
      if (!navigator.permissions) return;
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        const reconciled = resolveFromPermissions(perm.state, locationAccess);
        if ((reconciled === 'granted' || reconciled === 'denied') && reconciled !== locationAccess) {
          persistAccessChoice(reconciled);
          setLocationAccess(reconciled);
        }
      } catch {}
    },
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
      return <LoadingScreen />;
    }


    // MAP and MESSAGES share the same MapView instance so selectedItem survives the transition
    if (currentView === AppView.MAP || currentView === AppView.MESSAGES) {
      return (
        <>
          <MapView
            user={user}
            onMessageUser={handleMessageUser}
            setView={setCurrentView}
            pendingSpotId={pendingSpotId}
            onPendingSpotConsumed={() => setPendingSpotId(null)}
            allowLocationTracking={locationAccess === 'granted'}
          />
          {currentView === AppView.MESSAGES && (
            <div className="fixed inset-0 z-50 bg-[var(--color-bg)]">
              <MessagesView
                user={user}
                activeChatContext={activeChatContext}
                onBack={() => {
                  setActiveChatContext(null);
                  setChatReturnSpotId(null);
                  setCurrentView(AppView.MAP);
                }}
              />
            </div>
          )}
        </>
      );
    }

    switch (currentView) {
      case AppView.ONBOARDING:
        return <OnboardingView
          onComplete={() => { localStorage.setItem('hasSeenOnboarding', '1'); setCurrentView(AppView.CREATE_ACCOUNT); }}
        />;
      case AppView.CREATE_ACCOUNT:
        return <CreateAccountView
          onContinue={handleCreateAccount}
        />;
      case AppView.VERIFY_PHONE:
        return <VerifyPhoneView
          phone={phone}
          confirmationResult={confirmationResult!}
          onVerify={async () => {
            // Primary: look up by UID — all user docs use firebaseUser.uid as doc ID.
            const uid = auth.currentUser?.uid;
            if (!uid) { setCurrentView(AppView.SETUP_PROFILE); return; }
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              setUser({ id: uid, ...userDoc.data() });
              setCurrentView(locationAccess === 'unknown' ? AppView.LOCATION_PROMPT : AppView.MAP);
            } else {
              setCurrentView(AppView.SETUP_PROFILE);
            }
          }}
          onEditNumber={() => setCurrentView(AppView.CREATE_ACCOUNT)}
        />;
      case AppView.SETUP_PROFILE:
        return <NameEntryView onComplete={handleNameComplete} />;
      case AppView.COMPLETE_PROFILE:
        return <SetupProfileView phone={phone} onSave={handleSaveProfile} onSkip={() => setCurrentView(AppView.PROFILE)} />;
      case AppView.EDIT_PROFILE:
        return <EditProfileView onBack={() => setCurrentView(AppView.SETTINGS)} />;
      case AppView.AI_ASSISTANT:
        return (
          <div className="h-full flex flex-col bg-[var(--color-bg)]">
            <div className="pt-4 px-4 flex items-center gap-4 mb-4">
              <button onClick={() => setCurrentView(AppView.MAP)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Sign Scanner</h1>
                <p className="text-xs text-[var(--color-text-secondary)]">Interpret street rules instantly with AI</p>
              </div>
            </div>
            <AssistantView />
          </div>
        );

      case AppView.PROFILE:
        return <ProfileView user={user} setView={setCurrentView} onBack={() => setCurrentView(AppView.MAP)} />;
      case AppView.SETTINGS:
        return <SettingsView user={user} setView={setCurrentView} onBack={() => setCurrentView(AppView.PROFILE)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} theme={theme} toggleTheme={toggleTheme} permissionState={nearbyPermissionState(locationAccess)} />;
      case AppView.NOTIFICATIONS_SETTINGS:
        return <NotificationsSettingsView user={user} onBack={() => setCurrentView(AppView.SETTINGS)} />;
      case AppView.LOCATION_SETTINGS:
        return <LocationSettingsView user={user} onBack={() => setCurrentView(AppView.SETTINGS)} permissionState={nearbyPermissionState(locationAccess)} callbacks={locationCallbacks} />;
      case AppView.LANGUAGE_SETTINGS:
        return <LanguageSettingsView user={user} onBack={() => setCurrentView(AppView.SETTINGS)} />;
      case AppView.NOTIFICATIONS:
        return <NotificationsView user={user} onBack={() => setCurrentView(AppView.MAP)} onSelectSpot={(id) => { setPendingSpotId(id); setCurrentView(AppView.MAP); }} permissionState={nearbyPermissionState(locationAccess)} callbacks={locationCallbacks} />;
      case AppView.ADMIN_LOGIN:
        return <AdminLoginView onVerified={() => setCurrentView(AppView.ADMIN_DASHBOARD)} />;
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
      case AppView.EDIT_VEHICLE: {
        const afterVehicle = locationAccess === 'unknown' ? AppView.LOCATION_PROMPT : AppView.MAP;
        const afterOnboarding = AppView.PARSONA_PRESET_PICKER;
        return <EditVehicleView
          user={user}
          onBack={() => { setVehicleOnboarding(false); setCurrentView(vehicleOnboarding ? afterOnboarding : AppView.PROFILE); }}
          isOnboarding={vehicleOnboarding}
          onSkip={() => { setVehicleOnboarding(false); setCurrentView(vehicleOnboarding ? afterOnboarding : afterVehicle); }}
        />;
      }
      case AppView.PARSONA_PRESET_PICKER:
        return <ParsonaPresetPickerView
          userId={user?.id ?? ''}
          onDone={() => setCurrentView(locationAccess === 'unknown' ? AppView.LOCATION_PROMPT : AppView.MAP)}
        />;
      case AppView.PARSONA_CREATOR:
        return <ParsonaCreatorView
          user={user}
          onBack={() => setCurrentView(AppView.PROFILE)}
        />;
      case AppView.LOCATION_PROMPT:
        return <LocationPromptView
          onComplete={(access) => {
            persistAccessChoice(access);
            setLocationAccess(access);
            setCurrentView(AppView.MAP);
          }}
        />;
      default:
        return <CreateAccountView
          onContinue={handleCreateAccount}
        />;
    }
  };

  const isMapView = currentView === AppView.MAP || currentView === AppView.MESSAGES;

  // DEV-only Art Lab — never rendered in production
  if (import.meta.env.DEV && ParsonaArtLabView && typeof window !== 'undefined' && window.location.search.includes('qa=parsona-art-lab')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ParsonaArtLabView />
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] font-sans selection:bg-queen-500 selection:text-white transition-colors duration-300">
      <main className={`flex-1 relative ${isMapView ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            {renderView()}
          </Suspense>
        </ErrorBoundary>
      </main>

      {pushToast && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm w-full">
            <div className="w-9 h-9 rounded-full bg-[#1e75ff]/15 flex items-center justify-center shrink-0">
              <span className="text-lg">👑</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[var(--color-text)] truncate">{pushToast.title}</div>
              <div className="text-xs text-[var(--color-text-secondary)] truncate">{pushToast.body}</div>
            </div>
            <button onClick={() => setPushToast(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0 text-lg">&times;</button>
          </div>
        </div>
      )}

      {titleUnlock && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-glass)] backdrop-blur-xl border border-yellow-500/30 rounded-2xl px-6 py-4 shadow-2xl text-center pointer-events-none">
          <div className="text-3xl mb-1">👑</div>
          <p className="text-sm font-bold text-[var(--color-text)]">New Title Unlocked!</p>
          <p className="text-base font-extrabold text-yellow-400 mt-0.5">{titleUnlock}</p>
        </div>
      )}
    </div>
  );
}
