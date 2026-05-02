import { api } from './client';

export type CurrentReading = {
  consumption_m3: number;
  /** Index cumulatif sur le compteur (m³), si enregistré */
  meter_index_m3?: number | null;
  raw_reading?: string | null;
  anomaly_name: string;
  status: string;
  timestamp: string | null;
  building_type: string;
  season: string;
  season_coefficient: number;
};

export type HistoryRow = {
  date: string;
  consumption_m3: number;
  anomaly_name: string;
  timestamp: string;
};

export type ChartPoint = {
  hour: number;
  consumption_m3: number;
  is_night: boolean;
};

export type ReadingStats = {
  total_month_m3: number;
  avg_daily_m3: number;
  price_estimate_dt: number;
  nb_alerts_month: number;
  comparison_last_month_percent: number;
};

export type LatestImage = {
  image_url: string | null;
  timestamp: string | null;
};

export async function getCurrent(user_id: number): Promise<CurrentReading> {
  const { data } = await api.get<CurrentReading>('/readings/current', {
    params: { user_id },
  });
  return data;
}

export async function getHistory(
  user_id: number,
  period: 'day' | 'week' | 'month'
): Promise<HistoryRow[]> {
  const { data } = await api.get<HistoryRow[]>('/readings/history', {
    params: { user_id, period },
  });
  return data;
}

export async function getChart(user_id: number): Promise<ChartPoint[]> {
  const { data } = await api.get<ChartPoint[]>('/readings/chart', {
    params: { user_id },
  });
  return data;
}

export async function getStats(user_id: number): Promise<ReadingStats> {
  const { data } = await api.get<ReadingStats>('/readings/stats', {
    params: { user_id },
  });
  return data;
}

export async function getLatestImage(user_id: number): Promise<LatestImage> {
  const { data } = await api.get<LatestImage>('/readings/latest-image', {
    params: { user_id },
  });
  return data;
}

export async function getLatestImageByDevice(device_id: string): Promise<LatestImage> {
  const { data } = await api.get<LatestImage>(`/readings/latest-image/device/${device_id}`);
  return data;
}
