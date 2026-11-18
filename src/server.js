import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { checkConnection } from './config/db.js';
import { initSocket } from './config/socket.js';

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP nativo para soportar Express y Socket.IO simultáneamente
const server = http.createServer(app);

// Inicializar Socket.IO para notificaciones en tiempo real al teléfono
initSocket(server);

const startServer = async () => {
  // Comprobar la conexión con la base de datos
  await checkConnection();

  server.listen(PORT, () => {
    console.log(`🚀 Servidor SmartGym (Express + Socket.IO) corriendo en http://localhost:${PORT}`);
    console.log(`🔔 Sistema de notificaciones en tiempo real activo y escuchando conexiones`);
  });
};

startServer();

export { server };
