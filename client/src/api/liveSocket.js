import { io } from 'socket.io-client';

// Reuses the same host as the REST API but without the /api suffix, since
// Socket.IO connects at the server root, not under /api.
function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}

let socket = null;

// guestName: pass a display name to connect anonymously (QR-scan join, no
// account). Omit it to use the logged-in account's token instead.
//
// The socket is created lazily and cached, but a guest's name is only known
// after they type it (later than the first render that touches this module).
// So if the socket already exists and there's no real account token, keep
// refreshing its auth payload with the latest guestName — socket.io-client
// reads `socket.auth` fresh on every connect() call.
export function getLiveSocket(guestName) {
  const user = JSON.parse(localStorage.getItem('smartquiz_user') || 'null');
  if (!socket) {
    const auth = user?.token ? { token: user.token } : { guestName };
    socket = io(resolveSocketUrl(), { autoConnect: false, auth });
  } else if (!user?.token && guestName) {
    socket.auth = { guestName };
  }
  return socket;
}

export function disconnectLiveSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
