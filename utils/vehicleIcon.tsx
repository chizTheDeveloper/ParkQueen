import React from 'react';

const COLOR_HEX: Record<string, string> = {
  Black:      '#6e6e76',
  White:      '#F2F2F7',
  Silver:     '#AEAEB2',
  Gray:       '#636366',
  Blue:       '#2563EB',
  Red:        '#DC2626',
  Green:      '#16A34A',
  Brown:      '#7C3A1E',
  Beige:      '#D4B896',
  Gold:       '#D4AF37',
  Yellow:     '#EAB308',
  Orange:     '#EA580C',
  Purple:     '#7C3AED',
  'Yellow Cab': '#F7BF00',
  'Uber Black': '#1F1F22',
};

export const getVehicleHex = (colorName?: string): string =>
  (colorName && COLOR_HEX[colorName]) || '#38bdf8';

// Glass / tire / rim constants
const W    = 'rgba(180,220,255,0.88)';
const TIRE = '#0b111e';
const RIM  = 'rgba(255,255,255,0.3)';

// Wheel center y=43, r=7 → bottom y=50 (within viewBox 52) ✓
// Large wheel r=8 → bottom y=51 ✓
function Wheel({ cx, r = 7 }: { cx: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={43} r={r} fill={TIRE} />
      <circle cx={cx} cy={43} r={r * 0.4} fill={RIM} />
    </>
  );
}

type Renderer = (fill: string) => React.ReactElement;

