import { useCallback, useEffect, useMemo, useState } from 'react';
import { BottomNav } from '../BottomNav';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as auth from '../../../api/auth';
import * as readings from '../../../api/readings';
import type { HistoryRow } from '../../../api/readings';

type FilterType = 'day' | 'week' | 'month';

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function buildDayChart(rows: HistoryRow[]) {
  const map = new Map<number, { sum: number; alert: boolean }>();
  rows.forEach((r) => {
    const h = parseISO(r.timestamp.replace('Z', '')).getHours();
    const cur = map.get(h) ?? { sum: 0, alert: false };
    cur.sum += r.consumption_m3;
    cur.alert = cur.alert || r.anomaly_name !== 'normal';
    map.set(h, cur);
  });
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    consumption: map.get(h)?.sum ?? 0,
    status: map.get(h)?.alert ? 'alert' : 'normal',
  }));
}

function buildWeekChart(rows: HistoryRow[]) {
  const byDay = new Map<string, { sum: number; alert: boolean; order: number }>();
  rows.forEach((r) => {
    const d = parseISO(r.timestamp.replace('Z', ''));
    const key = format(d, 'yyyy-MM-dd');
    const cur = byDay.get(key) ?? { sum: 0, alert: false, order: d.getTime() };
    cur.sum += r.consumption_m3;
    cur.alert = cur.alert || r.anomaly_name !== 'normal';
    byDay.set(key, cur);
  });
  const sorted = [...byDay.entries()].sort((a, b) => a[1].order - b[1].order).slice(-7);
  return sorted.map(([key, v]) => {
    const d = parseISO(key);
    return {
      day: WEEKDAY_SHORT[d.getDay()],
      consumption: Math.round(v.sum * 100) / 100,
      status: v.alert ? 'alert' : 'normal',
    };
  });
}

function buildMonthChart(rows: HistoryRow[]) {
  if (!rows.length) return [];
  const sorted = [...rows].sort(
    (a, b) =>
      parseISO(a.timestamp.replace('Z', '')).getTime() -
      parseISO(b.timestamp.replace('Z', '')).getTime()
  );
  const n = Math.min(4, Math.max(1, Math.ceil(sorted.length / 8)));
  const chunk = Math.ceil(sorted.length / n);
  const chunks: HistoryRow[][] = [];
  for (let i = 0; i < sorted.length; i += chunk) {
    chunks.push(sorted.slice(i, i + chunk));
  }
  return chunks.map((c, i) => ({
    week: `S${i + 1}`,
    consumption: Math.round(c.reduce((s, r) => s + r.consumption_m3, 0) * 100) / 100,
    status: c.some((r) => r.anomaly_name !== 'normal') ? 'alert' : 'normal',
  }));
}

