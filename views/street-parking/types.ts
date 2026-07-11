import { AppView } from '../../types';

export interface MapItem {
    id: string;
    lat: number;
    lng: number;
    type: 'free' | 'paid' | 'public';
    status: 'available' | 'interested' | 'occupied';
    title: string;
    pricePerHour?: number;
    description?: string;
    reportedAt?: any;
    expiresAt?: any;
    finderId?: string;
    finderName?: string;
    finderTitle?: string | null;
    finderVehicleColor?: string | null;
    finderVehicleType?: string | null;
    finderVehicleBrand?: string | null;
    interestedUserId?: string | null;
    interestedUserName?: string | null;
    interestedUserVehicleColor?: string | null;
    interestedUserVehicleType?: string | null;
    interestedUserVehicleBrand?: string | null;
    interestedUserTitle?: string | null;
    etaMinutes?: number | null;
    interestExpiresAt?: any;
    address?: string;
    originSpotId?: string | null;
    geohash?: string;
    rawSpot?: any;
    holdRequestStatus?: string | null;
    holdRequestedBy?: string | null;
    holdTimerExpiresAt?: any;
    pingMode?: 'now' | 'later' | null;
}

export interface MapViewProps {
    user: any;
    setView: (view: AppView) => void;
    onMessageUser: (userId: string, context: string) => void;
    pendingSpotId?: string | null;
    onPendingSpotConsumed?: () => void;
}
