// AppView constant for navigation and state management
export const AppView = {
  MAP: 'MAP',
  GARAGE_LIST: 'GARAGE_LIST',
  MESSAGES: 'MESSAGES',
  PROFILE: 'PROFILE',
  HOST_DASHBOARD: 'HOST_DASHBOARD',
  AI_ASSISTANT: 'AI_ASSISTANT',
  NOTIFICATIONS: 'NOTIFICATIONS'
} as const;

// AppView type derived from the constant for use in type annotations
export type AppView = keyof typeof AppView;

// StreetSpot interface for community-reported parking spots
export interface StreetSpot {
  id: string;
  lat: number;
  lng: number;
  type: 'free' | 'paid';
  status: 'available' | 'occupied';
  finderName: string;
  finderId: string;
  reportedAt: Date;
  leavingAt?: Date;
}