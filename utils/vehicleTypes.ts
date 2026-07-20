// Vehicle type identifiers — stored directly in Firestore as users/{uid}.vehicleType.
// Do not rename these values without a corresponding Firestore data migration.
export const TYPES = [
    'Sedan', 'Compact', 'SUV', 'Hatchback', 'Coupe',
    'Pickup Truck', 'Van', 'Minivan', 'Wagon', 'Convertible',
] as const;

export type VehicleType = typeof TYPES[number];
