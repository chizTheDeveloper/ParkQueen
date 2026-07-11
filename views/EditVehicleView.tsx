import React, { useState, useRef } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { ChevronLeft, ChevronDown, Trash2 } from 'lucide-react';
import { VehicleIcon } from '../utils/vehicleIcon';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { t, useLang } from '../i18n';

const BRANDS = ['Acura','Audi','BMW','Buick','Cadillac','Chevrolet','Chrysler','Dodge','Ford','GMC','Honda','Hyundai','Infiniti','Jeep','Kia','Lexus','Lincoln','Mazda','Mercedes-Benz','Mitsubishi','Nissan','Ram','Subaru','Tesla','Toyota','Volkswagen','Volvo'];

const COLORS: { name: string; hex: string }[] = [
  { name: 'Black',  hex: '#1C1C1E' },
  { name: 'White',  hex: '#F2F2F7' },
  { name: 'Silver', hex: '#AEAEB2' },
  { name: 'Gray',   hex: '#636366' },
  { name: 'Blue',   hex: '#2563EB' },
  { name: 'Red',    hex: '#DC2626' },
  { name: 'Green',  hex: '#16A34A' },
  { name: 'Brown',  hex: '#7C3A1E' },
  { name: 'Beige',  hex: '#D4B896' },
  { name: 'Gold',   hex: '#D4AF37' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Purple', hex: '#7C3AED' },
];

const TYPES = ['Sedan','SUV','Hatchback','Coupe','Pickup Truck','Van','Minivan','Wagon','Convertible'];

interface Props {
  user: any;
  onBack: () => void;
  isOnboarding?: boolean;
  onSkip?: () => void;
}

export const EditVehicleView = ({ user, onBack, isOnboarding, onSkip }: Props) => {
  useLang();
  const [brand, setBrand] = useState(user?.vehicleBrand || '');
  const [color, setColor] = useState(user?.vehicleColor || '');
  const [type, setType] = useState(user?.vehicleType || '');
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef);

  // Display label lookups — values stored to Firestore remain English
  const colorLabels: Record<string, string> = {
    'Black': t('vehicle.color_black'), 'White': t('vehicle.color_white'),
    'Silver': t('vehicle.color_silver'), 'Gray': t('vehicle.color_gray'),
    'Blue': t('vehicle.color_blue'), 'Red': t('vehicle.color_red'),
    'Green': t('vehicle.color_green'), 'Brown': t('vehicle.color_brown'),
    'Beige': t('vehicle.color_beige'), 'Gold': t('vehicle.color_gold'),
    'Yellow': t('vehicle.color_yellow'), 'Orange': t('vehicle.color_orange'),
    'Purple': t('vehicle.color_purple'),
  };
  const typeLabels: Record<string, string> = {
    'Sedan': t('vehicle.type_sedan'), 'SUV': t('vehicle.type_suv'),
    'Hatchback': t('vehicle.type_hatchback'), 'Coupe': t('vehicle.type_coupe'),
    'Pickup Truck': t('vehicle.type_pickup_truck'), 'Van': t('vehicle.type_van'),
    'Minivan': t('vehicle.type_minivan'), 'Wagon': t('vehicle.type_wagon'),
    'Convertible': t('vehicle.type_convertible'),
  };

  const hasVehicle = user?.vehicleBrand || user?.vehicleColor || user?.vehicleType;
  const hasSelection = brand || color || type;

  const previewParts = [color ? colorLabels[color] ?? color : '', brand].filter(Boolean).join(' ');
  const showPreview = brand || color || type;

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
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={isOnboarding ? onSkip : onBack}
            aria-label={t('vehicle.back_aria')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-[var(--color-text)] tracking-wide focus:outline-none">
            {isOnboarding ? t('vehicle.add_title') : t('vehicle.edit_title')}
          </h2>
          {isOnboarding && onSkip ? (
            <button onClick={onSkip} className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors px-1">
              {t('vehicle.skip')}
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {isOnboarding && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center mb-4 px-2">
            {t('vehicle.onboarding_hint')}
          </p>
        )}

        <div className="space-y-3">

          {/* Live Preview Card */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-4 flex items-center gap-3.5">
            <VehicleIcon type={type} color={color} size={28} />
            <div>
              {showPreview ? (
                <>
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    {previewParts || <span className="text-[var(--color-text-secondary)] font-normal">—</span>}
                    {type ? <span className="text-[var(--color-text-secondary)] font-normal"> • {typeLabels[type] ?? type}</span> : null}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('vehicle.preview_label')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t('vehicle.no_vehicle')}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('vehicle.pick_below')}</p>
                </>
              )}
            </div>
          </div>

          {/* Brand */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('vehicle.brand_label')}</p>
            </div>
            <div className="relative px-4 py-1">
              <select
                aria-label={t('vehicle.brand_label')}
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full appearance-none text-[var(--color-text)] py-3.5 pr-8 text-sm focus:outline-none dark:[color-scheme:dark]"
                style={{ backgroundColor: 'var(--color-card)' }}
              >
                <option value="">{t('vehicle.select_brand')}</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
            </div>
          </div>

          {/* Color Swatches */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                {t('vehicle.color_label')}{color ? <span className="ml-1.5 text-[#38bdf8] normal-case font-semibold tracking-normal">— {colorLabels[color] ?? color}</span> : null}
              </p>
            </div>
            <div className="px-4 py-4 grid grid-cols-7 gap-3">
              {COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setColor(color === c.name ? '' : c.name)}
                  className="flex flex-col items-center gap-1 group"
                  aria-label={colorLabels[c.name] ?? c.name}
                  aria-pressed={color === c.name}
                >
                  <div
                    className="w-8 h-8 rounded-full transition-all duration-150 active:scale-90"
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: color === c.name
                        ? `0 0 0 2px var(--color-bg), 0 0 0 4px #1e75ff`
                        : '0 0 0 1px rgba(255,255,255,0.12)',
                    }}
                  />
                  <span className="text-[10px] text-[var(--color-text-secondary)] leading-none">{colorLabels[c.name] ?? c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Type Pills */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('vehicle.type_label')}</p>
            </div>
            <div className="px-4 py-3.5 flex flex-wrap gap-2">
              {TYPES.map(typeName => (
                <button
                  key={typeName}
                  onClick={() => setType(type === typeName ? '' : typeName)}
                  aria-pressed={type === typeName}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-95 ${
                    type === typeName
                      ? 'bg-[#1e75ff] border-[#1e75ff] text-white'
                      : 'bg-white/5 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[#1e75ff]/50'
                  }`}
                >
                  {typeLabels[typeName] ?? typeName}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !hasSelection}
            className="w-full py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-40 mt-1"
          >
            {saving ? t('vehicle.saving') : t('vehicle.save')}
          </button>

          {isOnboarding && onSkip && (
            <button
              onClick={onSkip}
              className="w-full py-3 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors active:scale-[0.98]"
            >
              {t('vehicle.skip_for_now')}
            </button>
          )}

          {/* Remove vehicle — only when editing and vehicle exists */}
          {!isOnboarding && hasVehicle && (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden mt-1">
              <button
                onClick={handleClear}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-400">{t('vehicle.remove')}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('vehicle.remove_subtitle')}</p>
                </div>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
