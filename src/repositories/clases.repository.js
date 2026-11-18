import { pool } from '../config/db.js';
import { ClaseEntity } from '../entities/Clase.entity.js';
import { HorarioEntity } from '../entities/Horario.entity.js';

export class ClasesRepository {
  async findAllActivas() {
    const [rows] = await pool.query(
      `SELECT c.id_clase, c.nombre, c.descripcion, c.duracion_minutos, c.precio_sesion,
              tc.id_tipo_clase, tc.nombre AS tipo_clase_nombre, tc.descripcion AS tipo_clase_descripcion
       FROM clases c
       LEFT JOIN tipos_clase tc ON c.id_tipo_clase = tc.id_tipo_clase
       WHERE c.activo = 1
       ORDER BY c.nombre ASC`
    );
    return rows.map((row) => new ClaseEntity(row));
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT c.id_clase, c.nombre, c.descripcion, c.duracion_minutos, c.precio_sesion,
              tc.id_tipo_clase, tc.nombre AS tipo_clase_nombre
       FROM clases c
       LEFT JOIN tipos_clase tc ON c.id_tipo_clase = tc.id_tipo_clase
       WHERE c.id_clase = ? AND c.activo = 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return new ClaseEntity(rows[0]);
  }

  async findHorariosByClaseId(idClase) {
    const [rows] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              h.capacidad_maxima, h.cupos_disponibles, h.estado,
              e.id_entrenador, u.nombre AS entrenador_nombre, esp.nombre AS entrenador_especialidad
       FROM horarios h
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       WHERE h.id_clase = ? AND h.activo = 1 AND h.fecha >= CURDATE()
       ORDER BY h.fecha ASC, h.hora_inicio ASC`,
      [idClase]
    );
    return rows.map((row) => new HorarioEntity(row));
  }

  async findAllTipos() {
    const [rows] = await pool.query('SELECT id_tipo_clase, nombre, descripcion FROM tipos_clase WHERE activo = 1 ORDER BY nombre ASC');
    return rows;
  }

  async create({ nombre, descripcion, id_tipo_clase, duracion_minutos, precio_sesion = 0.0 }) {
    const [res] = await pool.query(
      `INSERT INTO clases (nombre, descripcion, id_tipo_clase, duracion_minutos, precio_sesion, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nombre, descripcion, id_tipo_clase, duracion_minutos, precio_sesion]
    );
    return res.insertId;
  }

  async update(id, fields) {
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    await pool.query(`UPDATE clases SET ${updates.join(', ')} WHERE id_clase = ?`, values);
  }

  async delete(id) {
    await pool.query('UPDATE clases SET activo = 0 WHERE id_clase = ?', [id]);
  }

  async hasUpcomingHorarios(id) {
    const [rows] = await pool.query(
      'SELECT id_horario FROM horarios WHERE id_clase = ? AND activo = 1 AND fecha >= CURDATE() LIMIT 1',
      [id]
    );
    return rows.length > 0;
  }
}

export const clasesRepository = new ClasesRepository();
