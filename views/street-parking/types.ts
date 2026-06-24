import { AppView } from '../../types';

export interface MapItem {
    id: string;
    lat: number;
    lng: number;
    type: 'free' | 'paid' | 'public';
    status: 'available' | 'claimed' | 'occupied';
    title: string;
    pricePerHour?: number;
    description?: string;
    reportedAt?: any;
    expiresAt?: any;
    finderId?: string;
    finderName?: string;
    claimedBy?: string | null;
    holdRequestedBy?: string;
    holdRequestedByName?: string;
    holdRequestStatus?: string;
    holdTimerExpiresAt?: any;
    rawSpot?: any;
}

export interface MapViewProps {
    user: any;
    setView: (view: AppView) => void;
    onMessageUser: (userId: string, context: string) => void;
}
