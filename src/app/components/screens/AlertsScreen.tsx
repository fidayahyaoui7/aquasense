import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from '../BottomNav';
import { AlertTriangle, Moon, TrendingUp, Droplet, Thermometer, ChevronRight, X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as auth from '../../../api/auth';
import * as alertsApi from '../../../api/alerts';
import type { AlertDto } from '../../../api/alerts';
import { useNavigate } from 'react-router';

type AlertTypeUi =
  | 'overconsumption'
  | 'night_leak'
  | 'unusual_spike'
  | 'zero_consumption'
  | 'seasonal_anomaly';

interface AlertUi {
  id: string;
  numericId: number;
  type: AlertTypeUi;
  date: string;
  time: string;
  value: number;
  threshold: number;
  description: string;
  resolved: boolean;
}

function mapAnomalyNameToType(name: string): AlertTypeUi {
  switch (name) {
    case 'surconsommation':
      return 'overconsumption';
    case 'fuite_nocturne':
      return 'night_leak';
    case 'pic_inhabituel':
      return 'unusual_spike';
    case 'conso_nulle':
      return 'zero_consumption';
    case 'anomalie_saisonniere':
      return 'seasonal_anomaly';
    default:
      return 'overconsumption';
  }
}

function dtoToUi(a: AlertDto): AlertUi {
  const ts = a.timestamp.replace('Z', '');
  const d = parseISO(ts);
  return {
    id: String(a.id),
    numericId: a.id,
    type: mapAnomalyNameToType(a.anomaly_name),
    date: format(d, 'd MMMM yyyy', { locale: fr }),
    time: format(d, 'HH:mm'),
    value: a.consumption_m3 ?? 0,
    threshold: 0,
    description: a.message || a.anomaly_name.replace(/_/g, ' '),
    resolved: a.resolved,
  };
}

const alertConfig = {
  overconsumption: {
    icon: AlertTriangle,
    label: 'Surconsommation',
    color: '#E63946',
    bgColor: 'bg-[#E63946]/20',
  },
  night_leak: {
    icon: Moon,
    label: 'Fuite nocturne',
    color: '#F77F00',
    bgColor: 'bg-[#F77F00]/20',
  },
  unusual_spike: {
    icon: TrendingUp,
    label: 'Pic inhabituel',
    color: '#FFA500',
    bgColor: 'bg-[#FFA500]/20',
  },
  zero_consumption: {
    icon: Droplet,
    label: 'Conso nulle',
    color: '#90A4AE',
    bgColor: 'bg-[#90A4AE]/20',
  },
  seasonal_anomaly: {
    icon: Thermometer,
    label: 'Anomalie saisonnière',
    color: '#8338EC',
    bgColor: 'bg-[#8338EC]/20',
  },
};

const miniChartData = [
  { value: 12 },
  { value: 15 },
  { value: 13 },
  { value: 18 },
  { value: 28 },
  { value: 22 },
];

export function AlertsScreen() {
  const navigate = useNavigate();
  const user = auth.getStoredUser();
  const [list, setList] = useState<AlertUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertUi | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await alertsApi.getAlerts(user.id);
      setList(raw.map(dtoToUi));
    } catch {
      setError('Impossible de charger les alertes.');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    load();
  }, [user?.id, navigate, load]);

  const handleResolve = async () => {
    if (!selectedAlert) return;
    setActionLoading(true);
    try {
      await alertsApi.resolveAlert(selectedAlert.numericId);
      setSelectedAlert(null);
      await load();
    } catch {
      setError('Action impossible.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAlert) return;
    setActionLoading(true);
    try {
      await alertsApi.deleteAlert(selectedAlert.numericId);
      setSelectedAlert(null);
      await load();
    } catch {
      setError('Suppression impossible.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-20">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Alertes</h1>
        <p className="text-[#90A4AE] text-sm">
          {loading
            ? 'Chargement…'
            : `${list.length} anomalie${list.length > 1 ? 's' : ''} détectée${list.length > 1 ? 's' : ''}`}
        </p>
        {error && (
          <p className="mt-2 text-sm text-[#E63946]" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="px-6 space-y-3">
        {!loading && list.length === 0 && !error && (
          <p className="text-[#90A4AE] text-sm">Aucun relevé d&apos;alerte pour ce compte.</p>
        )}
        {list.map((alert) => {
          const config = alertConfig[alert.type];
          const Icon = config.icon;

          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => setSelectedAlert(alert)}
              className="w-full bg-[#1A2B3C] rounded-2xl p-4 border border-[#2A3B4C] hover:border-[#00B4D8] transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className="w-6 h-6" style={{ color: config.color }} />
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-white font-medium">{config.label}</span>
                    <span
                      className="text-xs px-2 py-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color + '33', color: config.color }}
                    >
                      {alert.value.toFixed(2)} m³
                    </span>
                  </div>
                  <p className="text-[#90A4AE] text-xs mb-2">
                    {alert.date} • {alert.time}
                    {alert.resolved && (
                      <span className="ml-2 text-[#2DC653]">(résolue)</span>
                    )}
                  </p>
                  <p className="text-[#90A4AE] text-sm line-clamp-2">{alert.description}</p>
                </div>

                <ChevronRight className="w-5 h-5 text-[#90A4AE] flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end max-w-[390px] mx-auto left-0 right-0">
          <div className="bg-[#1A2B3C] rounded-t-3xl w-full p-6 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 ${alertConfig[selectedAlert.type].bgColor} rounded-xl flex items-center justify-center`}
                >
                  {(() => {
                    const Icon = alertConfig[selectedAlert.type].icon;
                    return (
                      <Icon
                        className="w-6 h-6"
                        style={{ color: alertConfig[selectedAlert.type].color }}
                      />
                    );
                  })()}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {alertConfig[selectedAlert.type].label}
                  </h3>
                  <p className="text-[#90A4AE] text-sm">
                    {selectedAlert.date} • {selectedAlert.time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="w-8 h-8 bg-[#2A3B4C] rounded-lg flex items-center justify-center"
              >
                <X className="w-5 h-5 text-[#90A4AE]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0D1B2A] rounded-xl p-4 border border-[#2A3B4C]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[#90A4AE] text-xs mb-1">Valeur détectée</p>
                    <p className="text-white text-2xl font-bold">{selectedAlert.value.toFixed(2)} m³</p>
                  </div>
                  <div>
                    <p className="text-[#90A4AE] text-xs mb-1">Confiance</p>
                    <p className="text-white text-2xl font-bold">—</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0D1B2A] rounded-xl p-4 border border-[#2A3B4C]">
                <p className="text-white text-sm font-medium mb-3">Tendance récente</p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={miniChartData}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={alertConfig[selectedAlert.type].color}
                        strokeWidth={2}
                        dot={{ fill: alertConfig[selectedAlert.type].color, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0D1B2A] rounded-xl p-4 border border-[#2A3B4C]">
                <p className="text-white text-sm font-medium mb-2">Explication</p>
                <p className="text-[#90A4AE] text-sm leading-relaxed">
                  {selectedAlert.description}. Il est recommandé de vérifier vos installations et de
                  surveiller la consommation dans les prochaines heures.
                </p>
              </div>

              <div className="flex gap-2">
                {!selectedAlert.resolved && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleResolve}
                    className="flex-1 rounded-xl bg-[#2DC653]/20 py-3 text-sm font-medium text-[#2DC653] border border-[#2DC653]/40 disabled:opacity-50"
                  >
                    Marquer résolu
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDelete}
                  className="flex-1 rounded-xl bg-[#E63946]/20 py-3 text-sm font-medium text-[#E63946] border border-[#E63946]/40 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
