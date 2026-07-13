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

const W    = 'rgba(0,0,0,0.42)';
const TIRE = '#0b111e';
const RIM  = 'rgba(255,255,255,0.18)';

function Wheel({ cx, r = 7 }: { cx: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={48} r={r} fill={TIRE} />
      <circle cx={cx} cy={48} r={r * 0.4} fill={RIM} />
    </>
  );
}

type Renderer = (fill: string) => React.ReactElement;

// All silhouettes share viewBox "0 0 100 52".
// Body bottom sits at y=44; wheel circles at cy=48 poke below.
const SILHOUETTES: Record<string, Renderer> = {

  // ── SEDAN ──────────────────────────────────────────────────────────────────
  Sedan: (fill) => (
    <>
      <path d="M4,44 C4,40 5,37 8,35 L13,33 C15,27 17,21 20,16 L36,11 C41,8 47,8 54,8 L69,8 C75,8 79,11 81,15 L84,18 C85,20 86,22 87,22 L93,22 C95,29 96,35 96,40 L96,44 L88,44 A7,7 0 0,1 74,44 L26,44 A7,7 0 0,1 12,44 Z" fill={fill} />
      <path d="M20,16 L34,11 L34,22 L18,24 Z" fill={W} />
      <path d="M36,11 L53,11 L53,22 L36,22 Z" fill={W} />
      <path d="M55,8 L69,8 C75,8 79,11 81,15 L84,18 L71,23 L55,23 Z" fill={W} />
      <Wheel cx={27} /><Wheel cx={82} />
    </>
  ),

  // ── SUV ────────────────────────────────────────────────────────────────────
  SUV: (fill) => (
    <>
      <path d="M4,44 C4,39 5,36 8,33 L12,31 C14,24 15,17 16,10 L20,5 C25,3 31,3 38,3 L76,3 C83,3 88,6 92,11 L94,18 C96,24 97,31 97,38 L97,44 L89,44 A8,8 0 0,1 73,44 L25,44 A8,8 0 0,1 9,44 Z" fill={fill} />
      <path d="M16,10 L35,4 L35,32 L15,33 Z" fill={W} />
      <path d="M38,3 L60,3 L60,32 L38,32 Z" fill={W} />
      <path d="M62,3 L76,3 C83,3 88,6 92,11 L94,18 L80,32 L62,32 Z" fill={W} />
      <Wheel cx={27} r={8} /><Wheel cx={82} r={8} />
    </>
  ),

  // ── HATCHBACK ──────────────────────────────────────────────────────────────
  Hatchback: (fill) => (
    <>
      <path d="M4,44 C4,40 5,37 8,35 L12,33 C14,27 16,21 20,16 L36,11 C41,8 47,8 54,8 L66,8 C77,10 86,20 91,32 L93,39 C94,42 95,44 95,44 L87,44 A7,7 0 0,1 73,44 L26,44 A7,7 0 0,1 12,44 Z" fill={fill} />
      <path d="M20,16 L34,11 L34,22 L18,24 Z" fill={W} />
      <path d="M36,11 L52,11 L52,22 L36,22 Z" fill={W} />
      <path d="M54,8 L66,8 C75,10 84,19 89,30 L83,34 L68,23 L54,23 Z" fill={W} />
      <Wheel cx={27} /><Wheel cx={79} />
    </>
  ),

  // ── COUPE ──────────────────────────────────────────────────────────────────
  // Very long hood (48%), lower body, fastback roofline — clearly sporty
  Coupe: (fill) => (
    <>
      <path d="M4,46 C4,42 5,39 8,37 L12,35 C14,30 17,25 21,21 L48,15 C53,12 59,12 65,12 L78,12 C84,12 88,14 90,18 L92,23 C94,28 95,34 96,40 L96,46 L88,46 A7,7 0 0,1 74,46 L28,46 A7,7 0 0,1 14,46 Z" fill={fill} />
      <path d="M21,21 L46,15 L46,26 L19,28 Z" fill={W} />
      <path d="M48,15 L63,15 L63,26 L48,26 Z" fill={W} />
      <path d="M65,12 L78,12 C84,12 88,14 90,18 L92,23 L79,27 L65,27 Z" fill={W} />
      <Wheel cx={28} /><Wheel cx={82} />
    </>
  ),

  // ── PICKUP TRUCK ───────────────────────────────────────────────────────────
  // Cab with high roof + open bed — step down at bed rail is the key feature
  'Pickup Truck': (fill) => (
    <>
      <path d="M4,44 C4,39 5,36 8,34 L11,32 C13,24 15,17 18,11 L24,5 C29,3 34,3 42,3 L57,3 C63,3 67,7 69,13 L71,19 C72,23 73,27 73,32 L97,32 L97,44 L88,44 A9,9 0 0,1 71,44 L36,44 A9,9 0 0,1 18,44 Z" fill={fill} />
      <path d="M18,11 L40,5 L40,29 L17,31 Z" fill={W} />
      <path d="M42,3 L57,3 C63,3 67,7 69,13 L71,19 L61,29 L42,29 Z" fill={W} />
      {/* open bed interior */}
      <rect x="73" y="32" width="24" height="12" rx="0" fill="rgba(0,0,0,0.3)" />
      <Wheel cx={27} r={9} /><Wheel cx={80} r={9} />
    </>
  ),

  // ── VAN ────────────────────────────────────────────────────────────────────
  // Commercial van — nearly vertical front wall, zero hood, maximum height
  Van: (fill) => (
    <>
      <path d="M4,44 C4,39 5,36 7,33 L9,30 L10,7 L12,4 C15,3 19,3 25,3 L80,3 C87,3 93,6 96,11 L97,17 C98,24 98,31 98,38 L98,44 L90,44 A8,8 0 0,1 74,44 L22,44 A8,8 0 0,1 6,44 Z" fill={fill} />
      <path d="M10,7 L24,4 L24,31 L10,32 Z" fill={W} />
      <path d="M26,3 L48,3 L48,31 L26,31 Z" fill={W} />
      <path d="M50,3 L70,3 L70,31 L50,31 Z" fill={W} />
      <path d="M72,3 L80,3 C87,3 93,6 96,11 L97,17 L83,31 L72,31 Z" fill={W} />
      <Wheel cx={22} r={8} /><Wheel cx={82} r={8} />
    </>
  ),

  // ── MINIVAN ────────────────────────────────────────────────────────────────
  // Consumer minivan — rounded sloping nose, tall cabin, lower than van
  Minivan: (fill) => (
    <>
      <path d="M4,44 C4,40 5,37 8,34 L12,31 C14,25 17,18 20,12 C24,7 31,5 38,5 L78,5 C85,5 91,7 94,13 L97,20 C98,26 98,33 98,39 L98,44 L90,44 A8,8 0 0,1 74,44 L22,44 A8,8 0 0,1 6,44 Z" fill={fill} />
      <path d="M20,12 C24,7 30,5 36,5 L36,31 L18,32 Z" fill={W} />
      <path d="M38,5 L60,5 L60,31 L38,31 Z" fill={W} />
      <path d="M62,5 L78,5 C85,5 91,7 94,13 L97,20 L82,31 L62,31 Z" fill={W} />
      <Wheel cx={22} r={8} /><Wheel cx={82} r={8} />
    </>
  ),

  // ── WAGON ──────────────────────────────────────────────────────────────────
  // Estate wagon — sedan front, roof extends to near-vertical squared rear
  Wagon: (fill) => (
    <>
      <path d="M4,44 C4,40 5,37 8,35 L13,33 C15,27 17,21 20,16 L36,11 C41,8 47,8 54,8 L84,8 C91,8 95,11 96,15 L96,32 L96,40 L96,44 L88,44 A7,7 0 0,1 74,44 L26,44 A7,7 0 0,1 12,44 Z" fill={fill} />
      <path d="M20,16 L34,11 L34,22 L18,24 Z" fill={W} />
      <path d="M36,11 L52,11 L52,22 L36,22 Z" fill={W} />
      <path d="M54,8 L84,8 C91,8 95,11 96,15 L96,22 L54,22 Z" fill={W} />
      <Wheel cx={27} /><Wheel cx={79} />
    </>
  ),

  // ── CONVERTIBLE ────────────────────────────────────────────────────────────
  // Low body, no roof — only windshield visible, open cockpit interior
  Convertible: (fill) => (
    <>
      <path d="M4,46 C4,42 5,40 8,38 L12,36 C14,31 17,26 21,22 L44,18 C50,15 57,14 64,14 L77,15 C83,16 88,19 92,24 L94,30 C95,34 96,39 96,46 L88,46 A7,7 0 0,1 74,46 L28,46 A7,7 0 0,1 14,46 Z" fill={fill} />
      <path d="M44,18 C50,15 57,14 64,14 L64,22 L44,25 Z" fill={W} />
      {/* open cockpit */}
      <path d="M44,25 L64,22 L77,21 L77,36 L44,36 Z" fill="rgba(0,0,0,0.5)" />
      {/* folded soft top bump */}
      <path d="M64,14 C71,14 77,16 79,20 L77,21 L64,21 Z" fill="rgba(0,0,0,0.25)" />
      <Wheel cx={28} /><Wheel cx={83} />
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
