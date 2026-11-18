import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { notificacionesRepository } from '../repositories/notificaciones.repository.js';
import { sendExpoPushNotification } from '../utils/expoPush.js';

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('⚠️ [Socket.io] Conexión rechazada: Token no provisto');
      return next(new Error('Autenticación requerida'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_smartgym_2026';
      const decoded = jwt.verify(token, secret);
      socket.user = decoded;
      next();
    } catch (err) {
      console.log('⚠️ [Socket.io] Conexión rechazada: Token inválido', err.message);
      return next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id_usuario;
    const userRole = (socket.user?.rol_nombre || socket.user?.rol || '').toLowerCase();

    console.log(`⚡ [Socket.io] Cliente conectado: ${socket.user?.nombre} (ID: ${userId}, Rol: ${userRole})`);

    if (userId) {
      socket.join(`user_${userId}`);
    }

    if (userRole) {
      socket.join(`rol_${userRole}`);
    }

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Cliente desconectado: ${socket.user?.nombre}`);
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

/**
 * Envía una notificación en tiempo real al teléfono de un usuario específico,
 * la almacena en BD y envía una notificación Push a Expo si tiene token registrado.
 */
export const emitNotificationToUser = (userId, notification) => {
  const payload = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title || 'SmartGym 🏋️',
    body: notification.body || '',
    data: notification.data || {},
    timestamp: new Date().toISOString(),
  };

  // 1. Emitir vía Socket.IO
  if (io) {
    io.to(`user_${userId}`).emit('notificacion', payload);
    console.log(`🔔 [Señal enviada a user_${userId}]: "${payload.title}" - ${payload.body}`);
  }

  // 2. Persistencia en Base de Datos & Expo Push asíncrono
  (async () => {
    try {
      // Guardar en tabla notificaciones
      await notificacionesRepository.crear({
        id_usuario: userId,
        titulo: payload.title,
        mensaje: payload.body,
        tipo: notification.data?.tipo || 'general',
        datos_extra: notification.data || {},
      });

      // Obtener push token de Expo y despachar push
      const pushToken = await notificacionesRepository.obtenerPushTokenPorUsuario(userId);
      if (pushToken) {
        await sendExpoPushNotification({
          tokens: [pushToken],
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
      }
    } catch (err) {
      console.warn(`[emitNotificationToUser Async] Error en persistencia/push:`, err.message);
    }
  })();

  return true;
};

/**
 * Envía una notificación en tiempo real a todos los usuarios de un rol (ej. 'administrador')
 */
export const emitNotificationToRole = (role, notification) => {
  const payload = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title || 'SmartGym 🏋️',
    body: notification.body || '',
    data: notification.data || {},
    timestamp: new Date().toISOString(),
  };

  if (io) {
    io.to(`rol_${role.toLowerCase()}`).emit('notificacion', payload);
    console.log(`🔔 [Señal enviada a rol_${role}]: "${payload.title}" - ${payload.body}`);
  }

  // Despachar Push a los miembros del rol
  (async () => {
    try {
      const tokens = await notificacionesRepository.obtenerPushTokensPorRol(role);
      if (tokens.length > 0) {
        await sendExpoPushNotification({
          tokens,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
      }
    } catch (err) {
      console.warn(`[emitNotificationToRole Async] Error en push:`, err.message);
    }
  })();

  return true;
};

/**
 * Envía una señal de notificación masiva a todos los dispositivos conectados,
 * la almacena en BD y envía push a todos los dispositivos.
 */
export const emitNotificationToAll = (notification) => {
  const payload = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title || 'SmartGym 🏋️',
    body: notification.body || '',
    data: notification.data || {},
    timestamp: new Date().toISOString(),
  };

  if (io) {
    io.emit('notificacion', payload);
    console.log(`📢 [Señal Broadcast enviada]: "${payload.title}" - ${payload.body}`);
  }

  (async () => {
    try {
      await notificacionesRepository.crear({
        id_usuario: null,
        titulo: payload.title,
        mensaje: payload.body,
        tipo: 'broadcast',
        datos_extra: notification.data || {},
      });

      const tokens = await notificacionesRepository.obtenerTodosPushTokens();
      if (tokens.length > 0) {
        await sendExpoPushNotification({
          tokens,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
      }
    } catch (err) {
      console.warn(`[emitNotificationToAll Async] Error en persistencia/push:`, err.message);
    }
  })();

  return true;
};