// Shared grid: viewBox 0 0 100 52 | sill y=37 | wheels cy=43
// Left wheel cx=20 · Right wheel cx=78 (unless noted)
const SILHOUETTES: Record<string, Renderer> = {

  // ── SEDAN ─────────────────────────────────────────────────────────────────
  // 3-box: distinct hood · arced roof (peak y=9) · trunk step at x=74
  Sedan: (fill) => (
    <>
      <path d="M5,37 L5,30 L12,23 L28,21 L36,11 Q50,9 64,11 L74,21 L84,26 L94,30 L95,37 Z" fill={fill} />
      <path d="M28,21 L36,11 Q50,9 64,11 L74,21 L74,24 L28,24 Z" fill={W} />
      <Wheel cx={20} /><Wheel cx={78} />
    </>
  ),

  // ── COMPACT ───────────────────────────────────────────────────────────────
  // City car: short wheelbase (cx=24↔64, span=40), tall-ish upright cabin,
  // tiny rear overhang — clearly smaller than Hatchback
  Compact: (fill) => (
    <>
      <path d="M10,37 L10,30 L16,24 L26,20 L34,10 Q46,7 58,10 L66,18 L72,23 L80,28 L82,37 Z" fill={fill} />
      <path d="M26,20 L34,10 Q46,7 58,10 L64,18 L64,22 L26,22 Z" fill={W} />
      <path d="M64,18 L74,30 L64,30 Z" fill={W} />
      <Wheel cx={24} /><Wheel cx={64} />
    </>
  ),

  // ── SUV ───────────────────────────────────────────────────────────────────
  // Tallest body (roof y=4), boxy flat roof, two glass panes, larger wheels
  SUV: (fill) => (
    <>
      <path d="M4,37 L4,26 L8,8 L14,4 L84,4 L90,8 L96,20 L97,37 Z" fill={fill} />
      <path d="M8,8 L14,4 L46,4 L46,26 L8,26 Z" fill={W} />
      <path d="M52,4 L84,4 L90,8 L96,20 L84,26 L52,26 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── HATCHBACK ─────────────────────────────────────────────────────────────
  // Normal compact hatch: wheelbase cx=20↔70 (span=50), steep C-pillar,
  // distinctive rear hatch glass triangle — clearly larger than Compact
  Hatchback: (fill) => (
    <>
      <path d="M5,37 L5,30 L12,24 L26,22 L36,12 Q50,9 62,12 L80,36 L84,37 Z" fill={fill} />
      <path d="M26,22 L36,12 Q50,9 62,12 L62,24 L26,24 Z" fill={W} />
      <path d="M62,12 L78,34 L62,34 Z" fill={W} />
      <Wheel cx={20} /><Wheel cx={70} />
    </>
  ),

  // ── COUPE ─────────────────────────────────────────────────────────────────
  // Low (sill y=38), long hood (x=5–44), sweeping fastback roofline peak y=11
  Coupe: (fill) => (
    <>
      <path d="M5,38 L5,32 L12,28 L44,26 L52,13 Q68,11 84,26 L90,32 L95,38 Z" fill={fill} />
      <path d="M44,26 L52,13 Q68,11 84,26 L84,28 L44,28 Z" fill={W} />
      <Wheel cx={20} /><Wheel cx={80} />
    </>
  ),

  // ── PICKUP TRUCK ──────────────────────────────────────────────────────────
  // Cab (x=4–52) with B-pillar, open dark bed (x=52–96), bed side rail strip
  'Pickup Truck': (fill) => (
    <>
      <path d="M4,37 L4,26 L10,20 L20,18 L28,4 Q40,2 52,4 L52,37 Z" fill={fill} />
      <path d="M20,18 L28,4 L38,4 L38,20 L20,20 Z" fill={W} />
      <path d="M44,4 L52,4 L52,20 L44,20 Z" fill={W} />
      <path d="M52,14 L96,14 L96,37 L52,37 Z" fill={fill} />
      <path d="M52,18 L92,18 L92,37 L52,37 Z" fill="rgba(0,0,0,0.38)" />
      <Wheel cx={20} r={8} /><Wheel cx={76} r={8} />
    </>
  ),

  // ── VAN ───────────────────────────────────────────────────────────────────
  // Tallest overall (roof y=2), near-vertical front, 4 window panes
  Van: (fill) => (
    <>
      <path d="M4,37 L4,26 L6,4 L10,2 L88,2 L94,8 L97,18 L97,37 Z" fill={fill} />
      <path d="M6,4 L18,2 L18,26 L6,26 Z" fill={W} />
      <path d="M20,2 L40,2 L40,26 L20,26 Z" fill={W} />
      <path d="M42,2 L62,2 L62,26 L42,26 Z" fill={W} />
      <path d="M64,2 L88,2 L94,8 L96,16 L82,26 L64,26 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── MINIVAN ───────────────────────────────────────────────────────────────
  // Family van: sloped nose, roof y=5, 3 panes, rounder than Van
  Minivan: (fill) => (
    <>
      <path d="M4,37 L4,30 L8,22 L16,10 L24,5 L82,5 L90,12 L96,22 L97,37 Z" fill={fill} />
      <path d="M16,10 L24,5 L44,5 L44,26 L16,26 Z" fill={W} />
      <path d="M46,5 L66,5 L66,26 L46,26 Z" fill={W} />
      <path d="M68,5 L82,5 L90,12 L94,20 L80,26 L68,26 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── WAGON ─────────────────────────────────────────────────────────────────
  // Estate/station wagon: flat horizontal roofline (y=11, no arc) from A-pillar
  // all the way to vertical rear drop — clearly distinct from Sedan's domed roof
  Wagon: (fill) => (
    <>
      <path d="M5,37 L5,30 L12,23 L28,21 L36,11 L88,11 L90,16 L92,37 Z" fill={fill} />
      <path d="M28,21 L36,11 L54,11 L54,23 L28,23 Z" fill={W} />
      <path d="M56,11 L88,11 L90,16 L90,23 L56,23 Z" fill={W} />
      <Wheel cx={20} /><Wheel cx={77} />
    </>
  ),

  // ── CONVERTIBLE ───────────────────────────────────────────────────────────
  // No roof — windshield frame + dark open cockpit + two visible headrests
  Convertible: (fill) => (
    <>
      <path d="M5,38 L5,32 L12,28 L36,26 L46,18 L70,18 L76,22 L84,28 L93,34 L95,38 Z" fill={fill} />
      <path d="M36,26 L46,18 L70,18 L70,26 Z" fill={W} />
      <path d="M36,26 L70,26 L78,28 L78,38 L36,38 Z" fill="rgba(0,0,0,0.45)" />
      <ellipse cx={50} cy={23} rx={5} ry={3} fill="rgba(0,0,0,0.25)" />
      <ellipse cx={63} cy={23} rx={5} ry={3} fill="rgba(0,0,0,0.25)" />
      <Wheel cx={20} /><Wheel cx={80} />
    </>
  ),
};

const FallbackSilhouette: Renderer = SILHOUETTES['Sedan'];

export const VehicleIcon = ({
  type,
  color,
  size = 18,
}: {
  type?: string;
  color?: string;
  size?: number;
}) => {
  const fill = getVehicleHex(color);
  const render = (type && SILHOUETTES[type]) || FallbackSilhouette;
  return (
    <svg
      viewBox="0 0 100 52"
      width={Math.round(size * 1.92)}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {render(fill)}
    </svg>
  );
};
