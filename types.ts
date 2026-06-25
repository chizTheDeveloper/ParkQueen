export enum AppView {
  SPLASH = 'splash',
  LOGIN = 'login',
  CREATE_ACCOUNT = 'create-account',
  SETUP_PROFILE = 'setup-profile',
  EDIT_PROFILE = 'edit-profile',
  MAP = 'map',
  GARAGE_LIST = 'garage-list',
  HOST_DASHBOARD = 'host-dashboard',
  AI_ASSISTANT = 'ai-assistant',
  MESSAGES = 'messages',
  PROFILE = 'profile',
  NOTIFICATIONS = 'notifications',
  ADMIN_DASHBOARD = 'admin-dashboard',
  PARKING_SPACE = 'parking-space',
  PRIVACY_POLICY = 'privacy-policy',
  TERMS_OF_USE = 'terms-of-use',
  CONTACT_US = 'contact-us',
  ONBOARDING = 'onboarding',
  VERIFY_PHONE = 'verify-phone',
  COMPLETE_PROFILE = 'complete-profile',
  SETTINGS = 'settings',
}

export interface StreetSpot {
  id: string;
  lat: number;
  lng: number;
  type: 'free' | 'paid';
  status: 'available' | 'claimed' | 'occupied';
  finderId: string;
  finderName: string;
  reportedAt: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
  claimedBy?: string | null;
  holdRequestedBy?: string;
  holdRequestedByName?: string;
  holdRequestStatus?: 'pending' | 'accepted' | 'declined' | 'completed';
  holdRequestExpiresAt?: any; // Firestore Timestamp
  holdTimerExpiresAt?: any; // Firestore Timestamp
}
