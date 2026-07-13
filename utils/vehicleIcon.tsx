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

const W    = 'rgba(180,220,255,0.88)';
const TIRE = '#0b111e';
const RIM  = 'rgba(255,255,255,0.3)';

function Wheel({ cx, r = 7 }: { cx: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={48} r={r} fill={TIRE} />
      <circle cx={cx} cy={48} r={r * 0.4} fill={RIM} />
    </>
  );
}

type Renderer = (fill: string) => React.ReactElement;

const SILHOUETTES: Record<string, Renderer> = {

  // ── SEDAN ─────────────────────────────────────────────────────────────────
  // 3-box with Q-curve dome roof (peak y=8), distinct trunk, arched roofline
  Sedan: (fill) => (
    <>
      <path d="M5,44 L5,36 L8,30 L26,26 L36,14 Q53,8 70,14 L78,22 L82,26 L94,26 L95,38 L95,44 L86,44 A8,8 0 0,1 70,44 L30,44 A8,8 0 0,1 14,44 Z" fill={fill} />
      <path d="M26,26 L36,14 Q53,8 70,14 L78,22 L78,26 L26,26 Z" fill={W} />
      <Wheel cx={22} r={8} /><Wheel cx={78} r={8} />
    </>
  ),

  // ── SUV ───────────────────────────────────────────────────────────────────
  // Tall boxy — 6-unit B-pillar (x=48–54) clearly visible as a solid pillar
  SUV: (fill) => (
    <>
      <path d="M4,44 L4,32 L8,24 L12,4 L18,2 L82,2 L90,8 L95,20 L96,38 L96,44 L89,44 A9,9 0 0,1 71,44 L31,44 A9,9 0 0,1 13,44 Z" fill={fill} />
      <path d="M12,4 L18,2 L48,2 L48,26 L12,26 Z" fill={W} />
      <path d="M54,2 L82,2 L90,8 L90,26 L54,26 Z" fill={W} />
      <Wheel cx={22} r={9} /><Wheel cx={80} r={9} />
    </>
  ),

  // ── HATCHBACK ─────────────────────────────────────────────────────────────
  // Same sedan dome front (Q curve), then steep C-pillar drop + hatch glass triangle
  Hatchback: (fill) => (
    <>
      <path d="M5,44 L5,36 L8,30 L26,26 L36,14 Q50,9 62,14 L80,38 L84,44 L75,44 A7,7 0 0,1 61,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      <path d="M26,26 L36,14 Q50,9 62,14 L62,26 L26,26 Z" fill={W} />
      <path d="M62,14 L78,36 L62,36 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={68} />
    </>
  ),

  // ── COUPE ─────────────────────────────────────────────────────────────────
  // Long hood, sweeping Q-curve fastback roofline (peaks y=12, flows to rear at y=26)
  Coupe: (fill) => (
    <>
      <path d="M5,46 L5,40 L14,34 L46,30 L54,16 Q70,12 86,26 L90,32 L94,38 L95,46 L87,46 A7,7 0 0,1 73,46 L29,46 A7,7 0 0,1 15,46 Z" fill={fill} />
      <path d="M46,30 L54,16 Q70,12 86,26 L86,30 L46,30 Z" fill={W} />
      <Wheel cx={22} /><Wheel cx={80} />
    </>
  ),

  // ── PICKUP TRUCK ──────────────────────────────────────────────────────────
  // Cab (x=5–54) with vertical rear wall, then long flat bed (x=54–96, 86% of cab length)
  // Q-curve subtle cab roof, 6-unit B-pillar, rear wheel positioned in bed area
  'Pickup Truck': (fill) => (
    <>
      <path d="M5,44 L5,34 L10,26 L22,24 L28,4 Q41,2 54,4 L54,34 L96,34 L96,44 L85,44 A9,9 0 0,1 67,44 L31,44 A9,9 0 0,1 13,44 Z" fill={fill} />
      {/* Windshield pane */}
      <path d="M22,24 L28,4 L37,4 L37,26 L22,26 Z" fill={W} />
      {/* Rear cab window (6-unit B-pillar gap at x=37–43) */}
      <path d="M43,4 L54,4 L54,26 L44,26 Z" fill={W} />
      {/* Open truck bed */}
      <rect x="54" y="34" width="42" height="10" fill="rgba(0,0,0,0.38)" />
      <Wheel cx={22} r={9} /><Wheel cx={76} r={9} />
    </>
  ),

  // ── VAN ───────────────────────────────────────────────────────────────────
  // Near-vertical front, tallest (roof y=2), 4 full-height window panes
  Van: (fill) => (
    <>
      <path d="M4,44 L4,30 L6,4 L10,2 L88,2 L94,8 L97,16 L97,38 L97,44 L89,44 A8,8 0 0,1 73,44 L29,44 A8,8 0 0,1 13,44 Z" fill={fill} />
      <path d="M6,4 L18,2 L18,28 L6,29 Z" fill={W} />
      <path d="M20,2 L40,2 L40,28 L20,28 Z" fill={W} />
      <path d="M42,2 L62,2 L62,28 L42,28 Z" fill={W} />
      <path d="M64,2 L88,2 L94,8 L97,16 L84,28 L64,28 Z" fill={W} />
      <Wheel cx={21} r={8} /><Wheel cx={81} r={8} />
    </>
  ),

  // ── MINIVAN ───────────────────────────────────────────────────────────────
  // Taller than sedan (roof y=4), sloped nose, 3 panes with belt line at y=26
  Minivan: (fill) => (
    <>
      <path d="M4,44 L4,36 L8,28 L14,16 L20,8 L28,4 L84,4 L92,10 L96,22 L96,38 L96,44 L88,44 A8,8 0 0,1 72,44 L28,44 A8,8 0 0,1 12,44 Z" fill={fill} />
      <path d="M20,8 L28,4 L44,4 L44,26 L18,26 Z" fill={W} />
      <path d="M46,4 L66,4 L66,26 L46,26 Z" fill={W} />
      <path d="M68,4 L84,4 L92,10 L96,22 L82,26 L68,26 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── WAGON ─────────────────────────────────────────────────────────────────
  // FLAT roof (no dome — contrast with sedan's dome), extends to rear, vertical drop
  Wagon: (fill) => (
    <>
      <path d="M5,44 L5,36 L8,30 L26,26 L36,14 L90,14 L92,18 L92,38 L92,44 L84,44 A7,7 0 0,1 70,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      <path d="M26,26 L36,14 L54,14 L54,26 L26,26 Z" fill={W} />
      <path d="M56,14 L90,14 L92,18 L92,26 L56,26 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={77} />
    </>
  ),

  // ── CONVERTIBLE ───────────────────────────────────────────────────────────
  // No roof — windshield frame only, dark open cockpit, headrest bumps confirm open-top
  Convertible: (fill) => (
    <>
      <path d="M5,46 L5,38 L14,32 L36,28 L46,20 L70,20 L74,26 L80,30 L90,34 L94,42 L95,46 L87,46 A7,7 0 0,1 73,46 L27,46 A7,7 0 0,1 13,46 Z" fill={fill} />
      <path d="M36,28 L46,20 L70,20 L70,28 Z" fill={W} />
      <path d="M36,28 L70,28 L78,30 L78,42 L36,42 Z" fill="rgba(0,0,0,0.48)" />
      {/* Headrests — visible above beltline because there's no roof */}
      <ellipse cx={50} cy={25} rx={5} ry={3.5} fill="rgba(0,0,0,0.25)" />
      <ellipse cx={65} cy={25} rx={5} ry={3.5} fill="rgba(0,0,0,0.25)" />
      <Wheel cx={21} /><Wheel cx={80} />
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
