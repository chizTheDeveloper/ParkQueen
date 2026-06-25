
import React, { useState, useRef } from 'react';
import { User, Mail, Calendar, ChevronDown, Camera } from 'lucide-react';

interface SetupProfileViewProps {
  phone: string;
  onSave: (profileData: { fullName: string; email: string; dob: string; gender: string, avatar: File | null }) => void;
  onSkip?: () => void;
}

const InputField = ({ icon, label, value, onChange, placeholder, type = 'text', onClick = null, autoComplete = 'off' }) => {
    const commonProps = {
        className: "w-full bg-transparent text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)] text-sm",
    };
    
    return (
        <div className="bg-[var(--color-card)] p-3 rounded-2xl border border-[var(--color-border)] shadow-inner w-full focus-within:border-[#1e75ff] transition-all" onClick={onClick}>
          <label className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider px-1">{label}</label>
          <div className="flex items-center mt-1">
            <div className="text-[var(--color-text-secondary)] mr-3 shrink-0">{icon}</div>
            {onClick ? (
                <div {...commonProps}>{value || <span className="text-gray-550">{placeholder}</span>}</div>
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
            <div className="bg-[var(--color-card)] p-3 rounded-2xl border border-[var(--color-border)] shadow-inner w-full cursor-pointer hover:border-[#1e75ff] transition-all" onClick={() => setIsOpen(!isOpen)}>
                <label className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider px-1">{label}</label>
                <div className="flex items-center mt-1">
                    <div className="text-[var(--color-text-secondary)] mr-3 shrink-0">{icon}</div>
                    <span className="w-full bg-transparent text-[var(--color-text)] font-semibold outline-none text-sm">
                        {value}
                    </span>
                    <ChevronDown className={`text-[var(--color-text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {options.map(opt => (
                        <div
                            key={opt}
                            onClick={() => handleSelect(opt)}
                            className={`p-3.5 cursor-pointer text-sm font-medium border-b border-[var(--color-border)] last:border-0 hover:bg-white/5 transition-colors ${value === opt ? 'bg-[#1e75ff] text-white font-semibold hover:bg-blue-600' : 'text-gray-200'}`}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const SetupProfileView: React.FC<SetupProfileViewProps> = ({ phone, onSave, onSkip }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [isGenderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    let formattedVal = val;
    if (val.length > 2) {
      formattedVal = `${val.slice(0, 2)}-${val.slice(2)}`;
    }
    if (val.length > 4) {
      formattedVal = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 8)}`;
    }
    setDob(formattedVal);
  };

  const handleSave = () => {
    onSave({ fullName, email, dob, gender, avatar });
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
    <div className="h-full overflow-y-auto bg-[var(--color-bg)] flex flex-col items-center p-4 pb-24 font-sans text-[var(--color-text)]">
      <div className="w-full max-w-sm my-auto">
        <h1 className="text-2xl font-bold text-center text-[var(--color-text)] mt-8 mb-6">Setup Profile</h1>

        <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="w-full h-full rounded-full bg-white/5 border-2 border-[var(--color-border)] flex items-center justify-center shadow overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-user text-4xl text-[var(--color-text-secondary)]"></i>
                )}
            </div>
            <button onClick={triggerUpload} className="absolute bottom-1 right-1 bg-[#1e75ff] hover:bg-blue-600 text-white rounded-full p-2.5 shadow-md active:scale-95 transition-all">
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
                onChange={handleDobChange}
                placeholder="MM-DD-YYYY"
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

        <div className="mt-8 mb-4 space-y-3">
            <button onClick={handleSave} className="w-full bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-md shadow-blue-500/20 transition-all">
                Save
            </button>
            {onSkip && (
                <button onClick={onSkip} className="w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] font-semibold py-3 text-sm transition-all">
                    Skip for now
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
