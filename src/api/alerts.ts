import { api } from './client';

export type AlertDto = {
  id: number;
  anomaly_type: number;
  anomaly_name: string;
  message: string;
  confidence: number;
  timestamp: string;
  resolved: boolean;
  consumption_m3: number | null;
};

export async function getAlerts(user_id: number): Promise<AlertDto[]> {
  const { data } = await api.get<AlertDto[]>('/alerts', { params: { user_id } });
  return data;
}

export async function resolveAlert(id: number): Promise<{ message: string }> {
  const { data } = await api.patch<{ message: string }>(`/alerts/${id}/resolve`);
  return data;
}

export async function deleteAlert(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/alerts/${id}`);
  return data;
}
