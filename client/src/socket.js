import { io } from 'socket.io-client';

// En desarrollo local apunta a localhost:3001.
// En producción, poné la URL de tu backend desplegado en VITE_SERVER_URL
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
