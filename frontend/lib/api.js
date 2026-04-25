import axios from 'axios';

const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '')}/api`
  : null;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || backendBaseUrl || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
