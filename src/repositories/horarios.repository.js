import { pool } from '../config/db.js';
import { HorarioEntity } from '../entities/Horario.entity.js';

export class HorariosRepository {
  async findAll({ fecha, id_clase, id_entrenador, fecha_desde } = {}) {
    let query = `
      SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
             h.capacidad_maxima, h.cupos_disponibles, h.estado,
             c.id_clase, c.nombre AS clase_nombre, c.descripcion AS clase_descripcion,
             c.duracion_minutos, c.precio_sesion,
             tc.nombre AS tipo_clase_nombre,
             e.id_entrenador, u.nombre AS entrenador_nombre, u.foto_url AS entrenador_foto,
             esp.nombre AS especialidad_nombre,
             t.id_turno, t.nombre AS turno_nombre
      FROM horarios h
      INNER JOIN clases c ON h.id_clase = c.id_clase
      LEFT JOIN tipos_clase tc ON c.id_tipo_clase = tc.id_tipo_clase
      INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
      INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
      LEFT JOIN turnos t ON h.id_turno = t.id_turno
      WHERE h.activo = 1
    `;

    const params = [];

    if (fecha) {
      query += ' AND h.fecha = ?';
      params.push(fecha);
    } else if (fecha_desde) {
      query += ' AND h.fecha >= ?';
      params.push(fecha_desde);
    }

    if (id_clase) {
      query += ' AND h.id_clase = ?';
      params.push(id_clase);
    }

    if (id_entrenador) {
      query += ' AND h.id_entrenador = ?';
      params.push(id_entrenador);
    }

    query += ' ORDER BY h.fecha ASC, h.hora_inicio ASC';

    const [rows] = await pool.query(query, params);
    return rows.map((row) => new HorarioEntity(row));
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              h.capacidad_maxima, h.cupos_disponibles, h.estado,
              c.id_clase, c.nombre AS clase_nombre, c.descripcion AS clase_descripcion,
              c.duracion_minutos, c.precio_sesion,
              tc.nombre AS tipo_clase_nombre,
              e.id_entrenador, u.nombre AS entrenador_nombre, u.foto_url AS entrenador_foto,
              esp.nombre AS especialidad_nombre,
              t.id_turno, t.nombre AS turno_nombre
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       LEFT JOIN tipos_clase tc ON c.id_tipo_clase = tc.id_tipo_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       LEFT JOIN turnos t ON h.id_turno = t.id_turno
       WHERE h.id_horario = ? AND h.activo = 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return new HorarioEntity(rows[0]);
  }

  // Soporta bloqueo transaccional
  async findByIdForUpdate(id, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT h.id_horario, h.id_clase, h.id_entrenador, h.fecha, h.hora_inicio, h.hora_fin,
              h.capacidad_maxima, h.cupos_disponibles, h.estado, h.activo,
              c.nombre AS clase_nombre, c.precio_sesion
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE h.id_horario = ?
       FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async updateCupos(id, nuevosCupos, nuevoEstado, connection) {
    const conn = connection || pool;
    await conn.query(
      `UPDATE horarios
       SET cupos_disponibles = ?, estado = ?
       WHERE id_horario = ?`,
      [nuevosCupos, nuevoEstado, id]
    );
  }

  async incrementarCupo(id, connection) {
    const conn = connection || pool;
    await conn.query(
      `UPDATE horarios
       SET cupos_disponibles = cupos_disponibles + 1,
           estado = 'disponible'
       WHERE id_horario = ?`,
      [id]
    );
  }

  async findCruceEntrenador(idEntrenador, fecha, horaInicio, horaFin) {
    const [rows] = await pool.query(
      `SELECT h.id_horario, c.nombre AS clase_nombre, h.hora_inicio, h.hora_fin
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE h.id_entrenador = ?
         AND h.fecha = ?
         AND h.activo = 1
         AND (
           (h.hora_inicio < ? AND h.hora_fin > ?)
         )`,
      [idEntrenador, fecha, horaFin, horaInicio]
    );
    return rows;
  }

  async findTurnos() {
    const [rows] = await pool.query('SELECT * FROM turnos WHERE activo = 1 ORDER BY hora_inicio ASC');
    return rows;
  }

  async create({ id_clase, id_entrenador, id_turno, fecha, hora_inicio, hora_fin, capacidad_maxima }) {
    const [res] = await pool.query(
      `INSERT INTO horarios (
        id_clase, id_entrenador, id_turno, fecha, hora_inicio, hora_fin,
        capacidad_maxima, cupos_disponibles, estado, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'disponible', 1)`,
      [
        id_clase,
        id_entrenador,
        id_turno,
        fecha,
        hora_inicio,
        hora_fin,
        capacidad_maxima,
        capacidad_maxima,
      ]
    );
    return res.insertId;
  }
}

export const horariosRepository = new HorariosRepository();
