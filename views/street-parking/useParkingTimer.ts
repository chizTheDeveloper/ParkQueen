import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'pq_parking_timer';

interface ParkingTimer {
    expiresAt: number;
    address: string;
}

export function useParkingTimer() {
    const [timer, setTimer] = useState<ParkingTimer | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            const parsed: ParkingTimer = JSON.parse(stored);
            return parsed.expiresAt > Date.now() ? parsed : null;
        } catch { return null; }
    });
    const notifiedRef = useRef(false);
    const onExpireRef = useRef<(() => void) | null>(null);

    const startTimer = (minutes: number, address: string, onExpire?: () => void) => {
        const t: ParkingTimer = { expiresAt: Date.now() + minutes * 60_000, address };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
        setTimer(t);
        notifiedRef.current = false;
        onExpireRef.current = onExpire ?? null;
    };

    const clearTimer = () => {
        localStorage.removeItem(STORAGE_KEY);
        setTimer(null);
    };

    useEffect(() => {
        if (!timer) return;
        const remaining = timer.expiresAt - Date.now();
        if (remaining <= 0) { clearTimer(); onExpireRef.current?.(); return; }

        const id = setTimeout(() => {
            if (notifiedRef.current) return;
            notifiedRef.current = true;
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('ParQueen — Time to check your car', {
                    body: `Your parking reminder is up${timer.address ? ` at ${timer.address}` : ''}.`,
                    icon: '/Parqueen_Logo.png',
                });
            }
            clearTimer();
            onExpireRef.current?.();
        }, remaining);

        return () => clearTimeout(id);
    }, [timer]);

    const minutesRemaining = timer
        ? Math.max(0, Math.ceil((timer.expiresAt - Date.now()) / 60_000))
        : null;

    return { timer, minutesRemaining, startTimer, clearTimer };
}