export function HistoryScreen() {
  const navigate = useNavigate();
  const user = auth.getStoredUser();
  const [filter, setFilter] = useState<FilterType>('day');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof readings.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([
        readings.getHistory(user.id, filter),
        readings.getStats(user.id),
      ]);
      setRows(Array.isArray(h) ? h : []);
      setStats(s);
    } catch {
      setError('Impossible de charger l’historique. Vérifiez la connexion au serveur.');
      setRows([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user?.id, navigate, fetchData]);

  const chartData = useMemo(() => {
    if (!rows.length) {
      if (filter === 'day') return buildDayChart([]);
      if (filter === 'week') return [];
      return [];
    }
    if (filter === 'day') return buildDayChart(rows);
    if (filter === 'week') return buildWeekChart(rows);
    return buildMonthChart(rows);
  }, [rows, filter]);

  const getXAxisKey = () => {
    switch (filter) {
      case 'day':
        return 'hour';
      case 'week':
        return 'day';
      case 'month':
        return 'week';
    }
  };

  const tableRows = useMemo(() => {
    return [...rows]
      .sort(
        (a, b) =>
          parseISO(b.timestamp.replace('Z', '')).getTime() -
          parseISO(a.timestamp.replace('Z', '')).getTime()
      )
      .slice(0, 20)
      .map((r) => {
        const d = parseISO(r.timestamp.replace('Z', ''));
        return {
          time: format(d, 'HH:mm', { locale: fr }),
          consumption: r.consumption_m3.toFixed(3),
          status: r.anomaly_name !== 'normal' ? 'alert' : 'normal',
        };
      });
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#0D1B2A] max-w-[390px] mx-auto pb-20">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Historique</h1>
        <p className="text-[#90A4AE] text-sm">Consultez vos données de consommation</p>
        {error && (
          <p className="mt-2 text-sm text-[#E63946]" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="px-6 mb-6">
        <div className="bg-[#1A2B3C] rounded-2xl p-1 flex gap-1">
          {(['day', 'week', 'month'] as FilterType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[#00B4D8] text-white'
                  : 'text-[#90A4AE] hover:text-white'
              }`}
            >
              {f === 'day' && 'Jour'}
              {f === 'week' && 'Semaine'}
              {f === 'month' && 'Mois'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1A2B3C] rounded-xl p-4 border border-[#2A3B4C]">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#00B4D8]" />
            </div>
            <p className="text-white text-xl font-bold">
              {stats != null ? stats.total_month_m3.toFixed(1) : loading ? '…' : '—'}
            </p>
            <p className="text-[#90A4AE] text-xs mt-1">Total du mois</p>
          </div>

          <div className="bg-[#1A2B3C] rounded-xl p-4 border border-[#2A3B4C]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#2DC653]" />
            </div>
            <p className="text-white text-xl font-bold">
              {stats != null ? stats.avg_daily_m3.toFixed(1) : loading ? '…' : '—'}
            </p>
            <p className="text-[#90A4AE] text-xs mt-1">Moy. jour</p>
          </div>

          <div className="bg-[#1A2B3C] rounded-xl p-4 border border-[#2A3B4C]">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-[#E63946]" />
            </div>
            <p className="text-white text-xl font-bold">
              {stats != null ? stats.nb_alerts_month : loading ? '…' : '—'}
            </p>
            <p className="text-[#90A4AE] text-xs mt-1">Alertes</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[#1A2B3C] rounded-2xl p-4 border border-[#2A3B4C]">
          <h3 className="text-white font-medium mb-4">
            Consommation {filter === 'day' && 'journalière'}
            {filter === 'week' && 'hebdomadaire'}
            {filter === 'month' && 'mensuelle'}
          </h3>
          <div className="h-56">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[#90A4AE] text-sm">
                Chargement…
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[#90A4AE] text-sm text-center px-4">
                Aucun relevé disponible pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3B4C" />
                  <XAxis
                    dataKey={getXAxisKey()}
                    stroke="#90A4AE"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#90A4AE' }}
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
                    formatter={(value: number) => [`${value} m³`, 'Consommation']}
                  />
                  <Bar
                    dataKey="consumption"
                    fill="#00B4D8"
                    radius={[8, 8, 0, 0]}
                    shape={(props: {
                      x?: number;
                      y?: number;
                      width?: number;
                      height?: number;
                      payload?: { status?: string };
                    }) => {
                      const { x, y, width, height, payload } = props;
                      const fill = payload?.status === 'alert' ? '#E63946' : '#00B4D8';
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={fill}
                          rx={8}
                          ry={8}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#1A2B3C] rounded-2xl border border-[#2A3B4C] overflow-hidden">
          <div className="p-4 border-b border-[#2A3B4C]">
            <h3 className="text-white font-medium">Détails récents</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0D1B2A]">
                <tr>
                  <th className="text-left text-[#90A4AE] text-xs font-medium p-3">Heure</th>
                  <th className="text-left text-[#90A4AE] text-xs font-medium p-3">Consommation</th>
                  <th className="text-left text-[#90A4AE] text-xs font-medium p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-[#90A4AE] text-sm">
                      Aucun relevé disponible.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, index) => (
                    <tr key={index} className="border-t border-[#2A3B4C]">
                      <td className="text-white text-sm p-3">{row.time}</td>
                      <td className="text-white text-sm p-3">{row.consumption} m³</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            row.status === 'alert'
                              ? 'bg-[#E63946]/20 text-[#E63946]'
                              : 'bg-[#2DC653]/20 text-[#2DC653]'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.status === 'alert' ? 'bg-[#E63946]' : 'bg-[#2DC653]'
                            }`}
                          />
                          {row.status === 'alert' ? 'Alerte' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
