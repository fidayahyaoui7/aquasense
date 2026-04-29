import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

export function LocationScreen() {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivateLocation = () => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode using OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`
          );
          
          if (response.ok) {
            const data = await response.json();
            const parts = [
              data.address?.road,
              data.address?.city || data.address?.town || data.address?.village,
              data.address?.postcode,
              data.address?.country
            ].filter(Boolean);
            
            setAddress(parts.join(', '));
          } else {
            setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch {
          // Fallback to coordinates if reverse geocoding fails
          setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setError('Impossible de récupérer votre position. Veuillez entrer votre adresse manuellement.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    localStorage.setItem('aquasense_location', address);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-bold text-white mb-2">
          Localisation du bâtiment
        </h1>
        <p className="text-[#90A4AE] text-sm">
          Indiquez l'emplacement de votre compteur d'eau
        </p>
      </div>

      {/* Map View */}
      <div className="flex-1 relative bg-[#1A2B3C] mx-6 rounded-2xl overflow-hidden shadow-xl">
        {/* Simulated Map Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2B3C] via-[#0D1B2A] to-[#1A2B3C]">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00B4D8" strokeWidth="0.5"/>
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        {/* Location Pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="w-12 h-12 text-[#E63946] drop-shadow-lg" fill="#E63946" />
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-xl">+</span>
          </button>
          <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-xl">−</span>
          </button>
        </div>

        {/* Address Display */}
        {address && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#00B4D8] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#0D1B2A]">{address}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-6 space-y-3">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-[#E63946]/50 bg-[#E63946]/10 px-3 py-2 text-sm text-[#E63946]"
          >
            {error}
          </div>
        )}
        
        {!address && (
          <Button
            onClick={handleActivateLocation}
            disabled={isLocating}
            className="w-full bg-[#1A2B3C] hover:bg-[#2A3B4C] text-white h-12 rounded-xl border border-[#2A3B4C]"
          >
            {isLocating ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 mr-2" />
            )}
            {isLocating ? 'Localisation en cours...' : 'Activer ma localisation'}
          </Button>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!address}
          className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl"
        >
          Confirmer l'emplacement
        </Button>
      </div>
    </div>
  );
}
