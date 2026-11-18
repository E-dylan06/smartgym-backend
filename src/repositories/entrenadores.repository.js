import { pool } from '../config/db.js';

export class EntrenadoresRepository {
  /**
   * Obtiene las clases programadas para el entrenador autenticado
   */
  async getMisClases(idUsuario) {
    const [rows] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              h.capacidad_maxima, h.cupos_disponibles, h.estado,
              c.id_clase, c.nombre AS clase_nombre, c.duracion_minutos,
              t.nombre AS turno,
              (h.capacidad_maxima - h.cupos_disponibles) AS total_alumnos_inscritos
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       LEFT JOIN turnos t ON h.id_turno = t.id_turno
       WHERE e.id_usuario = ? AND h.activo = 1
       ORDER BY h.fecha ASC, h.hora_inicio ASC`,
      [idUsuario]
    );
    return rows;
  }

  /**
   * Obtiene la lista de alumnos inscritos en una clase específica del entrenador
   */
  async getAlumnosDeClase(idHorario, idUsuario) {
    // 1. Verificar primero que la clase pertenece a este entrenador
    const [horarioRows] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              c.nombre AS clase_nombre, c.duracion_minutos
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       WHERE h.id_horario = ? AND e.id_usuario = ?`,
      [idHorario, idUsuario]
    );

    if (horarioRows.length === 0) {
      return null; // No pertenece al entrenador o no existe
    }

    // 2. Obtener los alumnos con sus reservas y estado de asistencia
    const [alumnos] = await pool.query(
      `SELECT r.id_reserva, r.fecha_reserva, r.estado AS estado_reserva,
              u.id_usuario, u.nombre AS alumno_nombre, u.correo AS alumno_correo,
              u.telefono AS alumno_telefono, u.foto_url AS alumno_foto,
              a.id_asistencia, COALESCE(a.asistio, 'no') AS asistio, a.fecha_marcado
       FROM reservas r
       INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
       LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
       WHERE r.id_horario = ?
         AND r.estado = 'confirmada'
         AND r.activo = 1
       ORDER BY u.nombre ASC`,
      [idHorario]
    );

