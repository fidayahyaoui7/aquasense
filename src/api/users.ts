import { api } from './client';
import type { AuthUser } from './auth';

export type UpdateProfilePayload = {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  building_type?: string;
};

export type UpdatePasswordPayload = {
  old_password: string;
  new_password: string;
};

export async function getProfile(user_id: number): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>(`/users/${user_id}`);
  return data;
}

export async function updateProfile(
  user_id: number,
  payload: UpdateProfilePayload
): Promise<{ message: string; user: AuthUser }> {
  const { data } = await api.put<{ message: string; user: AuthUser }>(`/users/${user_id}`, payload);
  return data;
}

export async function updatePassword(
  user_id: number,
  payload: UpdatePasswordPayload
): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>(`/users/${user_id}/password`, payload);
  return data;
}
