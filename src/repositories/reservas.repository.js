import { pool } from '../config/db.js';
import { ReservaEntity } from '../entities/Reserva.entity.js';

export class ReservasRepository {
  async findDuplicada(userId, idHorario, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT id_reserva FROM reservas
       WHERE id_usuario = ? AND id_horario = ? AND estado = 'confirmada' AND activo = 1`,
      [userId, idHorario]
    );
    return rows.length > 0;
  }

  async findByUserAndHorario(userId, idHorario, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT id_reserva, estado, activo FROM reservas
       WHERE id_usuario = ? AND id_horario = ?`,
      [userId, idHorario]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async reactivarReserva(idReserva, montoAbonado = 0.0, connection) {
    const conn = connection || pool;
    await conn.query(
      `UPDATE reservas
       SET estado = 'confirmada', fecha_reserva = NOW(2), monto_abonado = ?, activo = 1
       WHERE id_reserva = ?`,
      [montoAbonado, idReserva]
    );
    return idReserva;
  }

  async findCruces(userId, fecha, horaInicio, horaFin, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT r.id_reserva, c.nombre AS clase_nombre, h.hora_inicio, h.hora_fin
       FROM reservas r
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE r.id_usuario = ?
         AND r.estado = 'confirmada'
         AND r.activo = 1
         AND h.fecha = ?
         AND (
           (h.hora_inicio < ? AND h.hora_fin > ?)
         )`,
      [userId, fecha, horaFin, horaInicio]
    );
    return rows;
  }

  async findMismaFechaReservas(userId, fecha, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT r.id_reserva, c.nombre AS clase_nombre, h.hora_inicio, h.hora_fin
       FROM reservas r
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE r.id_usuario = ?
         AND r.estado = 'confirmada'
         AND r.activo = 1
         AND h.fecha = ?`,
      [userId, fecha]
    );
    return rows;
  }

  async create({ id_usuario, id_horario, monto_abonado = 0.0 }, connection) {
    const conn = connection || pool;
    const [result] = await conn.query(
      `INSERT INTO reservas (id_usuario, id_horario, fecha_reserva, monto_abonado, estado, activo)
       VALUES (?, ?, NOW(2), ?, 'confirmada', 1)`,
      [id_usuario, id_horario, monto_abonado]
    );
    return result.insertId;
  }

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT r.id_reserva, r.fecha_reserva, r.monto_abonado, r.estado,
              h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              c.id_clase, c.nombre AS clase_nombre, c.descripcion AS clase_descripcion,
              c.duracion_minutos,
              e.id_entrenador,
              u_ent.nombre AS entrenador_nombre, u_ent.foto_url AS entrenador_foto,
              esp.nombre AS entrenador_especialidad,
              a.id_asistencia, a.asistio, a.fecha_marcado AS asistencia_fecha,
              rep.id_reprogramacion, rep.motivo AS reprogramacion_motivo, rep.fecha_reprogramacion
       FROM reservas r
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       INNER JOIN usuarios u_ent ON e.id_usuario = u_ent.id_usuario
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
       LEFT JOIN (
         SELECT id_reserva, MAX(id_reprogramacion) AS id_reprogramacion, MAX(motivo) AS motivo, MAX(fecha_reprogramacion) AS fecha_reprogramacion
         FROM reprogramaciones_reservas GROUP BY id_reserva
       ) rep ON r.id_reserva = rep.id_reserva
       WHERE r.id_usuario = ? AND r.activo = 1
       ORDER BY h.fecha DESC, h.hora_inicio DESC`,
      [userId]
    );
    return rows.map((r) => new ReservaEntity(r));
  }

  async findByIdForUpdate(id, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT id_reserva, id_usuario, id_horario, estado
       FROM reservas
       WHERE id_reserva = ? AND activo = 1
       FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async updateEstado(id, estado, connection) {
    const conn = connection || pool;
    await conn.query(
      'UPDATE reservas SET estado = ? WHERE id_reserva = ?',
      [estado, id]
    );
  }

  async findAllAdmin({ rol, id_usuario, fecha, id_clase, estado }) {
    let query = `
      SELECT r.id_reserva, r.fecha_reserva, r.estado,
             u.id_usuario, u.nombre AS usuario_nombre, u.correo AS usuario_correo, u.telefono AS usuario_telefono,
             h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
             c.nombre AS clase_nombre,
             u_ent.nombre AS entrenador_nombre,
             a.asistio, a.fecha_marcado
      FROM reservas r
      INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
      INNER JOIN horarios h ON r.id_horario = h.id_horario
      INNER JOIN clases c ON h.id_clase = c.id_clase
      INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
      INNER JOIN usuarios u_ent ON e.id_usuario = u_ent.id_usuario
      LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
      WHERE r.activo = 1
    `;

    const params = [];

    if (rol === 'entrenador') {
      query += ' AND e.id_usuario = ?';
      params.push(id_usuario);
    }

    if (fecha) {
      query += ' AND h.fecha = ?';
      params.push(fecha);
    }
    if (id_clase) {
      query += ' AND h.id_clase = ?';
      params.push(id_clase);
    }
    if (estado) {
      query += ' AND r.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY h.fecha DESC, h.hora_inicio DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  async updateHorarioReserva(idReserva, idHorarioNuevo, connection) {
    const conn = connection || pool;
    await conn.query(
      'UPDATE reservas SET id_horario = ? WHERE id_reserva = ?',
      [idHorarioNuevo, idReserva]
    );
  }

  async registrarReprogramacion(idReserva, idHorarioAnterior, idHorarioNuevo, motivo, connection) {
    const conn = connection || pool;
    const [res] = await conn.query(
      `INSERT INTO reprogramaciones_reservas (
        id_reserva, id_horario_anterior, id_horario_nuevo, motivo, fecha_reprogramacion
      ) VALUES (?, ?, ?, ?, NOW(2))`,
      [idReserva, idHorarioAnterior, idHorarioNuevo, motivo || null]
    );
    return res.insertId;
  }

  async findReprogramacionesByReserva(idReserva) {
    const [rows] = await pool.query(
      `SELECT r.id_reprogramacion, r.id_reserva, r.id_horario_anterior, r.id_horario_nuevo,
              r.motivo, r.fecha_reprogramacion,
              h_ant.fecha AS fecha_anterior, h_ant.hora_inicio AS hora_inicio_anterior,
              h_nue.fecha AS fecha_nueva, h_nue.hora_inicio AS hora_inicio_nueva,
              c.nombre AS clase_nombre
       FROM reprogramaciones_reservas r
       INNER JOIN horarios h_ant ON r.id_horario_anterior = h_ant.id_horario
       INNER JOIN horarios h_nue ON r.id_horario_nuevo = h_nue.id_horario
       INNER JOIN clases c ON h_nue.id_clase = c.id_clase
       WHERE r.id_reserva = ?
       ORDER BY r.fecha_reprogramacion DESC`,
      [idReserva]
    );
    return rows;
  }
}

export const reservasRepository = new ReservasRepository();
