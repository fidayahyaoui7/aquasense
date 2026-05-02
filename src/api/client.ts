import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const TOKEN_KEY = 'aquasense_token';
export const USER_KEY = 'aquasense_user';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';

    if (status === 401) {
      const isAuthRoute =
        url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthRoute) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        const path = window.location.pathname;
        if (!path.startsWith('/login') && !path.startsWith('/register')) {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);