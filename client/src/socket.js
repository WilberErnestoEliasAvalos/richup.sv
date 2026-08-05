import { io } from 'socket.io-client';

// En desarrollo local apunta a localhost:3001.
// En producción, poné la URL de tu backend desplegado (Railway/Render) en una
// variable de entorno de Vite: VITE_SERVER_URL=https://tu-backend.up.railway.app
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, { autoConnect: true });
