import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const TimePicker: React.FC<{ initialTime: Date; onTimeChange: (time: Date) => void; }> = ({ initialTime, onTimeChange }) => {
    const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
    const [minute, setMinute] = useState(initialTime.getMinutes());
    const [amPm, setAmPm] = useState<'AM' | 'PM'>(initialTime.getHours() >= 12 ? 'PM' : 'AM');
    const hourInputRef = useRef<HTMLInputElement>(null);
    const minuteInputRef = useRef<HTMLInputElement>(null);

    const updateTime = (h: number, m: number, ap: 'AM' | 'PM') => {
        const newDate = new Date(initialTime);
        let newHour = h;
        if (ap === 'PM' && newHour < 12) newHour += 12;
        if (ap === 'AM' && newHour === 12) newHour = 0;
        newDate.setHours(newHour, m, 0, 0);
        onTimeChange(newDate);
    };

    useEffect(() => { updateTime(hour, minute, amPm); }, [hour, minute, amPm]);

    // Sync DOM input when chevrons change the value
    useEffect(() => {
        if (hourInputRef.current && document.activeElement !== hourInputRef.current)
            hourInputRef.current.value = hour.toString().padStart(2, '0');
    }, [hour]);

    useEffect(() => {
        if (minuteInputRef.current && document.activeElement !== minuteInputRef.current)
            minuteInputRef.current.value = minute.toString().padStart(2, '0');
    }, [minute]);

    const incrementHour = () => setHour(h => (h % 12) + 1);
    const decrementHour = () => setHour(h => (h - 1 <= 0 ? 12 : h - 1));
    const incrementMinute = () => setMinute(m => (m + 1) % 60);
    const decrementMinute = () => setMinute(m => (m - 1 < 0 ? 59 : m - 1));

    const handleHourChange = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, 2);
        if (hourInputRef.current) hourInputRef.current.value = digits;
        if (digits === '') return;
        const n = parseInt(digits, 10);
        if (digits.length === 2 && n >= 1 && n <= 12) {
            setHour(n);
            minuteInputRef.current?.focus();
            minuteInputRef.current?.select();
        }
    };

    const handleHourBlur = () => {
        const raw = hourInputRef.current?.value || '';
        const n = parseInt(raw, 10);
        const valid = n >= 1 && n <= 12 ? n : hour;
        setHour(valid);
        if (hourInputRef.current) hourInputRef.current.value = valid.toString().padStart(2, '0');
    };

    const handleMinuteChange = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, 2);
        if (minuteInputRef.current) minuteInputRef.current.value = digits;
        if (digits === '') return;
        const n = parseInt(digits, 10);
        if (digits.length === 2 && n >= 0 && n <= 59) {
            setMinute(n);
            minuteInputRef.current?.blur();
        }
    };

    const handleMinuteBlur = () => {
        const raw = minuteInputRef.current?.value || '';
        const n = parseInt(raw, 10);
        const valid = n >= 0 && n <= 59 ? n : minute;
        setMinute(valid);
        if (minuteInputRef.current) minuteInputRef.current.value = valid.toString().padStart(2, '0');
    };

    const chevronClass = "w-10 h-10 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-overlay)] active:scale-90 transition-all";
    const digitInputClass = "text-4xl font-bold w-16 text-center text-[var(--color-text)] tabular-nums bg-transparent border-none outline-none focus:bg-[var(--color-overlay)] rounded-lg caret-transparent";

    return (
        <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-center">
                <button onClick={incrementHour} className={chevronClass}><ChevronUp size={22} /></button>
                <input
                    ref={hourInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={hour.toString().padStart(2, '0')}
                    maxLength={2}
                    onChange={(e) => handleHourChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onBlur={handleHourBlur}
                    className={digitInputClass}
                />
                <button onClick={decrementHour} className={chevronClass}><ChevronDown size={22} /></button>
            </div>
            <span className="text-3xl font-bold text-[var(--color-text)] pb-1">:</span>
            <div className="flex flex-col items-center">
                <button onClick={incrementMinute} className={chevronClass}><ChevronUp size={22} /></button>
                <input
                    ref={minuteInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={minute.toString().padStart(2, '0')}
                    maxLength={2}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onBlur={handleMinuteBlur}
                    className={digitInputClass}
                />
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
