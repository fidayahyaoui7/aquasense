import { api, TOKEN_KEY, USER_KEY } from './client';

export type RegisterPayload = {
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  building_type: string;
  password: string;
};

export type AuthUser = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  building_type: string;
  is_configured: boolean;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function register(payload: RegisterPayload): Promise<{ message: string; user_id: number }> {
  const { data } = await api.post<{ message: string; user_id: number }>('/auth/register', payload);
  return data;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
