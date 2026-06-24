import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const TimePicker: React.FC<{ initialTime: Date; onTimeChange: (time: Date) => void; }> = ({ initialTime, onTimeChange }) => {
    const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
    const [minute, setMinute] = useState(initialTime.getMinutes());
    const [amPm, setAmPm] = useState(initialTime.getHours() >= 12 ? 'PM' : 'AM');

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

    return (
        <div className="flex items-center justify-center space-x-2">
            <div className="flex flex-col items-center"><button onClick={incrementHour}><ChevronUp size={24} /></button><span className="text-4xl font-bold w-16 text-center">{hour.toString().padStart(2, '0')}</span><button onClick={decrementHour}><ChevronDown size={24} /></button></div>
            <span className="text-4xl font-bold">:</span>
            <div className="flex flex-col items-center"><button onClick={incrementMinute}><ChevronUp size={24} /></button><span className="text-4xl font-bold w-16 text-center">{minute.toString().padStart(2, '0')}</span><button onClick={decrementMinute}><ChevronDown size={24} /></button></div>
            <div className="flex flex-col space-y-2"><button onClick={() => setAmPm('AM')} className={`px-2 py-1 rounded ${amPm === 'AM' ? 'bg-blue-500' : 'bg-gray-600'}`}>AM</button><button onClick={() => setAmPm('PM')} className={`px-2 py-1 rounded ${amPm === 'PM' ? 'bg-blue-500' : 'bg-gray-600'}`}>PM</button></div>
        </div>
    );
};
