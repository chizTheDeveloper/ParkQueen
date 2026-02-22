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
}

export interface StreetSpot {
  id: string;
  lat: number;
  lng: number;
  type: 'free' | 'paid';
  status: 'available' | 'occupied';
  finderId: string;
  finderName: string;
  reportedAt: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
}
