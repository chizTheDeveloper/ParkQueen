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

// viewBox "0 0 100 52". Body floors: sedans/wagons y=44, coupes y=46.
// Wheel circles at cy=48. Height from roof to floor drives visual distinction:
//   Van y=2 (42u), SUV y=4 (40u), Minivan y=8 (36u), Sedan/Wagon/Hatch y=14 (30u),
//   Coupe y=20 (26u — lowest), Pickup cab y=2 with bed step-down.
const SILHOUETTES: Record<string, Renderer> = {

  // ── SEDAN ─────────────────────────────────────────────────────────────────
  // 3-box: medium hood, arched roof peak, distinct short trunk lid
  Sedan: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L68,14 L76,22 L80,26 L93,26 L95,38 L95,44 L86,44 A8,8 0 0,1 70,44 L30,44 A8,8 0 0,1 14,44 Z" fill={fill} />
      <path d="M28,24 L38,14 L68,14 L76,22 Z" fill={W} />
      <Wheel cx={22} r={8} /><Wheel cx={78} r={8} />
    </>
  ),

  // ── SUV ───────────────────────────────────────────────────────────────────
  // Tall boxy — roof at y=2 vs sedan y=14, short nose, one large glass area
  SUV: (fill) => (
    <>
      <path d="M4,44 L4,32 L8,24 L12,4 L18,2 L82,2 L90,8 L95,20 L96,38 L96,44 L89,44 A9,9 0 0,1 71,44 L31,44 A9,9 0 0,1 13,44 Z" fill={fill} />
      <path d="M12,4 L18,2 L82,2 L90,8 L90,30 L12,30 Z" fill={W} />
      <Wheel cx={22} r={9} /><Wheel cx={80} r={9} />
    </>
  ),

  // ── HATCHBACK ─────────────────────────────────────────────────────────────
  // Sedan-style front, then C-pillar drops steeply ~65° straight to bumper (no trunk)
  Hatchback: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L62,14 L80,38 L84,44 L75,44 A7,7 0 0,1 61,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      <path d="M28,24 L38,14 L62,14 L78,36 L26,26 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={68} />
    </>
  ),

  // ── COUPE ─────────────────────────────────────────────────────────────────
  // Low and long — roof y=20 (lowest), huge hood, small rearward-biased cabin
  Coupe: (fill) => (
    <>
      <path d="M5,46 L5,40 L14,34 L44,30 L52,20 L74,20 L80,26 L86,30 L94,34 L95,42 L95,46 L87,46 A7,7 0 0,1 73,46 L29,46 A7,7 0 0,1 15,46 Z" fill={fill} />
      <path d="M44,30 L52,20 L74,20 L80,26 L80,30 Z" fill={W} />
      <Wheel cx={22} /><Wheel cx={80} />
    </>
  ),

  // ── PICKUP TRUCK ──────────────────────────────────────────────────────────
  // Tall cab (roof y=2) then dramatic 30-unit step DOWN to flat open bed at y=34
  'Pickup Truck': (fill) => (
    <>
      <path d="M4,44 L4,34 L8,26 L14,4 L20,2 L58,2 L66,8 L70,18 L70,34 L96,34 L96,44 L88,44 A9,9 0 0,1 70,44 L34,44 A9,9 0 0,1 16,44 Z" fill={fill} />
      <path d="M14,4 L20,2 L58,2 L66,8 L66,30 L14,30 Z" fill={W} />
      <rect x="70" y="34" width="26" height="10" fill="rgba(0,0,0,0.35)" />
      <Wheel cx={25} r={9} /><Wheel cx={79} r={9} />
    </>
  ),

  // ── VAN ───────────────────────────────────────────────────────────────────
  // Nearly vertical front face, tallest (roof y=2), 4 window panes across length
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
  // Family van — taller than sedan (roof y=4), curved nose, 3 window sections
  Minivan: (fill) => (
    <>
      <path d="M4,44 L4,36 L8,28 L14,16 L20,8 L28,4 L84,4 L92,10 L96,22 L96,38 L96,44 L88,44 A8,8 0 0,1 72,44 L28,44 A8,8 0 0,1 12,44 Z" fill={fill} />
      <path d="M20,8 L28,4 L44,4 L44,28 L18,28 Z" fill={W} />
      <path d="M46,4 L66,4 L66,28 L46,28 Z" fill={W} />
      <path d="M68,4 L84,4 L92,10 L96,22 L82,28 L68,28 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── WAGON ─────────────────────────────────────────────────────────────────
  // Station wagon — sedan front, then roof extends flat 52 units to rear, drops vertically
  Wagon: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L90,14 L92,18 L92,38 L92,44 L84,44 A7,7 0 0,1 70,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      <path d="M28,24 L38,14 L90,14 L92,18 L92,24 L28,24 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={77} />
    </>
  ),

  // ── CONVERTIBLE ───────────────────────────────────────────────────────────
  // No roof — only windshield A-pillars visible; dark open cockpit shows top-down
  Convertible: (fill) => (
    <>
      <path d="M5,46 L5,38 L14,32 L38,28 L48,22 L70,22 L74,26 L80,30 L90,34 L94,42 L95,46 L87,46 A7,7 0 0,1 73,46 L28,46 A7,7 0 0,1 14,46 Z" fill={fill} />
      <path d="M38,28 L48,22 L70,22 L70,28 Z" fill={W} />
      <path d="M38,28 L70,28 L80,30 L80,42 L38,42 Z" fill="rgba(0,0,0,0.5)" />
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
