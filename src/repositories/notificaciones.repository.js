import { pool } from '../config/db.js';

export class NotificacionesRepository {
  /**
   * Inserta una nueva notificación para un usuario o global (id_usuario = null)
   */
  async crear({ id_usuario = null, titulo, mensaje, tipo = 'general', datos_extra = null }) {
    const query = `
      INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, datos_extra, leido)
      VALUES (?, ?, ?, ?, ?, 0)
    `;
    const [result] = await pool.query(query, [
      id_usuario,
      titulo,
      mensaje,
      tipo,
      datos_extra ? JSON.stringify(datos_extra) : null,
    ]);
    return result.insertId;
  }

  /**
   * Obtiene las notificaciones dirigidas al usuario o globales (id_usuario IS NULL)
   */
  async obtenerPorUsuario(id_usuario, limit = 50) {
    const query = `
      SELECT 
        id_notificacion,
        id_usuario,
        titulo,
        mensaje,
        tipo,
        datos_extra,
        leido,
        fecha_creacion
      FROM notificaciones
      WHERE id_usuario = ? OR id_usuario IS NULL
      ORDER BY fecha_creacion DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(query, [id_usuario, limit]);
    return rows;
  }

  /**
   * Cuenta las notificaciones sin leer de un usuario
   */
  async contarNoLeidas(id_usuario) {
    const query = `
      SELECT COUNT(*) as no_leidas
      FROM notificaciones
      WHERE (id_usuario = ? OR id_usuario IS NULL) AND leido = 0
    `;
    const [rows] = await pool.query(query, [id_usuario]);
    return rows[0]?.no_leidas || 0;
  }

  /**
   * Marca una notificación como leída
   */
  async marcarComoLeida(id_notificacion, id_usuario) {
    const query = `
      UPDATE notificaciones
      SET leido = 1
      WHERE id_notificacion = ? AND (id_usuario = ? OR id_usuario IS NULL)
    `;
    const [result] = await pool.query(query, [id_notificacion, id_usuario]);
    return result.affectedRows > 0;
  }

  /**
   * Marca todas las notificaciones del usuario como leídas
   */
  async marcarTodasComoLeidas(id_usuario) {
    const query = `
      UPDATE notificaciones
      SET leido = 1
      WHERE (id_usuario = ? OR id_usuario IS NULL) AND leido = 0
    `;
    const [result] = await pool.query(query, [id_usuario]);
    return result.affectedRows;
  }

  /**
   * Guarda o actualiza el token de Expo Push del usuario
   */
  async guardarPushToken(id_usuario, push_token) {
    const query = `
      UPDATE usuarios
      SET expo_push_token = ?
      WHERE id_usuario = ?
    `;
    const [result] = await pool.query(query, [push_token, id_usuario]);
    return result.affectedRows > 0;
  }

  /**
   * Obtiene el token push de un usuario
   */
  async obtenerPushTokenPorUsuario(id_usuario) {
    const query = `
      SELECT expo_push_token
      FROM usuarios
      WHERE id_usuario = ? AND expo_push_token IS NOT NULL AND expo_push_token != ''
    `;
    const [rows] = await pool.query(query, [id_usuario]);
    return rows[0]?.expo_push_token || null;
  }

  /**
   * Obtiene todos los tokens push de usuarios activos para avisos masivos
   */
  async obtenerTodosPushTokens() {
    const query = `
      SELECT expo_push_token
      FROM usuarios
      WHERE activo = 1 AND expo_push_token IS NOT NULL AND expo_push_token != ''
    `;
    const [rows] = await pool.query(query);
    return rows.map((r) => r.expo_push_token);
  }

  /**
   * Obtiene los tokens push de usuarios según su rol
   */
  async obtenerPushTokensPorRol(rol_nombre) {
    const query = `
      SELECT u.expo_push_token
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      WHERE LOWER(r.nombre) = LOWER(?) AND u.activo = 1 AND u.expo_push_token IS NOT NULL AND u.expo_push_token != ''
    `;
    const [rows] = await pool.query(query, [rol_nombre]);
    return rows.map((r) => r.expo_push_token);
  }
}

export const notificacionesRepository = new NotificacionesRepository();
