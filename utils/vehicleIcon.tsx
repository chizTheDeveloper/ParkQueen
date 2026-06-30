import React from 'react';
import { Car, Bus } from 'lucide-react';

const COLOR_HEX: Record<string, string> = {
  Black:  '#1C1C1E',
  White:  '#F2F2F7',
  Silver: '#AEAEB2',
  Gray:   '#636366',
  Blue:   '#2563EB',
  Red:    '#DC2626',
  Green:  '#16A34A',
  Brown:  '#7C3A1E',
  Beige:  '#D4B896',
  Gold:   '#D4AF37',
  Yellow: '#EAB308',
  Orange: '#EA580C',
  Purple: '#7C3AED',
};

export const getVehicleHex = (colorName?: string): string =>
  (colorName && COLOR_HEX[colorName]) || '';

// Icon is always white — container background carries the color
export const VehicleIcon = ({
  type,
  size = 18,
}: {
  type?: string;
  color?: string; // accepted but unused — kept for call-site compatibility
  size?: number;
}) => {
  if (type === 'Van' || type === 'Minivan') return <Bus size={size} color="white" />;
  return <Car size={size} color="white" />;
};

// Returns inline style props for the icon container div
export const vehicleContainerStyle = (colorName?: string): React.CSSProperties => {
  const hex = getVehicleHex(colorName);
  if (!hex) return { background: 'rgba(56,189,248,0.1)' }; // default sky blue tint
  return { background: `${hex}33` }; // selected color at ~20% opacity
};

// Returns extra className for White (needs a visible border)
export const vehicleContainerBorder = (colorName?: string): string =>
  colorName === 'White' ? 'border border-white/25' : '';
