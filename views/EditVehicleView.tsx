import React, { useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const BRANDS = ['Acura','Audi','BMW','Buick','Cadillac','Chevrolet','Chrysler','Dodge','Ford','GMC','Honda','Hyundai','Infiniti','Jeep','Kia','Lexus','Lincoln','Mazda','Mercedes-Benz','Mitsubishi','Nissan','Ram','Subaru','Tesla','Toyota','Volkswagen','Volvo'];
const COLORS = ['Beige','Black','Blue','Brown','Gold','Gray','Green','Orange','Purple','Red','Silver','White','Yellow'];
const TYPES = ['Convertible','Coupe','Hatchback','Minivan','Pickup Truck','Sedan','SUV','Van','Wagon'];

interface Props {
  user: any;
  onBack: () => void;
  isOnboarding?: boolean;
  onSkip?: () => void;
}

const Select = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full appearance-none bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl px-4 py-3.5 pr-10 text-sm focus:outline-none focus:border-[#1e75ff] transition-colors"
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
  </div>
);

export const EditVehicleView = ({ user, onBack, isOnboarding, onSkip }: Props) => {
  const [brand, setBrand] = useState(user?.vehicleBrand || '');
  const [color, setColor] = useState(user?.vehicleColor || '');
  const [type, setType] = useState(user?.vehicleType || '');
  const [saving, setSaving] = useState(false);

  const hasVehicle = brand || color || type;

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', user.id), {
      vehicleBrand: brand,
      vehicleColor: color,
      vehicleType: type,
    });
    setSaving(false);
    onBack();
  };

  const handleClear = async () => {
    if (!user?.id) return;
    setBrand(''); setColor(''); setType('');
    await updateDoc(doc(db, 'users', user.id), {
      vehicleBrand: '',
      vehicleColor: '',
      vehicleType: '',
    });
  };

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      <div className="max-w-md mx-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={isOnboarding ? onSkip : onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">
            {isOnboarding ? 'Add Your Vehicle' : 'My Vehicle'}
          </h2>
          <div className="w-10" />
        </div>

        {isOnboarding && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6 px-4">
            Help other drivers identify you during parking handoffs. This is optional and can be changed anytime.
          </p>
        )}

        <div className="space-y-3 mb-6">
          <Select label="Vehicle Brand" value={brand} options={BRANDS} onChange={setBrand} />
          <Select label="Vehicle Color" value={color} options={COLORS} onChange={setColor} />
          <Select label="Vehicle Type" value={type} options={TYPES} onChange={setType} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 mb-3"
        >
          {saving ? 'Saving...' : 'Save Vehicle'}
        </button>

        {isOnboarding ? (
          <button onClick={onSkip} className="w-full py-3 text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
            Skip for now
          </button>
        ) : hasVehicle ? (
          <button onClick={handleClear} className="w-full py-3 text-center text-sm text-red-400 hover:text-red-300 transition-colors">
            Remove vehicle
          </button>
        ) : null}
      </div>
    </div>
  );
};
