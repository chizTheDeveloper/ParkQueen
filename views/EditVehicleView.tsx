import React, { useState, useRef, useMemo } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { SignupProgress } from '../components/SignupProgress';
import { ChevronLeft, ChevronRight, Search, Trash2, Check } from 'lucide-react';
import { VehicleIcon } from '../utils/vehicleIcon';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { t, useLang } from '../i18n';

// ─── Brand Data ──────────────────────────────────────────────────────────────

const ALL_BRANDS = [
  'Acura','Alfa Romeo','Aston Martin','Audi','Bentley','BMW','Bugatti','Buick',
  'Cadillac','Chevrolet','Chrysler','Citroën','Dodge','Ferrari','Fiat','Ford',
  'Genesis','GMC','Honda','Hyundai','Infiniti','Jaguar','Jeep','Kia',
  'Koenigsegg','Lamborghini','Land Rover','Lexus','Lincoln','Lotus','Lucid',
  'Maserati','Mazda','McLaren','Mercedes-Benz','Mini','Mitsubishi','Nissan',
  'Peugeot','Polestar','Porsche','Ram','Renault','Rivian','Rolls-Royce',
  'Subaru','Suzuki','Tesla','Toyota','Volkswagen','Volvo',
];

// ─── Color Data ───────────────────────────────────────────────────────────────

const COLORS: { name: string; hex: string }[] = [
  { name: 'Black',       hex: '#1C1C1E' },
  { name: 'White',       hex: '#F2F2F7' },
  { name: 'Silver',      hex: '#AEAEB2' },
  { name: 'Gray',        hex: '#636366' },
  { name: 'Blue',        hex: '#2563EB' },
  { name: 'Red',         hex: '#DC2626' },
  { name: 'Green',       hex: '#16A34A' },
  { name: 'Brown',       hex: '#7C3A1E' },
  { name: 'Beige',       hex: '#D4B896' },
  { name: 'Gold',        hex: '#D4AF37' },
  { name: 'Yellow',      hex: '#EAB308' },
  { name: 'Orange',      hex: '#EA580C' },
  { name: 'Purple',      hex: '#7C3AED' },
  { name: 'Yellow Cab',  hex: '#F7BF00' },
  { name: 'Uber Black',  hex: '#1F1F22' },
];

// ─── Type Data ────────────────────────────────────────────────────────────────

