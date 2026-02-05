
import React, { useState, useRef, useMemo } from 'react';
import { User, Mail, Calendar, ChevronDown, Camera, ChevronLeft, ChevronRight, Search, Lock } from 'lucide-react';

interface SetupProfileViewProps {
  phone: string;
  onSave: (profileData: { fullName: string; email: string; dob: string; gender: string, avatar: File | null, password: string }) => void;
}

const InputField = ({ icon, label, value, onChange, placeholder, type = 'text', onClick = null, autoComplete = 'off' }) => {
    const commonProps = {
        className: "w-full bg-transparent text-gray-800 font-semibold outline-none placeholder-gray-400",
    };
    
    return (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full" onClick={onClick}>
          <label className="text-xs text-gray-400 font-medium">{label}</label>
          <div className="flex items-center mt-1">
            <div className="text-gray-400 mr-3">{icon}</div>
            {onClick ? (
                <div {...commonProps}>{value || <span className="text-gray-400">{placeholder}</span>}</div>
            ) : (
                <input
                  type={type}
                  value={value}
                  onChange={onChange}
                  placeholder={placeholder}
                  autoComplete={autoComplete}
                  {...commonProps}
                />
            )}
          </div>
        </div>
    );
};

const SelectField = ({ icon, label, value, onChange, options, isOpen, setIsOpen }) => {
    const handleSelect = (option) => {
        onChange({ target: { value: option } });
        setIsOpen(false);
    };

    return (
        <div className="relative w-full">
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <label className="text-xs text-gray-400 font-medium">{label}</label>
                <div className="flex items-center mt-1">
                    <div className="text-gray-400 mr-3">{icon}</div>
                    <span className="w-full bg-transparent text-gray-800 font-semibold outline-none">
                        {value}
                    </span>
                    <ChevronDown className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="absolute top-full mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-10 overflow-hidden">
                    {options.map(opt => (
                        <div
                            key={opt}
                            onClick={() => handleSelect(opt)}
                            className={`p-3 cursor-pointer ${value === opt ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DatePicker = ({ value, onChange, onClose }) => {
    const [view, setView] = useState('year');
    const initialDate = useMemo(() => value ? new Date(value) : new Date(new Date().setFullYear(new Date().getFullYear() - 25)), [value]);
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [decadeStart, setDecadeStart] = useState(Math.floor(initialDate.getFullYear() / 10) * 10);
    const [jumpToYear, setJumpToYear] = useState('');

    const isDateFullySelected = useMemo(() => !!value, [value]);

    const formatDateSummary = (date) => {
        if (!date) return '-';
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const handleYearSelect = (year) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(year);
        setSelectedDate(newDate);
        setView('month');
    };

    const handleMonthSelect = (monthIndex) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(monthIndex);
        setSelectedDate(newDate);
        setView('day');
    };

    const handleDaySelect = (day) => {
        const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        onChange(newDate.toISOString().split('T')[0]);
        setSelectedDate(newDate);
    };

    const confirmDate = () => {
        if (isDateFullySelected) {
            onChange(selectedDate.toISOString().split('T')[0]);
            onClose();
        }
    };
    
    const renderYearView = () => {
        const years = Array.from({ length: 10 }, (_, i) => decadeStart + i);
        return (
            <div className="px-1">
                <div className="flex items-center justify-between mb-5">
                    <button onClick={() => setDecadeStart(decadeStart - 10)} className="p-2 rounded-full hover:bg-gray-100 text-gray-700"><ChevronLeft size={20} /></button>
                    <div className="font-bold text-lg text-gray-800">{decadeStart} – {decadeStart + 9}</div>
                    <button onClick={() => setDecadeStart(decadeStart + 10)} className="p-2 rounded-full hover:bg-gray-100 text-gray-700"><ChevronRight size={20} /></button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {years.map(year => (
                        <button
                            key={year}
                            onClick={() => handleYearSelect(year)}
                            className={`py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${year === selectedDate.getFullYear() ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}>
                            {year}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return (
            <div className="px-1">
                <div className="grid grid-cols-4 gap-3">
                    {monthNames.map((month, index) => (
                        <button
                            key={month}
                            onClick={() => handleMonthSelect(index)}
                            className={`py-2 px-3 text-sm font-semibold rounded-lg transition-colors ${index === selectedDate.getMonth() ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}>
                            {month}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
        const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        return (
            <div className="px-1">
                 <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500 mb-3">
                    {weekDays.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                    {Array.from({ length: daysInMonth }).map((_, day) => {
                        const dayNumber = day + 1;
                        const isSelected = value && new Date(value).toDateString() === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNumber).toDateString();
                        return (
                            <button
                                key={dayNumber}
                                onClick={() => handleDaySelect(dayNumber)}
                                className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
                                {dayNumber}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const steps = ['Year', 'Month', 'Day'];
    const currentStepIndex = steps.indexOf(view.charAt(0).toUpperCase() + view.slice(1));

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5" onMouseDown={e => e.stopPropagation()}>
                <div className="text-center">
                    <h3 className="font-bold text-xl text-gray-900">Date of Birth</h3>
                    <p className="text-gray-600 font-semibold mt-1">{formatDateSummary(isDateFullySelected ? new Date(value) : null)}</p>
                </div>

                <div className="flex items-center justify-center space-x-2 border-b-2">
                    {steps.map((step, index) => (
                        <button key={step} onClick={() => setView(step.toLowerCase())} className={`px-3 py-2 text-sm font-bold transition-colors ${view === step.toLowerCase() ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                           {step}
                        </button>
                    ))}
                </div>

                <div className="h-52">
                   {view === 'year' && renderYearView()}
                   {view === 'month' && renderMonthView()}
                   {view === 'day' && renderDayView()}
                </div>

                {view === 'year' && (
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                        <input 
                           type="number"
                           value={jumpToYear}
                           onChange={(e) => {
                               const year = e.target.value;
                               setJumpToYear(year);
                               if (year.length === 4) {
                                   setDecadeStart(Math.floor(parseInt(year, 10) / 10) * 10);
                               }
                           }}
                           placeholder="Jump to year"
                           className="w-full border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}
                

                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    <button onClick={onClose} className="py-3 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-bold text-center hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={confirmDate} disabled={!isDateFullySelected} className="py-3 px-4 bg-blue-600 text-white rounded-lg font-bold text-center transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed hover:bg-blue-700">Confirm Date</button>
                </div>
            </div>
        </div>
    );
};


export const SetupProfileView: React.FC<SetupProfileViewProps> = ({ phone, onSave }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGenderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    onSave({ fullName, email, dob, gender, avatar, password });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-full overflow-y-auto bg-sky-50 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-sm my-auto">
        <h1 className="text-2xl font-bold text-center text-gray-800 mt-8 mb-6">Setup Profile</h1>

        <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="w-full h-full rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm text-gray-400">Avatar</span>
                )}
            </div>
            <button onClick={triggerUpload} className="absolute bottom-1 right-1 bg-blue-500 text-white rounded-full p-2.5 shadow-md">
                <Camera size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
        </div>

        <div className="space-y-4">
            <InputField
                icon={<User size={20} />}
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Johan Doe"
                autoComplete="name"
            />
            <InputField
                icon={<Mail size={20} />}
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="johandoe@gmail.com"
                type="email"
                autoComplete="email"
            />
             <InputField
                icon={<Calendar size={20} />}
                label="Date of Birth"
                value={dob}
                placeholder="yyyy-mm-dd"
                onClick={() => setDatePickerOpen(true)}
             />

            <SelectField
                icon={<User size={20} />}
                label="Gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                options={['Male', 'Female', 'Other']}
                isOpen={isGenderDropdownOpen}
                setIsOpen={setGenderDropdownOpen}
            />
            <InputField
                icon={<Lock size={20} />}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type="password"
                autoComplete="new-password"
            />
            <InputField
                icon={<Lock size={20} />}
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                type="password"
                autoComplete="new-password"
            />
        </div>

        <div className="mt-8 mb-4">
            <button onClick={handleSave} className="w-full bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform">
                Create
            </button>
        </div>
      </div>
      {isDatePickerOpen && (
        <DatePicker 
            value={dob}
            onChange={setDob}
            onClose={() => setDatePickerOpen(false)}
        />
      )}
    </div>
  );
};
