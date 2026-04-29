import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '../BottomNav';
import { Settings, Droplets, Moon, Gauge, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as auth from '../../../api/auth';
import * as readings from '../../../api/readings';
import type { CurrentReading, ChartPoint, ReadingStats } from '../../../api/readings';

const SEASON_LABELS: Record<string, string> = {
  hiver: 'Hiver',
  printemps: 'Printemps',
  ete: 'Été',
  automne: 'Automne',
};

function chartToRecharts(points: ChartPoint[]) {
  return points.map((p) => ({
    hour: `${String(p.hour).padStart(2, '0')}h`,
    value: p.consumption_m3,
    isNight: p.is_night,
  }));
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const user = auth.getStoredUser();
  const config = JSON.parse(
    localStorage.getItem('aquasense_config') ||
      '{"buildingName":"Mon Bâtiment","buildingType":"Maison"}'
  );

  const [current, setCurrent] = useState<CurrentReading | null>(null);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    // Redirect to onboarding only for new users who haven't configured
    // Existing users with building_type != "maison" or with an address are considered configured
    const hasExistingConfig = 
      (user.building_type && user.building_type !== 'maison') || 
      (user.adresse && user.adresse.trim() !== '');
    
    if (!user.is_configured && !hasExistingConfig) {
      navigate('/onboarding');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [c, s, ch] = await Promise.all([
          readings.getCurrent(user.id),
          readings.getStats(user.id),
          readings.getChart(user.id),
        ]);
        if (!cancelled) {
          setCurrent(c);
          setStats(s);
          setChart(ch);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setLoadError('Impossible de charger les données.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.is_configured, user?.building_type, user?.adresse, navigate]);

  const consumptionData = useMemo(() => chartToRecharts(chart), [chart]);

  const isEmptyState =
    current?.status === 'Aucun relevé' ||
    current?.status === 'no_data' ||
    (current?.timestamp == null && (current?.consumption_m3 ?? 0) === 0);

  const hasAlert =
    !isEmptyState &&
    (current?.status === 'alert' ||
      (current?.anomaly_name != null && current.anomaly_name !== 'normal'));

  const statusLabel = isEmptyState ? 'Aucun relevé' : hasAlert ? 'Alerte' : 'Normal';
  const statusOk = !hasAlert && !isEmptyState;
  const statusIdle = isEmptyState;

  const lastUpdate = isEmptyState
    ? 'Aucun relevé disponible'
    : current?.timestamp != null
      ? formatDistanceToNow(parseISO(current.timestamp), {
          addSuffix: true,
          locale: fr,
        })
      : '—';

  const chartAllZero =
    chart.length > 0 && chart.every((p) => (p.consumption_m3 ?? 0) === 0);

  const seasonFr = current?.season
    ? SEASON_LABELS[current.season] ?? current.season
    : '—';
  const coef = current?.season_coefficient ?? 1;

  const buildingTitle = config.buildingName || 'Mon bâtiment';
  const buildingSubtitle =
    current?.building_type
      ? current.building_type.charAt(0).toUpperCase() + current.building_type.slice(1)
      : config.buildingType || '—';

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1A2B3C] to-[#0D1B2A] p-6 rounded-b-3xl shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{buildingTitle}</h1>
            <p className="text-[#90A4AE] text-sm">{buildingSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-10 h-10 bg-[#2A3B4C] rounded-xl flex items-center justify-center"
          >
            <Settings className="w-5 h-5 text-[#90A4AE]" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              statusIdle
                ? 'bg-[#90A4AE]'
                : statusOk
                  ? 'bg-[#2DC653] animate-pulse'
                  : 'bg-[#E63946] animate-pulse'
            }`}
          />
          <span
            className={`text-sm font-medium ${
              statusIdle
                ? 'text-[#90A4AE]'
                : statusOk
                  ? 'text-[#2DC653]'
                  : 'text-[#E63946]'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {loadError && (
        <div className="mx-6 mt-4 rounded-xl border border-[#E63946]/40 bg-[#E63946]/10 px-3 py-2 text-sm text-[#E63946]">
          {loadError}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Main Consumption Card */}
        <div className="bg-gradient-to-br from-[#00B4D8] to-[#0077B6] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-sm">Consommation actuelle</span>
            <Droplets className="w-5 h-5 text-white/80" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white">
              {current != null ? current.consumption_m3.toFixed(2) : '—'}
            </span>
            <span className="text-xl text-white/80">m³</span>
          </div>
          <p className="text-white/70 text-xs mt-2">Dernière mise à jour : {lastUpdate}</p>
          {!isEmptyState && current?.anomaly_name && current.anomaly_name !== 'normal' && (
            <p className="text-white/90 text-xs mt-1 font-medium">
              Anomalie : {current.anomaly_name.replace(/_/g, ' ')}
            </p>
          )}
          {isEmptyState && (
            <p className="text-white/80 text-xs mt-1">Envoie une première photo de compteur pour commencer.</p>
          )}
        </div>

        {/* Season Info */}
        <div className="bg-[#1A2B3C] rounded-2xl p-4 border border-[#2A3B4C]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Saison actuelle</p>
              <p className="text-[#90A4AE] text-xs mt-1">Coefficient appliqué</p>
            </div>
            <div className="text-right">
              <p className="text-[#00B4D8] text-lg font-bold">{seasonFr}</p>
              <p className="text-[#00B4D8] text-sm">×{coef}</p>
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-[#1A2B3C] rounded-2xl p-4 border border-[#2A3B4C]">
          <h3 className="text-white font-medium mb-1">Dernières 24h</h3>
          {chartAllZero && (
            <p className="text-[#90A4AE] text-xs mb-3">Aucun relevé sur cette période (0 m³).</p>
          )}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consumptionData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00B4D8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3B4C" />
                <XAxis
                  dataKey="hour"
                  stroke="#90A4AE"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: '#90A4AE' }}
                  interval={3}
                />
                <YAxis
                  stroke="#90A4AE"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#90A4AE' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A2B3C',
                    border: '1px solid #2A3B4C',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00B4D8"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-3 h-3 bg-[#E63946] rounded-sm" />
            <span className="text-[#90A4AE] text-xs">Zone nocturne (22h-6h)</span>
          </div>
        </div>

        {/* Indicators + stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1A2B3C] rounded-xl p-3 border border-[#2A3B4C] flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                statusIdle
                  ? 'bg-[#90A4AE]/20'
                  : statusOk
                    ? 'bg-[#2DC653]/20'
                    : 'bg-[#E63946]/20'
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 ${
                  statusIdle ? 'text-[#90A4AE]' : statusOk ? 'text-[#2DC653]' : 'text-[#E63946]'
                }`}
              />
            </div>
            <p className="text-white text-xs text-center">{statusLabel}</p>
          </div>

          <div className="bg-[#1A2B3C] rounded-xl p-3 border border-[#2A3B4C] flex flex-col items-center">
            <div className="w-10 h-10 bg-[#2DC653]/20 rounded-full flex items-center justify-center mb-2">
              <Moon className="w-5 h-5 text-[#2DC653]" />
            </div>
            <p className="text-white text-xs text-center">
              {isEmptyState
                ? '—'
                : current?.anomaly_name === 'fuite_nocturne'
                  ? 'Fuite ?'
                  : 'Pas de fuite'}
            </p>
          </div>

          <div className="bg-[#1A2B3C] rounded-xl p-3 border border-[#2A3B4C] flex flex-col items-center">
            <div className="w-10 h-10 bg-[#2DC653]/20 rounded-full flex items-center justify-center mb-2">
              <Gauge className="w-5 h-5 text-[#2DC653]" />
            </div>
            <p className="text-white text-xs text-center">
              {stats != null ? `${stats.total_month_m3.toFixed(1)} m³/mois` : '0.0 m³/mois'}
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
