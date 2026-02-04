import React, { useState } from 'react';
import { User, Mail, Calendar, ChevronDown, Camera } from 'lucide-react';

interface SetupProfileViewProps {
  phone: string;
  onSave: (profileData: { fullName: string; email: string; dob: string; gender: string }) => void;
}

export const SetupProfileView: React.FC<SetupProfileViewProps> = ({ phone, onSave }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [isGenderDropdownOpen, setGenderDropdownOpen] = useState(false);

  const handleSave = () => {
    onSave({ fullName, email, dob, gender });
  };

  const InputField = ({ icon, label, value, onChange, placeholder, type = 'text' }) => (
    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm w-full">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      <div className="flex items-center mt-1">
        <div className="text-gray-400 mr-3">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-gray-800 font-semibold outline-none placeholder-gray-400"
        />
      </div>
    </div>
  );

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
                            className={`p-3 cursor-pointer ${value === opt ? 'bg-gray-600 text-white' : 'text-gray-800 hover:bg-gray-100'}`}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };


  return (
    <div className="h-screen bg-sky-50 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mt-8 mb-6">Setup Profile</h1>

        <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="w-full h-full rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow">
                 <span className="text-sm text-gray-400">Avatar</span>
            </div>
            <button className="absolute bottom-1 right-1 bg-blue-500 text-white rounded-full p-2.5 shadow-md">
                <Camera size={18} />
            </button>
        </div>

        <div className="space-y-4">
            <InputField
                icon={<User size={20} />}
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Johan Doe"
            />
            <InputField
                icon={<Mail size={20} />}
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="johandoe@gmail.com"
                type="email"
            />
             <InputField
                icon={<Calendar size={20} />}
                label="Date of Birth"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="yyyy-mm-dd"
                type="text"
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
        </div>

        <div className="mt-8">
            <button onClick={handleSave} className="w-full bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform">
                Create
            </button>
        </div>
      </div>
    </div>
  );
};
