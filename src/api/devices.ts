import { api } from './client';

export type Device = {
  id: number;
  device_id: string;
  user_id: number;
  building_type: string;
  capture_interval: number;
  created_at: string;
};

export type CreateDevicePayload = {
  device_id: string;
  building_type?: string;
  capture_interval?: number;
};

export async function listDevices(user_id: number): Promise<Device[]> {
  const { data } = await api.get<Device[]>('/devices', {
    params: { user_id },
  });
  return data;
}

export async function getDevice(device_id: string): Promise<Device> {
  const { data } = await api.get<Device>(`/devices/${device_id}`);
  return data;
}

export async function createDevice(
  user_id: number,
  payload: CreateDevicePayload
): Promise<{ message: string; device: Device }> {
  const { data } = await api.post<{ message: string; device: Device }>('/devices', payload, {
    params: { user_id },
  });
  return data;
}

export async function deleteDevice(device_id: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/devices/${device_id}`);
  return data;
}
