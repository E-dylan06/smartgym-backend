import { notificacionesService } from '../services/notificaciones.service.js';

export const registrarPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await notificacionesService.registrarPushToken(req.user.id_usuario, token);
    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerNotificaciones = async (req, res, next) => {
  try {
    const result = await notificacionesService.obtenerNotificaciones(req.user.id_usuario);
    res.json({
      ok: true,
      data: result.notificaciones,
      noLeidas: result.noLeidas,
    });
  } catch (error) {
    next(error);
  }
};

export const marcarComoLeida = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notificacionesService.marcarComoLeida(id, req.user.id_usuario);
    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const marcarTodasComoLeidas = async (req, res, next) => {
  try {
    const result = await notificacionesService.marcarTodasComoLeidas(req.user.id_usuario);
    res.json({
      ok: true,
      message: 'Todas las notificaciones han sido marcadas como leídas',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const enviarNotificacionPrueba = async (req, res, next) => {
  try {
    const result = await notificacionesService.enviarNotificacionPrueba(req.user, req.body);
    res.json({
      ok: true,
      message: 'Señal de notificación emitida con éxito al dispositivo',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const enviarNotificacionBroadcast = async (req, res, next) => {
  try {
    const result = await notificacionesService.enviarNotificacionBroadcast(req.user, req.body);
    res.json({
      ok: true,
      message: 'Notificación masiva enviada a todos los teléfonos conectados',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};
