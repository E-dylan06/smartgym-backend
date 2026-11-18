import { pool } from '../config/db.js';
import { AsistenciaEntity } from '../entities/Asistencia.entity.js';

export class AsistenciasRepository {
  async findByReservaId(idReserva) {
    const [rows] = await pool.query(
      'SELECT id_asistencia, id_reserva, asistio, fecha_marcado FROM asistencias WHERE id_reserva = ?',
      [idReserva]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async createInitial(idReserva, connection) {
    const conn = connection || pool;
    await conn.query(
      `INSERT INTO asistencias (id_reserva, asistio, fecha_marcado, activo)
       VALUES (?, 'no', NULL, 1)`,
      [idReserva]
    );
  }

  async saveMarcado(idReserva, valorAsistio) {
    const existing = await this.findByReservaId(idReserva);
    if (existing) {
      await pool.query(
        `UPDATE asistencias
         SET asistio = ?, fecha_marcado = NOW(2)
         WHERE id_reserva = ?`,
        [valorAsistio, idReserva]
      );
    } else {
      await pool.query(
        `INSERT INTO asistencias (id_reserva, asistio, fecha_marcado, activo)
         VALUES (?, ?, NOW(2), 1)`,
        [idReserva, valorAsistio]
      );
    }

    if (valorAsistio === 'si') {
      await pool.query(
        "UPDATE reservas SET estado = 'finalizada' WHERE id_reserva = ?",
        [idReserva]
      );
    }
  }

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT a.id_asistencia, a.asistio, a.fecha_marcado,
              r.id_reserva, r.fecha_reserva,
              c.nombre AS clase_nombre,
              h.fecha, h.hora_inicio, h.hora_fin,
              u_ent.nombre AS entrenador_nombre
       FROM asistencias a
       INNER JOIN reservas r ON a.id_reserva = r.id_reserva
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       INNER JOIN usuarios u_ent ON e.id_usuario = u_ent.id_usuario
       WHERE r.id_usuario = ? AND a.activo = 1
       ORDER BY h.fecha DESC, h.hora_inicio DESC`,
      [userId]
    );
    return rows.map((r) => new AsistenciaEntity(r));
  }
}

export const asistenciasRepository = new AsistenciasRepository();
