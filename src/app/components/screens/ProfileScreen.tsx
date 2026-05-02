import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from '../BottomNav';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { User, Building, Save, Edit, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import * as auth from '../../../api/auth';
import * as usersApi from '../../../api/users';
import { USER_KEY } from '../../../api/client';

const ALLOWED_BUILDING = new Set([
  'maison',
  'appartement',
  'cafe',
  'restaurant',
  'hotel',
  'immeuble',
  'usine',
]);

// Default thresholds per building type (m³/h) — SONEDE 2023
const DEFAULT_THRESHOLDS: Record<string, { normal: string; alert: string }> = {
  'maison': { normal: '0.013', alert: '0.018' },
  'appartement': { normal: '0.009', alert: '0.013' },
  'cafe': { normal: '0.045', alert: '0.065' },
  'restaurant': { normal: '0.090', alert: '0.130' },
  'hotel': { normal: '0.250', alert: '0.375' },
  'immeuble': { normal: '0.120', alert: '0.175' },
  'usine': { normal: '0.400', alert: '0.600' },
};

// Old wrong thresholds to auto-correct from localStorage
const OLD_WRONG_THRESHOLDS: Record<string, string> = {
  '0.70': '0.013', '1.20': '0.018',
  '0.50': '0.009', '0.90': '0.013',
  '2.00': '0.045', '3.50': '0.065',
  '4.00': '0.090', '7.00': '0.130',
  '8.00': '0.250', '14.00': '0.375',
  '5.00': '0.120', '9.00': '0.175',
  '15.00': '0.400', '28.00': '0.600',
};

function correctOldThreshold(value: string): string {
  return OLD_WRONG_THRESHOLDS[value.trim()] || value;
}

const BUILDING_DISPLAY_NAMES: Record<string, string> = {
  'maison': 'Maison',
  'appartement': 'Appartement',
  'cafe': 'Café',
  'restaurant': 'Restaurant',
  'hotel': 'Hôtel',
  'immeuble': 'Immeuble',
  'usine': 'Usine',
};

function userToProfileState(u: auth.AuthUser, config: Record<string, string>) {
  // Get default thresholds based on building type
  const buildingTypeKey = u.building_type?.toLowerCase() || 'maison';
  const defaults = DEFAULT_THRESHOLDS[buildingTypeKey] || DEFAULT_THRESHOLDS['maison'];
  
  // Auto-correct old wrong thresholds from localStorage
  const normalFromConfig = correctOldThreshold(config.normalThreshold || '');
  const alertFromConfig = correctOldThreshold(config.alertThreshold || '');
  
  return {
    fullName: `${u.prenom} ${u.nom}`.trim(),
    email: u.email,
    phone: u.telephone || '',
    adresse: u.adresse || '',
    buildingName: config.buildingName || 'Mon Bâtiment',
    buildingType: buildingTypeKey,
    normalThreshold: normalFromConfig || defaults.normal,
    alertThreshold: alertFromConfig || defaults.alert,
  };
}

function splitFullName(fullName: string): { prenom: string; nom: string } {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return { prenom: '', nom: '' };
  if (parts.length === 1) return { prenom: parts[0], nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const stored = auth.getStoredUser();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thresholdsManuallyChanged, setThresholdsManuallyChanged] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    adresse: '',
    buildingName: 'Mon Bâtiment',
    buildingType: 'Maison',
    normalThreshold: '0.013',
    alertThreshold: '0.018',
  });

  const loadProfile = useCallback(async () => {
    if (!stored?.id) return;
    setLoading(true);
    setError(null);
    try {
      const u = await usersApi.getProfile(stored.id);
      const cfg = JSON.parse(localStorage.getItem('aquasense_config') || '{}');
      setProfile(userToProfileState(u, cfg));
    } catch {
      setError('Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  }, [stored?.id]);

  useEffect(() => {
    if (!stored?.id) {
      navigate('/login');
      return;
    }
    loadProfile();
  }, [stored?.id, navigate, loadProfile]);

  // Normalize string (remove accents)
  const normalizeBuildingType = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const handleSave = async () => {
    if (!stored?.id) return;
    setSaving(true);
    setError(null);
    try {
      const { prenom, nom } = splitFullName(profile.fullName);
      const normalizedBuildingType = normalizeBuildingType(profile.buildingType.trim());

      const { user } = await usersApi.updateProfile(stored.id, {
        prenom: prenom || stored.prenom,
        nom: nom || stored.nom,
        email: profile.email.trim(),
        telephone: profile.phone.trim(),
        adresse: profile.adresse.trim(),
        building_type: normalizedBuildingType,
      });

      localStorage.setItem(USER_KEY, JSON.stringify(user));

      const updatedConfig = {
        buildingName: profile.buildingName,
        buildingType: user.building_type,
        normalThreshold: profile.normalThreshold,
        alertThreshold: profile.alertThreshold,
      };
      localStorage.setItem('aquasense_config', JSON.stringify(updatedConfig));

      setProfile(userToProfileState(user, updatedConfig));
      setIsEditing(false);
    } catch {
      setError('Enregistrement impossible. Vérifiez les champs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-20">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">Profil</h1>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="w-10 h-10 bg-[#1A2B3C] rounded-xl flex items-center justify-center border border-[#2A3B4C]"
          >
            <Edit className="w-5 h-5 text-[#00B4D8]" />
          </button>
        </div>
        <p className="text-[#90A4AE] text-sm">Gérez vos informations personnelles</p>
        {error && (
          <p className="mt-2 text-sm text-[#E63946]" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="mt-2 text-sm text-[#90A4AE]">Chargement…</p>}
      </div>

      <div className="px-6 space-y-6">
        {/* User Info Section */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00B4D8] to-[#0077B6] rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-white text-lg font-bold">{profile.fullName || '—'}</h2>
              <p className="text-[#90A4AE] text-sm">Utilisateur AquaSense</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">Nom complet</Label>
              <Input
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                disabled={!isEditing}
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
              />
            </div>

            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">Email</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                disabled={!isEditing}
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
              />
            </div>

            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">Numéro de téléphone</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={!isEditing}
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
              />
            </div>

            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">Adresse</Label>
              <Input
                value={profile.adresse}
                onChange={(e) => setProfile({ ...profile, adresse: e.target.value })}
                disabled={!isEditing}
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
              />
            </div>
          </div>
        </div>

        {/* Building Info Section */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#00B4D8]/20 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-[#00B4D8]" />
            </div>
            <h3 className="text-white font-bold text-lg">Informations du bâtiment</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">Nom du bâtiment</Label>
              <Input
                value={profile.buildingName}
                onChange={(e) => setProfile({ ...profile, buildingName: e.target.value })}
                disabled={!isEditing}
                className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
              />
            </div>

            <div>
              <Label className="text-[#90A4AE] text-xs mb-1.5">
                Type de bâtiment
              </Label>
              <Select
                value={profile.buildingType.toLowerCase()}
                onValueChange={(value) => {
                  // Auto-update thresholds if user hasn't manually changed them
                  const newThresholds = !thresholdsManuallyChanged 
                    ? DEFAULT_THRESHOLDS[value] || DEFAULT_THRESHOLDS['maison']
                    : { normal: profile.normalThreshold, alert: profile.alertThreshold };
                  setProfile({ 
                    ...profile, 
                    buildingType: value,
                    normalThreshold: newThresholds.normal,
                    alertThreshold: newThresholds.alert,
                  });
                }}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70">
                  <SelectValue placeholder="Sélectionnez le type" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A2B3C] border-[#2A3B4C]">
                  <SelectItem value="maison" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Maison</SelectItem>
                  <SelectItem value="appartement" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Appartement</SelectItem>
                  <SelectItem value="cafe" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Café</SelectItem>
                  <SelectItem value="restaurant" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Restaurant</SelectItem>
                  <SelectItem value="hotel" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Hôtel</SelectItem>
                  <SelectItem value="immeuble" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Immeuble</SelectItem>
                  <SelectItem value="usine" className="text-white focus:bg-[#00B4D8]/20 focus:text-white">Usine</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#90A4AE] text-xs mb-1.5">Seuil normal</Label>
                <Input
                  value={profile.normalThreshold}
                  onChange={(e) => {
                    setThresholdsManuallyChanged(true);
                    setProfile({ ...profile, normalThreshold: e.target.value });
                  }}
                  disabled={!isEditing}
                  className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
                />
              </div>

              <div>
                <Label className="text-[#90A4AE] text-xs mb-1.5">Seuil d'alerte</Label>
                <Input
                  value={profile.alertThreshold}
                  onChange={(e) => {
                    setThresholdsManuallyChanged(true);
                    setProfile({ ...profile, alertThreshold: e.target.value });
                  }}
                  disabled={!isEditing}
                  className="bg-[#0D1B2A] border-[#2A3B4C] text-white disabled:opacity-70"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isEditing && (
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl disabled:opacity-60"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </Button>
        )}

        {/* Stats */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <h3 className="text-white font-bold mb-4">Statistiques du compte</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[#90A4AE] text-xs mb-1">Membre depuis</p>
              <p className="text-white font-medium">—</p>
            </div>
            <div>
              <p className="text-[#90A4AE] text-xs mb-1">Compte</p>
              <p className="text-white font-medium">#{stored?.id ?? '—'}</p>
            </div>
            <div>
              <p className="text-[#90A4AE] text-xs mb-1">Seuils (local)</p>
              <p className="text-white font-medium text-sm">
                {profile.normalThreshold} / {profile.alertThreshold}
              </p>
            </div>
            <div>
              <p className="text-[#90A4AE] text-xs mb-1">Économies</p>
              <p className="text-[#2DC653] font-medium">—</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          type="button"
          onClick={() => {
            auth.logout();
            navigate('/login');
          }}
          className="w-full bg-[#E63946]/20 hover:bg-[#E63946]/30 text-[#E63946] h-12 rounded-xl border border-[#E63946]/50"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Se déconnecter
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
