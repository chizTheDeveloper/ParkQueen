import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const TimePicker: React.FC<{ initialTime: Date; onTimeChange: (time: Date) => void; }> = ({ initialTime, onTimeChange }) => {
    const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
    const [minute, setMinute] = useState(initialTime.getMinutes());
    const [amPm, setAmPm] = useState<'AM' | 'PM'>(initialTime.getHours() >= 12 ? 'PM' : 'AM');

    const updateTime = (h: number, m: number, ap: 'AM' | 'PM') => {
        const newDate = new Date(initialTime);
        let newHour = h;
        if (ap === 'PM' && newHour < 12) newHour += 12;
        if (ap === 'AM' && newHour === 12) newHour = 0;
        newDate.setHours(newHour, m, 0, 0);
        onTimeChange(newDate);
    };

    const incrementHour = () => setHour(h => (h % 12) + 1);
    const decrementHour = () => setHour(h => (h - 1 <= 0 ? 12 : h - 1));
    const incrementMinute = () => setMinute(m => (m + 1) % 60);
    const decrementMinute = () => setMinute(m => (m - 1 < 0 ? 59 : m - 1));

    useEffect(() => {
        updateTime(hour, minute, amPm);
    }, [hour, minute, amPm]);

    const chevronClass = "w-10 h-10 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay)] active:scale-90 transition-all";
    const digitClass = "text-4xl font-bold w-16 text-center text-[var(--color-text)] tabular-nums";

    return (
        <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-center">
                <button onClick={incrementHour} className={chevronClass}><ChevronUp size={22} /></button>
                <span className={digitClass}>{hour.toString().padStart(2, '0')}</span>
                <button onClick={decrementHour} className={chevronClass}><ChevronDown size={22} /></button>
            </div>
            <span className="text-3xl font-bold text-[var(--color-text)] pb-1">:</span>
            <div className="flex flex-col items-center">
                <button onClick={incrementMinute} className={chevronClass}><ChevronUp size={22} /></button>
                <span className={digitClass}>{minute.toString().padStart(2, '0')}</span>
                <button onClick={decrementMinute} className={chevronClass}><ChevronDown size={22} /></button>
            </div>
            <div className="flex flex-col gap-1.5 ml-2">
                <button onClick={() => setAmPm('AM')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${amPm === 'AM' ? 'bg-blue-500 text-white' : 'bg-[var(--color-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'}`}>
                    AM
                </button>
                <button onClick={() => setAmPm('PM')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${amPm === 'PM' ? 'bg-blue-500 text-white' : 'bg-[var(--color-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'}`}>
                    PM
                </button>
            </div>
        </div>
    );
};
