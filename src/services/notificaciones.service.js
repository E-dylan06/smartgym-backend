import {
  emitNotificationToUser,
  emitNotificationToAll,
  emitNotificationToRole,
} from '../config/socket.js';
import { notificacionesRepository } from '../repositories/notificaciones.repository.js';
import { sendExpoPushNotification } from '../utils/expoPush.js';

export class NotificacionesService {
  /**
   * Registra el token de Expo Push del usuario actual
   */
  async registrarPushToken(id_usuario, token) {
    if (!token) {
      const error = new Error('Token push es requerido');
      error.statusCode = 400;
      throw error;
    }
    await notificacionesRepository.guardarPushToken(id_usuario, token);
    return { ok: true, message: 'Push token registrado con éxito' };
  }

  /**
   * Obtiene la bandeja de notificaciones del usuario
   */
  async obtenerNotificaciones(id_usuario) {
    const [notificaciones, noLeidas] = await Promise.all([
      notificacionesRepository.obtenerPorUsuario(id_usuario),
      notificacionesRepository.contarNoLeidas(id_usuario),
    ]);

    return {
      notificaciones,
      noLeidas,
    };
  }

  /**
   * Marca una notificación como leída
   */
  async marcarComoLeida(id_notificacion, id_usuario) {
    const actualizada = await notificacionesRepository.marcarComoLeida(id_notificacion, id_usuario);
    return { ok: actualizada };
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  async marcarTodasComoLeidas(id_usuario) {
    const total = await notificacionesRepository.marcarTodasComoLeidas(id_usuario);
    return { ok: true, totalMarcadas: total };
  }

  /**
   * Emite una notificación individual de prueba, la guarda en BD y la envía a Expo Push
   */
  async enviarNotificacionPrueba(user, { title, body }) {
    const notifTitle = title || '🏋️ SmartGym Notificación';
    const notifBody =
      body ||
      `¡Hola ${user.nombre}! Tu teléfono acaba de recibir una señal en tiempo real desde el backend de SmartGym.`;

    // 1. Guardar en Base de Datos
    let notifId = null;
    try {
      notifId = await notificacionesRepository.crear({
        id_usuario: user.id_usuario,
        titulo: notifTitle,
        mensaje: notifBody,
        tipo: 'prueba',
        datos_extra: { fecha: new Date().toISOString() },
      });
    } catch (e) {
      console.warn('Advertencia: no se pudo guardar notificación en BD:', e.message);
    }

    // 2. Emitir por Socket.IO en tiempo real
    const enviadaSocket = emitNotificationToUser(user.id_usuario, {
      title: notifTitle,
      body: notifBody,
      data: {
        tipo: 'prueba',
        id_notificacion: notifId,
        enviadoPor: 'backend',
        fecha: new Date().toISOString(),
      },
    });

    // 3. Enviar Push real vía Expo si tiene token
    try {
      const pushToken = await notificacionesRepository.obtenerPushTokenPorUsuario(user.id_usuario);
      if (pushToken) {
        await sendExpoPushNotification({
          tokens: [pushToken],
          title: notifTitle,
          body: notifBody,
          data: { tipo: 'prueba', id_notificacion: notifId },
        });
      }
    } catch (e) {
      console.warn('Advertencia enviando push a Expo:', e.message);
    }

    return {
      enviada: enviadaSocket,
      destinatario: user.correo,
      usuarioId: user.id_usuario,
      notificacion: {
        id_notificacion: notifId,
        title: notifTitle,
        body: notifBody,
      },
    };
  }

  /**
   * Emisión masiva a todos los usuarios: guarda en BD como anuncio global, emite por socket y envía push masivo
   */
  async enviarNotificacionBroadcast(user, { title, body }) {
    if (!title || !body) {
      const error = new Error('Título y mensaje son obligatorios para el broadcast');
      error.statusCode = 400;
      throw error;
    }

    const notifTitle = `📢 ${title}`;

    // 1. Guardar en BD (id_usuario = null => comunicado para todos)
    let notifId = null;
    try {
      notifId = await notificacionesRepository.crear({
        id_usuario: null,
        titulo: notifTitle,
        mensaje: body,
        tipo: 'broadcast',
        datos_extra: { emisor: user.nombre },
      });
    } catch (e) {
      console.warn('Advertencia al guardar broadcast en BD:', e.message);
    }

    // 2. Emitir por Socket.IO masivo
    emitNotificationToAll({
      title: notifTitle,
      body,
      data: {
        tipo: 'comunicado_general',
        id_notificacion: notifId,
        enviadoPor: user.nombre,
      },
    });

    // 3. Enviar Push Masivo vía Expo
    try {
      const tokens = await notificacionesRepository.obtenerTodosPushTokens();
      if (tokens.length > 0) {
        await sendExpoPushNotification({
          tokens,
          title: notifTitle,
          body,
          data: { tipo: 'broadcast', id_notificacion: notifId },
        });
      }
    } catch (e) {
      console.warn('Advertencia enviando push masivo a Expo:', e.message);
    }

    return {
      title,
      body,
      emisor: user.nombre,
      id_notificacion: notifId,
    };
  }

  /**
   * Helper para notificar a un usuario del sistema (usado por Reservas, Entrenadores, etc.)
   */
  async notificarUsuario(id_usuario, { titulo, mensaje, tipo = 'sistema', datos = {} }) {
    try {
      // 1. Guardar en BD
      const notifId = await notificacionesRepository.crear({
        id_usuario,
        titulo,
        mensaje,
        tipo,
        datos_extra: datos,
      });

      // 2. Socket en vivo
      emitNotificationToUser(id_usuario, {
        title: titulo,
        body: mensaje,
        data: { ...datos, id_notificacion: notifId, tipo },
      });

      // 3. Expo Push
      const token = await notificacionesRepository.obtenerPushTokenPorUsuario(id_usuario);
      if (token) {
        await sendExpoPushNotification({
          tokens: [token],
          title: titulo,
          body: mensaje,
          data: { ...datos, id_notificacion: notifId, tipo },
        });
      }

      return notifId;
    } catch (err) {
      console.warn(`[notificarUsuario] Error al procesar notificación para user ${id_usuario}:`, err.message);
      return null;
    }
  }
}

export const notificacionesService = new NotificacionesService();
