import { io } from 'socket.io-client';

// Reuses the same host as the REST API but without the /api suffix, since
// Socket.IO connects at the server root, not under /api.
function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}

let socket = null;

export function getLiveSocket() {
  if (socket) return socket;
  const user = JSON.parse(localStorage.getItem('smartquiz_user') || 'null');
  socket = io(resolveSocketUrl(), {
    autoConnect: false,
    auth: { token: user?.token },
  });
  return socket;
}

export function disconnectLiveSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