    return {
      horario: horarioRows[0],
      total_alumnos: alumnos.length,
      alumnos,
    };
  }

  /**
   * Obtiene el perfil del entrenador con su especialidad y métricas
   */
  async getPerfilEntrenador(idUsuario) {
    const [rows] = await pool.query(
      `SELECT e.id_entrenador, e.biografia, e.tarifa_hora,
              u.id_usuario, u.nombre, u.correo, u.telefono, u.foto_url,
              esp.nombre AS especialidad_nombre, esp.descripcion AS especialidad_descripcion
       FROM entrenadores e
       INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       WHERE e.id_usuario = ?`,
      [idUsuario]
    );

    if (rows.length === 0) return null;
    const entrenador = rows[0];

    // Estadísticas del entrenador
    const [stats] = await pool.query(
      `SELECT 
         COUNT(DISTINCT h.id_horario) AS total_clases_programadas,
         COUNT(r.id_reserva) AS total_alumnos_atendidos,
         SUM(CASE WHEN a.asistio = 'si' THEN 1 ELSE 0 END) AS total_asistencias_completadas
       FROM horarios h
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       LEFT JOIN reservas r ON h.id_horario = r.id_horario AND r.estado = 'confirmada' AND r.activo = 1
       LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
       WHERE e.id_usuario = ?`,
      [idUsuario]
    );

    return {
      ...entrenador,
      estadisticas: stats[0] || {},
    };
  }

  /**
   * Busca registro de entrenador por id_usuario
   */
  async findByUserId(idUsuario) {
    const [rows] = await pool.query(
      `SELECT e.id_entrenador, e.id_usuario, e.id_especialidad, e.biografia, e.tarifa_hora, e.activo,
              esp.nombre AS especialidad_nombre
       FROM entrenadores e
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       WHERE e.id_usuario = ?`,
      [idUsuario]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Lista todos los entrenadores activos con su usuario y especialidad
   */
  async findAllActivos() {
    const [rows] = await pool.query(
      `SELECT e.id_entrenador, e.id_usuario, u.nombre, u.correo, u.telefono, u.foto_url,
              e.id_especialidad, esp.nombre AS especialidad_nombre, e.tarifa_hora, e.biografia
       FROM entrenadores e
       INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
       LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
       WHERE e.activo = 1 AND u.activo = 1
       ORDER BY u.nombre ASC`
    );
    return rows;
  }

  /**
   * Crea o activa registro de entrenador
   */
  async upsertEntrenador({ id_usuario, id_especialidad = 1, biografia = '', tarifa_hora = 0.00 }) {
    const existing = await this.findByUserId(id_usuario);
    if (existing) {
      await pool.query(
        `UPDATE entrenadores 
         SET id_especialidad = ?, biografia = ?, tarifa_hora = ?, activo = 1
         WHERE id_usuario = ?`,
        [id_especialidad, biografia, tarifa_hora, id_usuario]
      );
      return existing.id_entrenador;
    } else {
      const [res] = await pool.query(
        `INSERT INTO entrenadores (id_usuario, id_especialidad, biografia, tarifa_hora, activo)
         VALUES (?, ?, ?, ?, 1)`,
        [id_usuario, id_especialidad, biografia, tarifa_hora]
      );
      return res.insertId;
    }
  }

  /**
   * Desactiva el rol de entrenador para que vuelva a ser solo cliente
   */
  async desactivarEntrenador(id_usuario) {
    await pool.query('UPDATE entrenadores SET activo = 0 WHERE id_usuario = ?', [id_usuario]);
  }

  /**
   * Obtiene datos completos de un horario para validación de entrenador
   */
  async findHorarioById(idHorario, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin, h.id_clase, h.id_entrenador, h.id_turno,
              c.nombre AS clase_nombre, c.duracion_minutos,
              u.nombre AS entrenador_nombre, u.id_usuario AS entrenador_usuario_id
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
       WHERE h.id_horario = ? AND h.activo = 1`,
      [idHorario]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Obtiene la lista de alumnos con reservas confirmadas en un horario
   */
  async obtenerAlumnosInscritos(idHorario, connection) {
    const conn = connection || pool;
    const [rows] = await conn.query(
      `SELECT r.id_reserva, u.id_usuario, u.nombre, u.correo, u.telefono
       FROM reservas r
       INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
       WHERE r.id_horario = ? AND r.estado = 'confirmada' AND r.activo = 1`,
      [idHorario]
    );
    return rows;
  }

  /**
   * Registra una sustitución de entrenador para auditoría y medición
   */
  async registrarSustitucion({ id_horario, id_entrenador_anterior, id_entrenador_nuevo, id_usuario_solicitante, motivo }, connection) {
    const conn = connection || pool;
    const [res] = await conn.query(
      `INSERT INTO sustituciones_entrenadores 
       (id_horario, id_entrenador_anterior, id_entrenador_nuevo, id_usuario_solicitante, motivo, fecha_sustitucion)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id_horario, id_entrenador_anterior, id_entrenador_nuevo, id_usuario_solicitante, motivo]
    );
    return res.insertId;
  }

  /**
   * Actualiza el entrenador asignado a un horario
   */
  async actualizarEntrenadorHorario(idHorario, idEntrenadorNuevo, connection) {
    const conn = connection || pool;
    await conn.query(
      'UPDATE horarios SET id_entrenador = ? WHERE id_horario = ?',
      [idEntrenadorNuevo, idHorario]
    );
  }

  /**
   * Registra una reprogramación de fecha/hora de horario para auditoría y medición
   */
  async registrarReprogramacionHorario({ id_horario, id_usuario_entrenador, fecha_anterior, hora_inicio_anterior, hora_fin_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, motivo }, connection) {
    const conn = connection || pool;
    const [res] = await conn.query(
      `INSERT INTO reprogramaciones_horarios
       (id_horario, id_usuario_entrenador, fecha_anterior, hora_inicio_anterior, hora_fin_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, motivo, fecha_registro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id_horario, id_usuario_entrenador, fecha_anterior, hora_inicio_anterior, hora_fin_anterior, fecha_nueva, hora_inicio_nueva, hora_fin_nueva, motivo]
    );
    return res.insertId;
  }

  /**
   * Actualiza fecha y hora de un horario
   */
  async actualizarFechaHoraHorario(idHorario, fechaNueva, horaInicioNueva, horaFinNueva, idTurno, connection) {
    const conn = connection || pool;
    await conn.query(
      'UPDATE horarios SET fecha = ?, hora_inicio = ?, hora_fin = ?, id_turno = ? WHERE id_horario = ?',
      [fechaNueva, horaInicioNueva, horaFinNueva, idTurno, idHorario]
    );
  }

  /**
   * Obtiene el historial de sustituciones donde participó el entrenador
   */
  async obtenerHistorialSustituciones(idEntrenador) {
    const [rows] = await pool.query(
      `SELECT s.id_sustitucion, s.id_horario, s.motivo, s.fecha_sustitucion,
              h.fecha AS clase_fecha, h.hora_inicio, h.hora_fin,
              c.nombre AS clase_nombre,
              u_ant.id_usuario AS id_usuario_anterior, u_ant.nombre AS entrenador_anterior_nombre,
              u_nue.id_usuario AS id_usuario_nuevo, u_nue.nombre AS entrenador_nuevo_nombre,
              CASE 
                WHEN s.id_entrenador_anterior = ? THEN 'solicitante'
                ELSE 'cubridor'
              END AS rol_en_sustitucion
       FROM sustituciones_entrenadores s
       INNER JOIN horarios h ON s.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       INNER JOIN entrenadores e_ant ON s.id_entrenador_anterior = e_ant.id_entrenador
       INNER JOIN usuarios u_ant ON e_ant.id_usuario = u_ant.id_usuario
       INNER JOIN entrenadores e_nue ON s.id_entrenador_nuevo = e_nue.id_entrenador
       INNER JOIN usuarios u_nue ON e_nue.id_usuario = u_nue.id_usuario
       WHERE s.id_entrenador_anterior = ? OR s.id_entrenador_nuevo = ?
       ORDER BY s.fecha_sustitucion DESC`,
      [idEntrenador, idEntrenador, idEntrenador]
    );

    return rows.map(r => ({
      ...r,
      clase_fecha: r.clase_fecha instanceof Date ? r.clase_fecha.toISOString().split('T')[0] : String(r.clase_fecha).substring(0, 10),
    }));
  }
}

export const entrenadoresRepository = new EntrenadoresRepository();
