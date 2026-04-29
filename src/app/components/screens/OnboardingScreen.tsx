import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Navigation, Home, Building2, Coffee, UtensilsCrossed, Hotel, Building, Factory, MapPin, Loader2 } from 'lucide-react';
import * as auth from '../../../api/auth';
import { api } from '../../../api/client';

interface BuildingTypeOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const BUILDING_TYPES: BuildingTypeOption[] = [
  { id: 'maison', label: 'Maison', icon: <Home className="w-8 h-8" /> },
  { id: 'appartement', label: 'Appartement', icon: <Building2 className="w-8 h-8" /> },
  { id: 'cafe', label: 'Café', icon: <Coffee className="w-8 h-8" /> },
  { id: 'restaurant', label: 'Restaurant', icon: <UtensilsCrossed className="w-8 h-8" /> },
  { id: 'hotel', label: 'Hôtel', icon: <Hotel className="w-8 h-8" /> },
  { id: 'immeuble', label: 'Immeuble', icon: <Building className="w-8 h-8" /> },
  { id: 'usine', label: 'Usine', icon: <Factory className="w-8 h-8" /> },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const user = auth.getStoredUser();
  const [selectedType, setSelectedType] = useState<string>('');
  const [buildingName, setBuildingName] = useState('');
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeolocation = () => {
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
          // Try to reverse geocode using a free API
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      setError('Veuillez sélectionner un type de bâtiment');
      return;
    }
    
    if (!buildingName.trim()) {
      setError('Veuillez entrer un nom pour votre bâtiment');
      return;
    }
    
    if (!address.trim()) {
      setError('Veuillez entrer une adresse');
      return;
    }

    if (!user?.id) {
      setError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save to backend
      await api.put(`/users/${user.id}`, {
        building_type: selectedType,
        adresse: address.trim(),
      });

      // Save to localStorage
      const cfg = JSON.parse(localStorage.getItem('aquasense_config') || '{}');
      const displayLabel = BUILDING_TYPES.find(t => t.id === selectedType)?.label || selectedType;
      cfg.buildingType = displayLabel;
      cfg.buildingName = buildingName.trim();
      cfg.address = address.trim();
      localStorage.setItem('aquasense_config', JSON.stringify(cfg));

      // Update stored user
      const updatedUser = { ...user, building_type: selectedType, adresse: address.trim(), is_configured: true };
      localStorage.setItem('aquasense_user', JSON.stringify(updatedUser));

      navigate('/dashboard');
    } catch (err) {
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = selectedType && buildingName.trim() && address.trim();

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto p-6">
      <div className="pt-4 pb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Configuration initiale
        </h1>
        <p className="text-[#90A4AE] text-sm">
          Personnalisez votre expérience AquaSense
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#E63946]/50 bg-[#E63946]/10 px-3 py-2 text-sm text-[#E63946]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Building Type Selection */}
        <div className="space-y-3">
          <Label className="text-white">Type de bâtiment</Label>
          <div className="grid grid-cols-3 gap-3">
            {BUILDING_TYPES.map((type) => (
              <motion.button
                key={type.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedType(type.id)}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
                  ${selectedType === type.id 
                    ? 'border-[#00B4D8] bg-[#00B4D8]/20' 
                    : 'border-[#2A3B4C] bg-[#1A2B3C] hover:border-[#3A4B5C]'
                  }
                `}
              >
                <div className={`mb-2 ${selectedType === type.id ? 'text-[#00B4D8]' : 'text-[#90A4AE]'}`}>
                  {type.icon}
                </div>
                <span className={`text-xs text-center ${selectedType === type.id ? 'text-white' : 'text-[#90A4AE]'}`}>
                  {type.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Building Name Field */}
        <div className="space-y-3">
          <Label htmlFor="buildingName" className="text-white">
            Nom du bâtiment
          </Label>
          <Input
            id="buildingName"
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            placeholder="Ex: Résidence Carthage, Maison familiale"
            className="bg-[#1A2B3C] border-[#2A3B4C] text-white placeholder:text-[#90A4AE]"
          />
        </div>

        {/* Address Field */}
        <div className="space-y-3">
          <Label htmlFor="address" className="text-white">
            Adresse du bâtiment
          </Label>
          <div className="relative">
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Avenue Habib Bourguiba, Tunis"
              className="bg-[#1A2B3C] border-[#2A3B4C] text-white placeholder:text-[#90A4AE] pr-12"
            />
            <button
              type="button"
              onClick={handleGeolocation}
              disabled={isLocating}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00B4D8] hover:text-[#0096B8] disabled:opacity-50"
            >
              {isLocating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGeolocation}
            disabled={isLocating}
            className="text-sm text-[#00B4D8] hover:underline flex items-center gap-1"
          >
            <MapPin className="w-4 h-4" />
            {isLocating ? 'Localisation en cours...' : 'Utiliser ma position'}
          </button>
        </div>

        <Button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Configuration...
            </>
          ) : (
            'Terminer la configuration'
          )}
        </Button>
      </form>
    </div>
  );
}