const TYPES = [
  'Sedan','Compact','SUV','Hatchback','Coupe','Pickup Truck','Van','Minivan','Wagon','Convertible',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const colorLabels = () => ({
  Black:       t('vehicle.color_black'),      White:      t('vehicle.color_white'),
  Silver:      t('vehicle.color_silver'),     Gray:       t('vehicle.color_gray'),
  Blue:        t('vehicle.color_blue'),       Red:        t('vehicle.color_red'),
  Green:       t('vehicle.color_green'),      Brown:      t('vehicle.color_brown'),
  Beige:       t('vehicle.color_beige'),      Gold:       t('vehicle.color_gold'),
  Yellow:      t('vehicle.color_yellow'),     Orange:     t('vehicle.color_orange'),
  Purple:      t('vehicle.color_purple'),
  'Yellow Cab': t('vehicle.color_yellow_cab'),
  'Uber Black': t('vehicle.color_uber_black'),
} as Record<string, string>);

const typeLabels = () => ({
  Sedan:        t('vehicle.type_sedan'),
  Compact:      t('vehicle.type_compact'),
  SUV:          t('vehicle.type_suv'),
  Hatchback:    t('vehicle.type_hatchback'),
  Coupe:        t('vehicle.type_coupe'),
  'Pickup Truck': t('vehicle.type_pickup_truck'),
  Van:          t('vehicle.type_van'),
  Minivan:      t('vehicle.type_minivan'),
  Wagon:        t('vehicle.type_wagon'),
  Convertible:  t('vehicle.type_convertible'),
} as Record<string, string>);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  user: any;
  onBack: () => void;
  isOnboarding?: boolean;
  onSkip?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditVehicleView = ({ user, onBack, isOnboarding, onSkip }: Props) => {
  useLang();

  const [vehicleType,  setVehicleType]  = useState<string>(user?.vehicleType  || '');
  const [vehicleBrand, setVehicleBrand] = useState<string>(user?.vehicleBrand || '');
  const [vehicleColor, setVehicleColor] = useState<string>(user?.vehicleColor || '');
  const [brandSearch,  setBrandSearch]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [showSkip,     setShowSkip]     = useState(false);
  const [done,         setDone]         = useState(false);
  const [savedPartial, setSavedPartial] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef);

  // Resume at first missing step (onboarding only); editing always starts at 0
  const startStep = isOnboarding
    ? (!user?.vehicleType ? 0 : !user?.vehicleBrand ? 1 : !user?.vehicleColor ? 2 : 0)
    : 0;
  const [step, setStep] = useState(startStep);

  const clabels = colorLabels();
  const tlabels = typeLabels();

  // Filtered brand list
  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    return q ? ALL_BRANDS.filter(b => b.toLowerCase().includes(q)) : ALL_BRANDS;
  }, [brandSearch]);

  // ── Save helpers ──

  const saveField = async (fields: Record<string, string>) => {
    if (!user?.id) return;
    await updateDoc(doc(db, 'users', user.id), fields);
  };

  const handleNextFromType = async () => {
    if (!vehicleType) return;
    setSaving(true);
    await saveField({ vehicleType });
    setSaving(false);
    setStep(1);
  };

  const handleNextFromBrand = async () => {
    if (!vehicleBrand) return;
    setSaving(true);
    await saveField({ vehicleBrand });
    setSaving(false);
    setStep(2);
  };

  const handleSaveWithColor = async () => {
    setSaving(true);
    await saveField({ vehicleColor });
    setSaving(false);
    setDone(true);
    setSavedPartial(false);
  };

  const handleSkipColor = async () => {
    setSaving(true);
    await saveField({ vehicleColor: '' });
    setSaving(false);
    setDone(true);
    setSavedPartial(true);
  };

  const handleClearVehicle = async () => {
    if (!user?.id) return;
    await updateDoc(doc(db, 'users', user.id), {
      vehicleType: '', vehicleBrand: '', vehicleColor: '',
    });
    setVehicleType(''); setVehicleBrand(''); setVehicleColor('');
    setStep(0);
  };

  // ── Skip interstitial ──

  if (showSkip) {
    return (
      <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center px-6 py-12 gap-6 text-center">
        <div className="text-5xl">🚗</div>
        <div>
          <h2 className="text-xl font-bold mb-2">{t('vehicle.skip_title')}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xs">
            {t('vehicle.skip_body')}
          </p>
        </div>
        <button
          onClick={() => { onSkip?.(); }}
          className="w-full max-w-xs py-3.5 rounded-xl bg-white/8 border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-sm active:scale-[0.98] transition-all"
        >
          {t('vehicle.skip_confirm')}
        </button>
        <button
          onClick={() => setShowSkip(false)}
          className="text-sm font-semibold text-[#38bdf8] active:opacity-70 transition-opacity"
        >
          {t('vehicle.skip_back')}
        </button>
      </div>
    );
  }

  // ── Done screen ──

  if (done) {
    return (
      <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center justify-center px-6 py-12 gap-6 text-center">
        <div className="w-20 h-20 rounded-[22px] flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#1e75ff,#0ea5e9)' }}>
          <VehicleIcon type={vehicleType} color={vehicleColor} size={36} />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">
            {savedPartial ? t('vehicle.done_partial_title') : t('vehicle.done_title')}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xs">
            {savedPartial ? t('vehicle.done_partial_body') : t('vehicle.done_body')}
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full max-w-xs py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm active:scale-[0.98] transition-all"
        >
          {t('vehicle.continue')}
        </button>
      </div>
    );
  }

  // ── Step dots ──

  const StepDots = () => (
    <div className="flex items-center gap-1.5 justify-center">
      {[0, 1, 2].map(i => (
        <div key={i} className={`rounded-full transition-all duration-200 ${
          i === step ? 'w-4 h-2 bg-[#1e75ff]' : 'w-2 h-2 bg-white/20'
        }`} />
      ))}
    </div>
  );

  // ── Header ──

  const handleSkip = () => {
    // On color step, type+brand already saved — go to done/partial instead of interstitial
    if (step === 2) {
      setDone(true);
      setSavedPartial(true);
      return;
    }
    if (onSkip) setShowSkip(true);
    else onBack();
  };

  const Header = () => (
    <div>
    {isOnboarding && <SignupProgress step={4} />}
    <div className="flex items-center justify-between mb-5">
      <button
        onClick={step === 0 ? onBack : () => setStep(s => s - 1)}
        aria-label={t('vehicle.back')}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] active:scale-95 transition-all shrink-0"
      >
        <ChevronLeft size={20} />
      </button>
      <StepDots />
      <button
        onClick={handleSkip}
        className="px-3.5 py-1.5 rounded-full border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-xs font-bold text-[#38bdf8] active:scale-95 transition-all"
      >
        {t('vehicle.skip')}
      </button>
    </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // STEP 0 — Vehicle Type
  // ═══════════════════════════════════════════

  if (step === 0) {
    return (
      <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
        <div className="max-w-md mx-auto flex flex-col">
          <Header />

          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-1 focus:outline-none">
            {t('vehicle.step_type')}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {t('vehicle.onboarding_hint')}
          </p>

          <div className="grid grid-cols-3 gap-3 [&>*:last-child]:col-start-2">
            {TYPES.map(typeName => {
              const active = vehicleType === typeName;
              return (
                <button
                  key={typeName}
                  onClick={() => setVehicleType(typeName)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-150 active:scale-95 ${
                    active
                      ? 'bg-[#1e75ff]/15 border-[#1e75ff]/60'
                      : 'bg-[var(--color-card)] border-[var(--color-border)] hover:border-[#1e75ff]/30'
                  }`}
                >
                  <VehicleIcon type={typeName} color={active ? 'Blue' : undefined} size={32} />
                  <span className={`text-[11px] font-semibold text-center leading-tight ${
                    active ? 'text-[#38bdf8]' : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {tlabels[typeName] ?? typeName}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextFromType}
            disabled={!vehicleType || saving}
            className="mt-6 w-full py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {t('vehicle.next')} <ChevronRight size={16} />
          </button>

          {/* Remove vehicle when editing */}
          {!isOnboarding && (user?.vehicleType || user?.vehicleBrand) && (
            <button
              onClick={handleClearVehicle}
              className="mt-3 w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-red-400 active:opacity-70 transition-opacity"
            >
              <Trash2 size={14} /> {t('vehicle.remove')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // STEP 1 — Brand
  // ═══════════════════════════════════════════

  if (step === 1) {
    return (
      <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 flex flex-col">
        <div className="max-w-md mx-auto w-full flex flex-col flex-1">
          <Header />

          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-4 focus:outline-none">
            {t('vehicle.step_brand')}
          </h2>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
            <input
              type="text"
              value={brandSearch}
              onChange={e => setBrandSearch(e.target.value)}
              placeholder={t('vehicle.search_placeholder')}
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[#1e75ff]/50"
            />
          </div>

          {/* Brand list */}
          <div className="flex-1 overflow-y-auto rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]" style={{ maxHeight: '50vh' }}>
            {filteredBrands.length > 0 ? filteredBrands.map(b => {
              const active = vehicleBrand === b;
              return (
                <button
                  key={b}
                  onClick={() => setVehicleBrand(b)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${active ? 'bg-[#1e75ff]/12' : 'hover:bg-white/5'}`}
                >
                  <span className={`text-sm font-semibold flex-1 ${active ? 'text-[#38bdf8]' : 'text-[var(--color-text)]'}`}>{b}</span>
                  {active && <Check size={14} className="text-[#1e75ff] shrink-0" />}
                </button>
              );
            }) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                No brands match "{brandSearch}"
              </div>
            )}
          </div>

          <button
            onClick={handleNextFromBrand}
            disabled={!vehicleBrand || saving}
            className="mt-4 w-full py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {t('vehicle.next')} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // STEP 2 — Color
  // ═══════════════════════════════════════════

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      <div className="max-w-md mx-auto flex flex-col">
        <Header />

        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-1 focus:outline-none">
          {t('vehicle.color_optional')}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {t('vehicle.step_color')}
        </p>

        {/* Live preview */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-4 flex items-center gap-3.5 mb-6">
          <VehicleIcon type={vehicleType} color={vehicleColor} size={28} />
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">
              {[vehicleColor ? (clabels[vehicleColor] ?? vehicleColor) : '', vehicleBrand].filter(Boolean).join(' ')}
              {vehicleType ? <span className="text-[var(--color-text-secondary)] font-normal"> · {tlabels[vehicleType] ?? vehicleType}</span> : null}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('vehicle.preview_label')}</p>
          </div>
        </div>

        {/* Color swatches */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden mb-4">
          <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
              {t('vehicle.color_label')}
              {vehicleColor && <span className="ml-1.5 text-[#38bdf8] normal-case font-semibold tracking-normal">— {clabels[vehicleColor] ?? vehicleColor}</span>}
            </p>
          </div>
          <div className="px-4 py-4 grid grid-cols-7 gap-3">
            {COLORS.map(c => (
              <button
                key={c.name}
                onClick={() => setVehicleColor(vehicleColor === c.name ? '' : c.name)}
                aria-label={clabels[c.name] ?? c.name}
                aria-pressed={vehicleColor === c.name}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className="w-8 h-8 rounded-full transition-all duration-150 active:scale-90"
                  style={{
                    backgroundColor: c.hex,
                    boxShadow: vehicleColor === c.name
                      ? '0 0 0 2px var(--color-bg), 0 0 0 4px #1e75ff'
                      : '0 0 0 1px rgba(255,255,255,0.12)',
                  }}
                />
                <span className="text-[10px] text-[var(--color-text-secondary)] leading-none">{clabels[c.name] ?? c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveWithColor}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[#1e75ff] text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {saving ? t('vehicle.saving') : t('vehicle.save_vehicle')}
        </button>
      </div>
    </div>
  );
};
