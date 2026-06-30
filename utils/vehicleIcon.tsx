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
  (colorName && COLOR_HEX[colorName]) || '#38bdf8';

export const VehicleIcon = ({
  type,
  color,
  size = 18,
}: {
  type?: string;
  color?: string;
  size?: number;
}) => {
  const hex = getVehicleHex(color);
  if (type === 'Pickup Truck') return <Car size={size} color={hex} />;
  if (type === 'Van' || type === 'Minivan') return <Bus size={size} color={hex} />;
  return <Car size={size} color={hex} />;
};
