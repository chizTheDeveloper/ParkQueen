import { useState, useEffect } from 'react';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface GoogleParkingData {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address: string;
  isPaid: boolean;
  rating: number | string;
  pricePerHour?: number;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y';

export const useLocalParkingData = (userLocation: LocationCoords | null, searchRadiusMeters: number = 2000) => {
  const [parkingData, setParkingData] = useState<GoogleParkingData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!userLocation) return;

    const fetchLocalParking = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.editorialSummary,places.rating'
          },
          body: JSON.stringify({
            "textQuery": "parking garage",
            "includedType": "parking",
            "locationRestriction": {
              "circle": {
                "center": {
                  "latitude": userLocation.lat,
                  "longitude": userLocation.lng
                },
                "radius": searchRadiusMeters
              }
            }
          })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google API Error:", response.status, errorText, "Using key:", GOOGLE_MAPS_API_KEY.substring(0, 10) + '...');
            setLoading(false);
            return;
        }

        const data = await response.json();
        
        const places = (data.places || []).map((place: any, idx: number) => {
            const isPaid = place.editorialSummary?.text?.toLowerCase().includes('paid') || true;
            
            // Estimate pricing based on rating (similar to existing logic)
            let basePrice = 12.00;
            if (place.rating) {
                basePrice += place.rating * 2.5;
            }
            const finalPrice = Math.round(basePrice * 2) / 2;

            return {
                id: place.id,
                lat: place.location.latitude,
                lng: place.location.longitude,
                title: place.displayName?.text || 'Parking',
                address: place.formattedAddress,
                isPaid: isPaid,
                rating: place.rating || 'N/A',
                pricePerHour: finalPrice
            };
        });

        setParkingData(places);
      } catch (error) {
        console.error("Failed to fetch local parking spots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocalParking();
    
  }, [userLocation?.lat, userLocation?.lng, searchRadiusMeters]); 

  return { parkingData, loading };
};
