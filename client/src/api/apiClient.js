import axios from 'axios';

// Normalize so it works whether VITE_API_URL is set with or without a
// trailing slash or "/api" suffix (e.g. "https://host.com", "https://host.com/",
// or "https://host.com/api" all resolve to the same base).
function resolveApiBaseUrl() {
  let url = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) url += '/api';
  return url;
}

const API_BASE_URL = resolveApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically add authorization token to requests if available
apiClient.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('smartquiz_user'));
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
