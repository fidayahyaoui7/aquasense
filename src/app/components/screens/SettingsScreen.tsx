import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ArrowLeft, Bell, Camera, Globe, Moon, Wifi } from 'lucide-react';

export function SettingsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({
    overconsumption: true,
    nightLeak: true,
    unusualSpike: false,
    zeroConsumption: true,
    seasonalAnomaly: true,
  });

  const [espCam, setEspCam] = useState({
    status: 'connected',
    lastImage: true,
    captureFrequency: '30min',
  });

  const [appSettings, setAppSettings] = useState({
    language: 'fr',
    darkMode: true,
  });

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-6">
      {/* Header */}
      <div className="p-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 bg-[#1A2B3C] rounded-xl flex items-center justify-center border border-[#2A3B4C]"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres</h1>
          <p className="text-[#90A4AE] text-sm">Personnalisez votre application</p>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Notifications Section */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#00B4D8]/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#00B4D8]" />
            </div>
            <h2 className="text-white font-bold text-lg">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Surconsommation</Label>
                <p className="text-[#90A4AE] text-xs mt-0.5">
                  Alertes de consommation excessive
                </p>
              </div>
              <Switch
                checked={notifications.overconsumption}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, overconsumption: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Fuite nocturne</Label>
                <p className="text-[#90A4AE] text-xs mt-0.5">
                  Détection de fuites la nuit
                </p>
              </div>
              <Switch
                checked={notifications.nightLeak}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, nightLeak: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Pic inhabituel</Label>
                <p className="text-[#90A4AE] text-xs mt-0.5">
                  Pics de consommation anormaux
                </p>
              </div>
              <Switch
                checked={notifications.unusualSpike}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, unusualSpike: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Consommation nulle</Label>
                <p className="text-[#90A4AE] text-xs mt-0.5">
                  Absence de consommation
                </p>
              </div>
              <Switch
                checked={notifications.zeroConsumption}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, zeroConsumption: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Anomalie saisonnière</Label>
                <p className="text-[#90A4AE] text-xs mt-0.5">
                  Variations saisonnières
                </p>
              </div>
              <Switch
                checked={notifications.seasonalAnomaly}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, seasonalAnomaly: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>
          </div>
        </div>

        {/* ESP-CAM Section */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#2DC653]/20 rounded-xl flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#2DC653]" />
            </div>
            <h2 className="text-white font-bold text-lg">ESP-CAM</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Statut de connexion</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Wifi className="w-4 h-4 text-[#2DC653]" />
                  <span className="text-[#2DC653] text-xs">Connecté</span>
                </div>
              </div>
              <div className="w-3 h-3 bg-[#2DC653] rounded-full animate-pulse"></div>
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div>
              <Label className="text-white text-sm mb-3">Dernière image</Label>
              <div className="bg-[#0D1B2A] rounded-xl p-3 mt-2 border border-[#2A3B4C]">
                <div className="aspect-video bg-gradient-to-br from-[#2A3B4C] to-[#1A2B3C] rounded-lg flex items-center justify-center">
                  <Camera className="w-12 h-12 text-[#90A4AE]" />
                </div>
                <p className="text-[#90A4AE] text-xs mt-2">
                  Dernière capture: Il y a 5 minutes
                </p>
              </div>
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div>
              <Label className="text-white text-sm">Fréquence de capture</Label>
              <select
                value={espCam.captureFrequency}
                onChange={(e) =>
                  setEspCam({ ...espCam, captureFrequency: e.target.value })
                }
                className="w-full mt-2 bg-[#0D1B2A] border border-[#2A3B4C] text-white rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="15min">Toutes les 15 minutes</option>
                <option value="30min">Toutes les 30 minutes</option>
                <option value="1h">Toutes les heures</option>
                <option value="2h">Toutes les 2 heures</option>
              </select>
            </div>
          </div>
        </div>

        {/* App Settings Section */}
        <div className="bg-[#1A2B3C] rounded-2xl p-6 border border-[#2A3B4C]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#8338EC]/20 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#8338EC]" />
            </div>
            <h2 className="text-white font-bold text-lg">Application</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-white text-sm">Langue</Label>
              <select
                value={appSettings.language}
                onChange={(e) =>
                  setAppSettings({ ...appSettings, language: e.target.value })
                }
                className="w-full mt-2 bg-[#0D1B2A] border border-[#2A3B4C] text-white rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="h-px bg-[#2A3B4C]"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0D1B2A] rounded-lg flex items-center justify-center">
                  <Moon className="w-4 h-4 text-[#00B4D8]" />
                </div>
                <Label className="text-white text-sm">Mode sombre</Label>
              </div>
              <Switch
                checked={appSettings.darkMode}
                onCheckedChange={(checked) =>
                  setAppSettings({ ...appSettings, darkMode: checked })
                }
                className="data-[state=checked]:bg-[#00B4D8]"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button className="w-full bg-[#00B4D8] hover:bg-[#0096B8] text-white h-12 rounded-xl">
          Sauvegarder les paramètres
        </Button>

        {/* Version Info */}
        <div className="text-center">
          <p className="text-[#90A4AE] text-xs">
            AquaSense v1.0.0 • © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
