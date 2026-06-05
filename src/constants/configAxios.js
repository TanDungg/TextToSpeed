import axios from 'axios';
import { BASE_URL_API, BASE_URL_APP } from 'src/constants/config';

let isRedirectingToLogin = false;

const axiosInstance = axios.create({
  baseURL: BASE_URL_API || 'http://10.11.22.108:2026',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('token');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    config.metadata = { startTime: Date.now() };

    if (import.meta.env.DEV) {
      console.log('🚀 Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    const startTime = response.config?.metadata?.startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    if (import.meta.env.DEV) {
      console.log('✅ Response:', {
        status: response.status,
        url: response.config.url,
        duration: `${duration}ms`,
        data: response.data,
      });
    }

    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const loginUrl = `${BASE_URL_APP || ''}/login`;

    if (status === 401 && !isRedirectingToLogin) {
      isRedirectingToLogin = true;

      if (window.location.pathname !== '/login') {
        window.location.replace(loginUrl);
      }
    }

    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout');
    }

    if (!error.response) {
      console.error('❌ Network error or server unreachable');
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
