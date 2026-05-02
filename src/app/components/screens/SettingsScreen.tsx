import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ArrowLeft, Bell, Camera, Globe, Moon, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import * as auth from '../../../api/auth';
import * as devices from '../../../api/devices';
import * as readings from '../../../api/readings';
import type { Device } from '../../../api/devices';
import type { LatestImage } from '../../../api/readings';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.1.68:8000';

const BUILDING_DISPLAY_NAMES: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  cafe: 'Café',
  restaurant: 'Restaurant',
  hotel: 'Hôtel',
  immeuble: 'Immeuble',
  usine: 'Usine',
};

export function SettingsScreen() {
  const navigate = useNavigate();
  const user = auth.getStoredUser();

  if (!user?.id) {
    navigate('/login');
    return null;
  }

  // ================= STATE =================
  const [notifications, setNotifications] = useState({
    overconsumption: true,
    nightLeak: true,
    unusualSpike: false,
    zeroConsumption: true,
    seasonalAnomaly: true,
  });

  const [espCam, setEspCam] = useState({
    captureFrequency: '30min',
    resolution: '640x480',
  });

  const [appSettings, setAppSettings] = useState({
    language: 'fr',
    darkMode: true,
  });

  const [latestImage, setLatestImage] = useState<LatestImage>({
    image_url: null,
    timestamp: null,
  });

  const [imageLoading, setImageLoading] = useState(true);
  const [espConnected, setEspConnected] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Device management
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceBuildingType, setNewDeviceBuildingType] = useState('maison');
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // ================= FETCH LATEST IMAGE =================
  useEffect(() => {
    const fetchLatestImage = async () => {
      setImageLoading(true);
      setImageError(null);

      try {
        // Use device-based endpoint if a device is selected, otherwise fall back to user_id
        if (selectedDeviceId) {
          const data = await readings.getLatestImageByDevice(selectedDeviceId);
          setLatestImage(data);
          // ESP is connected only if image exists and is recent (within 5 minutes)
          const isRecent = data.timestamp ? (Date.now() - new Date(data.timestamp).getTime()) < 5 * 60 * 1000 : false;
          setEspConnected(!!data.image_url && isRecent);
        } else {
          // Fallback to user_id for backward compatibility
          const data = await readings.getLatestImage(user.id);
          setLatestImage(data);
          const isRecent = data.timestamp ? (Date.now() - new Date(data.timestamp).getTime()) < 5 * 60 * 1000 : false;
          setEspConnected(!!data.image_url && isRecent);
        }
      } catch (err: any) {
        setEspConnected(false);
        setLatestImage({ image_url: null, timestamp: null });
        setImageError((err?.response?.data?.detail ?? err?.message) ?? 'Erreur backend');
      } finally {
        setImageLoading(false);
      }
    };

    fetchLatestImage();

    const interval = setInterval(fetchLatestImage, 30000);
    return () => clearInterval(interval);
  }, [user.id, selectedDeviceId]);

  // ================= FETCH DEVICES =================
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const deviceList = await devices.listDevices(user.id);
        setUserDevices(deviceList);
        // Auto-select first device if none selected
        if (!selectedDeviceId && deviceList.length > 0) {
          setSelectedDeviceId(deviceList[0].device_id);
        }
      } catch (err) {
        console.error('Failed to fetch devices:', err);
      }
    };
    fetchDevices();
  }, [user.id, selectedDeviceId]);

  // ================= ADD DEVICE =================
  const handleAddDevice = async () => {
    if (!newDeviceId.trim()) {
      setDeviceError('Device ID requis');
      return;
    }
    try {
      await devices.createDevice(user.id, {
        device_id: newDeviceId.trim(),
        building_type: newDeviceBuildingType.trim() || 'maison',
      });
      const deviceList = await devices.listDevices(user.id);
      setUserDevices(deviceList);
      setNewDeviceId('');
      setNewDeviceBuildingType('maison');
      setShowAddDevice(false);
      setDeviceError(null);
    } catch (err: any) {
      setDeviceError(err?.response?.data?.detail || 'Erreur lors de l\'ajout');
    }
  };

  // ================= DELETE DEVICE =================
  const handleDeleteDevice = async (device_id: string) => {
    try {
      await devices.deleteDevice(device_id);
      const deviceList = await devices.listDevices(user.id);
      setUserDevices(deviceList);
    } catch (err) {
      console.error('Failed to delete device:', err);
    }
  };

  // ================= FORMAT TIME =================
  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return 'Aucune capture disponible';

    const date = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;

    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;

    return date.toLocaleString('fr-FR');
  };

  // ================= UI =================
  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-6">

      {/* HEADER */}
      <div className="p-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 bg-[#1A2B3C] rounded-xl flex items-center justify-center border border-[#2A3B4C]"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres</h1>
          <p className="text-[#90A4AE] text-sm">
            Connecté : {user.prenom} {user.nom}
          </p>
        </div>
      </div>

      <div className="px-6 space-y-6">

        {/* ================= ESP32 ================= */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#2DC653]/20 rounded-xl flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#2DC653]" />
            </div>
            <h2 className="text-white font-bold text-lg">ESP32-CAM</h2>
          </div>

          {/* STATUS */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-white text-sm">Connexion</Label>
              <div className="flex items-center gap-2 mt-1">
                {espConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-xs">Connecté</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-xs">Déconnecté</span>
                  </>
                )}
              </div>
            </div>

            <div className={`w-3 h-3 rounded-full ${espConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>

          {/* IMAGE */}
          <div className="bg-[#0D1B2A] rounded-xl p-3 border border-[#2A3B4C]">

            <div className="aspect-video bg-[#1A2B3C] rounded-lg flex items-center justify-center overflow-hidden">

              {imageLoading ? (
                <div className="text-[#90A4AE] text-sm">Chargement...</div>
              ) : latestImage.image_url ? (
                <img
                  src={latestImage.image_url}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-10 h-10 text-[#90A4AE]" />
                  <span className="text-[#90A4AE] text-xs">Aucune image</span>
                </div>
              )}

            </div>

            <p className="text-[#90A4AE] text-xs mt-2">
              Dernière capture : {formatTimestamp(latestImage.timestamp)}
            </p>

            {imageError && (
              <p className="text-red-400 text-xs mt-1">{imageError}</p>
            )}
          </div>

          <div className="mt-4">
            <Label className="text-white text-sm">Fréquence</Label>
            <select
              value={espCam.captureFrequency}
              onChange={(e) => setEspCam({ ...espCam, captureFrequency: e.target.value })}
              className="w-full mt-2 bg-[#0D1B2A] border border-[#2A3B4C] text-white rounded-xl px-4 py-2 text-sm"
            >
              <option value="15min">15 min</option>
              <option value="30min">30 min</option>
              <option value="1h">1 heure</option>
              <option value="2h">2 heures</option>
            </select>
          </div>
        </div>

        {/* ================= DEVICE MANAGEMENT ================= */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#00B4D8]/20 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#00B4D8]" />
              </div>
              <h2 className="text-white font-bold text-lg">Mes Appareils</h2>
            </div>
            <Button
              onClick={() => setShowAddDevice(!showAddDevice)}
              className="bg-[#00B4D8] text-white h-8 px-3 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
          {showAddDevice && (
            <div className="bg-[#0D1B2A] rounded-xl p-4 border border-[#2A3B4C] mb-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-white text-xs">Device ID</Label>
                  <Input
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    placeholder="ESP32-AQUASENSE-01"
                    className="mt-1 bg-[#1A2B3C] border-[#2A3B4C] text-white text-sm"
                  />
                </div>
                <div>
                  <Label className="text-white text-xs">Type de bâtiment</Label>
                  <Input
                    value={newDeviceBuildingType}
                    onChange={(e) => setNewDeviceBuildingType(e.target.value)}
                    placeholder="maison"
                    className="mt-1 bg-[#1A2B3C] border-[#2A3B4C] text-white text-sm"
                  />
                </div>
                {deviceError && <p className="text-red-400 text-xs">{deviceError}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleAddDevice} className="flex-1 bg-[#2DC653] text-white h-8 rounded-lg text-sm">
                    Confirmer
                  </Button>
                  <Button
                    onClick={() => { setShowAddDevice(false); setNewDeviceId(''); setNewDeviceBuildingType('maison'); setDeviceError(null); }}
                    className="flex-1 bg-[#2A3B4C] text-white h-8 rounded-lg text-sm"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {userDevices.length === 0 ? (
              <p className="text-[#90A4AE] text-sm text-center py-4">Aucun appareil enregistré</p>
            ) : (
              userDevices.map((device) => (
                <div
                  key={device.id}
                  className={`rounded-xl p-3 border flex items-center justify-between ${selectedDeviceId === device.device_id ? 'border-[#2DC653] bg-[#132C18]' : 'border-[#2A3B4C] bg-[#0D1B2A]'}`}
                  onClick={() => setSelectedDeviceId(device.device_id)}
                >
                  <div>
                    <p className="text-white text-sm font-medium">{device.device_id}</p>
                    <p className="text-[#90A4AE] text-xs">Type: {BUILDING_DISPLAY_NAMES[device.building_type] || device.building_type}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.device_id); }} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= APP SETTINGS ================= */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-white font-bold text-lg">Application</h2>
          </div>
          <div>
            <Label className="text-white text-sm">Langue</Label>
            <select
              value={appSettings.language}
              onChange={(e) => setAppSettings({ ...appSettings, language: e.target.value })}
              className="w-full mt-2 bg-[#0D1B2A] border border-[#2A3B4C] text-white rounded-xl px-4 py-2 text-sm"
            >
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-[#00B4D8]" />
              <Label className="text-white text-sm">Mode sombre</Label>
            </div>
            <Switch checked={appSettings.darkMode} onCheckedChange={(v) => setAppSettings({ ...appSettings, darkMode: v })} />
          </div>
        </div>

        {/* SAVE */}
        <Button className="w-full bg-[#00B4D8] text-white h-12 rounded-xl">
          Sauvegarder
        </Button>

      </div>
    </div>
  );
}