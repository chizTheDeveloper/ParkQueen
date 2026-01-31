
export enum AppView {
  MAP = "MAP",
  GARAGE_LIST = "GARAGE_LIST",
  AI_ASSISTANT = "AI_ASSISTANT",
  MESSAGES = "MESSAGES",
  NOTIFICATIONS = "NOTIFICATIONS",
  PROFILE = "PROFILE",
}

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
