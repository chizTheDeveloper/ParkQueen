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
  // Classic 3-box: arched roof, distinct trunk lid, medium hood
  Sedan: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L68,14 L76,22 L80,26 L93,26 L95,38 L95,44 L86,44 A8,8 0 0,1 70,44 L30,44 A8,8 0 0,1 14,44 Z" fill={fill} />
      {/* windshield + roof + rear window as enclosed glass zone */}
      <path d="M28,24 L38,14 L68,14 L76,22 L76,26 L28,26 Z" fill={W} />
      <Wheel cx={22} r={8} /><Wheel cx={78} r={8} />
    </>
  ),

  // ── SUV ───────────────────────────────────────────────────────────────────
  // Tall boxy — roof y=2, split glass with B-pillar so it reads as car not bus
  SUV: (fill) => (
    <>
      <path d="M4,44 L4,32 L8,24 L12,4 L18,2 L82,2 L90,8 L95,20 L96,38 L96,44 L89,44 A9,9 0 0,1 71,44 L31,44 A9,9 0 0,1 13,44 Z" fill={fill} />
      {/* Front glass (windshield + front side) */}
      <path d="M12,4 L18,2 L50,2 L50,26 L12,26 Z" fill={W} />
      {/* Rear glass */}
      <path d="M52,2 L82,2 L90,8 L90,26 L52,26 Z" fill={W} />
      <Wheel cx={22} r={9} /><Wheel cx={80} r={9} />
    </>
  ),

  // ── HATCHBACK ─────────────────────────────────────────────────────────────
  // Sedan front, steep C-pillar hatch drop — two separate glass areas
  Hatchback: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L62,14 L80,38 L84,44 L75,44 A7,7 0 0,1 61,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      {/* Side windows (front + rear, above belt line) */}
      <path d="M28,25 L38,14 L62,14 L62,26 L28,26 Z" fill={W} />
      {/* Hatch glass: steep triangle from C-pillar top to hatch bottom */}
      <path d="M62,14 L78,36 L62,36 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={68} />
    </>
  ),

  // ── COUPE ─────────────────────────────────────────────────────────────────
  // Very long hood, low roof (y=18), glass spans from mid-car rearward
  Coupe: (fill) => (
    <>
      <path d="M5,46 L5,40 L14,34 L46,30 L54,18 L78,18 L86,24 L90,30 L94,34 L95,42 L95,46 L87,46 A7,7 0 0,1 73,46 L29,46 A7,7 0 0,1 15,46 Z" fill={fill} />
      {/* Longer greenhouse: windshield rises from long hood, glass extends to C-pillar */}
      <path d="M46,30 L54,18 L78,18 L86,24 L86,30 L46,30 Z" fill={W} />
      <Wheel cx={22} /><Wheel cx={80} />
    </>
  ),

  // ── PICKUP TRUCK ──────────────────────────────────────────────────────────
  // Tall cab (roof y=2) with windshield + rear-cab panes, dramatic step to open bed
  'Pickup Truck': (fill) => (
    <>
      <path d="M4,44 L4,34 L8,26 L14,4 L20,2 L58,2 L66,8 L70,18 L70,34 L96,34 L96,44 L88,44 A9,9 0 0,1 70,44 L34,44 A9,9 0 0,1 16,44 Z" fill={fill} />
      {/* Windshield pane */}
      <path d="M14,4 L20,2 L36,2 L36,26 L14,26 Z" fill={W} />
      {/* Rear cab window */}
      <path d="M38,2 L58,2 L66,8 L66,26 L38,26 Z" fill={W} />
      {/* Open bed (darker to show it's empty/open) */}
      <rect x="70" y="34" width="26" height="10" fill="rgba(0,0,0,0.38)" />
      <Wheel cx={25} r={9} /><Wheel cx={79} r={9} />
    </>
  ),

  // ── VAN ───────────────────────────────────────────────────────────────────
  // Near-vertical front face, tallest, 4 full-height window panes
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
  // Family height (roof y=4), sloped nose, 3 panes with clear body panel below belt
  Minivan: (fill) => (
    <>
      <path d="M4,44 L4,36 L8,28 L14,16 L20,8 L28,4 L84,4 L92,10 L96,22 L96,38 L96,44 L88,44 A8,8 0 0,1 72,44 L28,44 A8,8 0 0,1 12,44 Z" fill={fill} />
      {/* Belt line at y=26; three windows above it */}
      <path d="M20,8 L28,4 L44,4 L44,26 L18,26 Z" fill={W} />
      <path d="M46,4 L66,4 L66,26 L46,26 Z" fill={W} />
      <path d="M68,4 L84,4 L92,10 L96,22 L82,26 L68,26 Z" fill={W} />
      <Wheel cx={20} r={8} /><Wheel cx={80} r={8} />
    </>
  ),

  // ── WAGON ─────────────────────────────────────────────────────────────────
  // Sedan front, flat roof all the way to rear, vertical rear drop — 2 glass panes
  Wagon: (fill) => (
    <>
      <path d="M5,44 L5,36 L10,28 L28,24 L38,14 L90,14 L92,18 L92,38 L92,44 L84,44 A7,7 0 0,1 70,44 L28,44 A7,7 0 0,1 14,44 Z" fill={fill} />
      {/* Front windshield */}
      <path d="M28,24 L38,14 L56,14 L56,26 L28,26 Z" fill={W} />
      {/* Large rear glass spanning the extended roof */}
      <path d="M58,14 L90,14 L92,18 L92,26 L58,26 Z" fill={W} />
      <Wheel cx={21} /><Wheel cx={77} />
    </>
  ),

  // ── CONVERTIBLE ───────────────────────────────────────────────────────────
  // No roof — small windshield frame, fully open cockpit (dark interior shows through)
  Convertible: (fill) => (
    <>
      {/* Low body panels — no roof structure */}
      <path d="M5,46 L5,38 L14,32 L36,28 L46,22 L70,22 L74,26 L80,30 L90,34 L94,42 L95,46 L87,46 A7,7 0 0,1 73,46 L27,46 A7,7 0 0,1 13,46 Z" fill={fill} />
      {/* Windshield A-pillars only (car-width glass triangle, no roof) */}
      <path d="M36,28 L46,22 L70,22 L70,28 Z" fill={W} />
      {/* Open cockpit interior visible from the side */}
      <path d="M36,28 L70,28 L80,30 L80,42 L36,42 Z" fill="rgba(0,0,0,0.48)" />
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
