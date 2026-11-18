import { usuariosRepository } from '../repositories/usuarios.repository.js';
import { entrenadoresRepository } from '../repositories/entrenadores.repository.js';

export class AdminService {
  constructor(
    userRepo = usuariosRepository,
    trainerRepo = entrenadoresRepository
  ) {
    this.usuariosRepo = userRepo;
    this.entrenadoresRepo = trainerRepo;
  }

  async listarUsuarios(filtros) {
    const usuarios = await this.usuariosRepo.findAll(filtros);
    return {
      total: usuarios.length,
      usuarios,
    };
  }

  async cambiarRolUsuario(idUsuario, { nuevo_rol, id_especialidad = 1, tarifa_hora = 0.00, biografia = '' }) {
    const usuario = await this.usuariosRepo.findById(idUsuario);
    if (!usuario) {
      const error = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const rolNormalizado = nuevo_rol?.toLowerCase().trim();
    const mapaRoles = {
      administrador: 1,
      entrenador: 2,
      cliente: 3,
    };

    const targetRolId = mapaRoles[rolNormalizado];
    if (!targetRolId) {
      const error = new Error("Rol inválido. Opciones disponibles: 'cliente', 'entrenador', 'administrador'");
      error.statusCode = 400;
      throw error;
    }

    // Actualizar tabla usuarios
    await this.usuariosRepo.updateRol(idUsuario, targetRolId);

    // Si es promovido a entrenador
    if (rolNormalizado === 'entrenador') {
      await this.entrenadoresRepo.upsertEntrenador({
        id_usuario: idUsuario,
        id_especialidad,
        biografia,
        tarifa_hora,
      });
    } else {
      // Si pasa a cliente o cualquier otro rol, desactivar de la tabla entrenadores
      await this.entrenadoresRepo.desactivarEntrenador(idUsuario);
    }

    const usuarioActualizado = await this.usuariosRepo.findById(idUsuario);

    return {
      usuario: usuarioActualizado,
      nuevo_rol: rolNormalizado,
      mensaje: `Rol de ${usuario.nombre} actualizado a '${rolNormalizado}' exitosamente`,
    };
  }

  async cambiarEstadoUsuario(idUsuario, { activo }) {
    const usuario = await this.usuariosRepo.findById(idUsuario);
    if (!usuario) {
      const error = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const estadoBool = Boolean(activo);
    await this.usuariosRepo.updateEstadoActivo(idUsuario, estadoBool);

    return {
      id_usuario: idUsuario,
      activo: estadoBool,
      mensaje: `Usuario '${usuario.nombre}' ${estadoBool ? 'activado' : 'desactivado'} exitosamente`,
    };
  }

  async listarEntrenadoresActivos() {
    const entrenadores = await this.entrenadoresRepo.findAllActivos();
    return {
      total: entrenadores.length,
      entrenadores,
    };
  }

  // --- PUNTO C.2: REPORTES Y AUDITORÍA ADMINISTRATIVA ---

  async generarReporteAsistencias({ fecha_desde, fecha_hasta, id_clase } = {}) {
    const { pool } = await import('../config/db.js');
    let query = `
      SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin, h.capacidad_maxima,
             c.id_clase, c.nombre AS clase_nombre,
             u_ent.nombre AS entrenador_nombre,
             COUNT(r.id_reserva) AS total_reservas,
             SUM(CASE WHEN r.estado = 'confirmada' THEN 1 ELSE 0 END) AS reservas_confirmadas,
             SUM(CASE WHEN r.estado = 'cancelada' THEN 1 ELSE 0 END) AS reservas_canceladas,
             SUM(CASE WHEN a.asistio = 'si' THEN 1 ELSE 0 END) AS total_asistieron,
             SUM(CASE WHEN a.asistio = 'no' THEN 1 ELSE 0 END) AS total_faltaron
      FROM horarios h
      INNER JOIN clases c ON h.id_clase = c.id_clase
      INNER JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
      INNER JOIN usuarios u_ent ON e.id_usuario = u_ent.id_usuario
      LEFT JOIN reservas r ON h.id_horario = r.id_horario AND r.activo = 1
      LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
      WHERE h.activo = 1
    `;
    const params = [];
    if (fecha_desde) {
      query += ' AND h.fecha >= ?';
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ' AND h.fecha <= ?';
      params.push(fecha_hasta);
    }
    if (id_clase) {
      query += ' AND h.id_clase = ?';
      params.push(id_clase);
    }

    query += ' GROUP BY h.id_horario ORDER BY h.fecha DESC, h.hora_inicio DESC';
    const [rows] = await pool.query(query, params);

    const totalSesiones = rows.length;
    let totalCapacidad = 0;
    let totalReservas = 0;
    let totalAsistieron = 0;
    let totalFaltaron = 0;

    const desgloseClases = {};

    const sesionesFormateadas = rows.map((r) => {
      const capacidad = Number(r.capacidad_maxima) || 1;
      const inscritos = Number(r.reservas_confirmadas) || 0;
      const asistieron = Number(r.total_asistieron) || 0;
      const faltaron = Number(r.total_faltaron) || 0;
      const ocupacionPct = Math.min(100, Math.round((inscritos / capacidad) * 100));

      totalCapacidad += capacidad;
      totalReservas += inscritos;
      totalAsistieron += asistieron;
      totalFaltaron += faltaron;

      if (!desgloseClases[r.clase_nombre]) {
        desgloseClases[r.clase_nombre] = {
          clase: r.clase_nombre,
          sesiones: 0,
          inscritos: 0,
          asistieron: 0,
        };
      }
      desgloseClases[r.clase_nombre].sesiones += 1;
      desgloseClases[r.clase_nombre].inscritos += inscritos;
      desgloseClases[r.clase_nombre].asistieron += asistieron;

      const fStr = r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha).substring(0, 10);

      return {
        id_horario: r.id_horario,
        fecha: fStr,
        horario: `${r.hora_inicio?.substring(0, 5)} - ${r.hora_fin?.substring(0, 5)}`,
        clase: r.clase_nombre,
        entrenador: r.entrenador_nombre,
        capacidad,
        inscritos,
        asistieron,
        faltaron,
        ocupacion_pct: ocupacionPct,
      };
    });

    const ocupacionPromedio = totalCapacidad > 0 ? Math.round((totalReservas / totalCapacidad) * 100) : 0;
    const tasaAsistencia = totalReservas > 0 ? Math.round((totalAsistieron / totalReservas) * 100) : 0;

    return {
      kpis: {
        total_sesiones: totalSesiones,
        total_cupos_ofrecidos: totalCapacidad,
        total_inscritos: totalReservas,
        total_asistieron: totalAsistieron,
        total_faltaron: totalFaltaron,
        ocupacion_promedio_pct: ocupacionPromedio,
        tasa_asistencia_pct: tasaAsistencia,
      },
      desglose_por_disciplina: Object.values(desgloseClases),
      sesiones: sesionesFormateadas,
    };
  }

  async generarReporteHorasEntrenadores({ fecha_desde, fecha_hasta } = {}) {
    const { pool } = await import('../config/db.js');
    let query = `
      SELECT e.id_entrenador, u.nombre AS entrenador_nombre, u.correo, u.telefono,
             esp.nombre AS especialidad_nombre, e.tarifa_hora,
             COUNT(h.id_horario) AS clases_programadas,
             SUM(c.duracion_minutos) AS minutos_totales,
             SUM(CASE WHEN h.fecha < CURDATE() THEN 1 ELSE 0 END) AS clases_dictadas,
             SUM(CASE WHEN h.fecha < CURDATE() THEN c.duracion_minutos ELSE 0 END) AS minutos_dictados,
             COUNT(r.id_reserva) AS total_alumnos_atendidos,
             SUM(CASE WHEN a.asistio = 'si' THEN 1 ELSE 0 END) AS total_asistencias_confirmadas
      FROM entrenadores e
      INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
      LEFT JOIN horarios h ON e.id_entrenador = h.id_entrenador AND h.activo = 1
      LEFT JOIN clases c ON h.id_clase = c.id_clase
      LEFT JOIN reservas r ON h.id_horario = r.id_horario AND r.estado = 'confirmada' AND r.activo = 1
      LEFT JOIN asistencias a ON r.id_reserva = a.id_reserva
      WHERE e.activo = 1 AND u.activo = 1
    `;
    const params = [];
    if (fecha_desde) {
      query += ' AND (h.fecha IS NULL OR h.fecha >= ?)';
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ' AND (h.fecha IS NULL OR h.fecha <= ?)';
      params.push(fecha_hasta);
    }

    query += ' GROUP BY e.id_entrenador ORDER BY u.nombre ASC';
    const [rows] = await pool.query(query, params);

    let totalHorasGimnasio = 0;
    let totalNominaEstimada = 0;

    const reporte = rows.map((r) => {
      const tarifa = Number(r.tarifa_hora) || 35.0;
      const minDictados = Number(r.minutos_dictados) || 0;
      const horasDictadas = Number((minDictados / 60).toFixed(1));
      const honorariosEstimados = Number((horasDictadas * tarifa).toFixed(2));

      totalHorasGimnasio += horasDictadas;
      totalNominaEstimada += honorariosEstimados;

      return {
        id_entrenador: r.id_entrenador,
        nombre: r.entrenador_nombre,
        correo: r.correo,
        telefono: r.telefono,
        especialidad: r.especialidad_nombre || 'General',
        tarifa_hora: tarifa,
        clases_programadas: Number(r.clases_programadas) || 0,
        clases_dictadas: Number(r.clases_dictadas) || 0,
        horas_dictadas: horasDictadas,
        alumnos_atendidos: Number(r.total_alumnos_atendidos) || 0,
        asistencias_confirmadas: Number(r.total_asistencias_confirmadas) || 0,
        honorarios_estimados: honorariosEstimados,
        honorarios_formateados: `S/ ${honorariosEstimados.toFixed(2)}`,
      };
    });

    return {
      kpis: {
        total_entrenadores: reporte.length,
        total_horas_dictadas: Number(totalHorasGimnasio.toFixed(1)),
        total_nomina_estimada: Number(totalNominaEstimada.toFixed(2)),
        total_nomina_formateada: `S/ ${totalNominaEstimada.toFixed(2)}`,
      },
      entrenadores: reporte,
    };
  }

  // --- PUNTO C.3: BLOQUEO DE DÍAS FESTIVOS Y MANTENIMIENTO ---

  async listarBloqueos() {
    const { pool } = await import('../config/db.js');
    const [rows] = await pool.query(
      `SELECT b.id_bloqueo, b.fecha, b.motivo, b.tipo, b.fecha_registro, b.activo,
              u.nombre AS creado_por_nombre
       FROM bloqueos_gimnasio b
       LEFT JOIN usuarios u ON b.creado_por = u.id_usuario
       WHERE b.activo = 1
       ORDER BY b.fecha ASC`
    );

    return rows.map((r) => ({
      ...r,
      fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha).substring(0, 10),
    }));
  }

  async crearBloqueo(user, { fecha, motivo, tipo = 'feriado' }) {
    if (!fecha) {
      const error = new Error('La fecha a bloquear es obligatoria (formato YYYY-MM-DD)');
      error.statusCode = 400;
      throw error;
    }
    if (!motivo || motivo.trim().length < 4) {
      const error = new Error('El motivo del cierre/bloqueo debe tener al menos 4 caracteres');
      error.statusCode = 400;
      throw error;
    }

    const hoyStr = new Date().toISOString().split('T')[0];
    if (fecha < hoyStr) {
      const error = new Error('No puedes bloquear fechas pasadas');
      error.statusCode = 400;
      throw error;
    }

    const { pool } = await import('../config/db.js');

    const [existente] = await pool.query(
      'SELECT id_bloqueo, motivo FROM bloqueos_gimnasio WHERE fecha = ? AND activo = 1',
      [fecha]
    );
    if (existente.length > 0) {
      const error = new Error(`La fecha ${fecha} ya se encuentra registrada como día cerrado (${existente[0].motivo})`);
      error.statusCode = 400;
      throw error;
    }

    const [horariosAfectados] = await pool.query(
      'SELECT id_horario FROM horarios WHERE fecha = ? AND activo = 1',
      [fecha]
    );

    const [res] = await pool.query(
      `INSERT INTO bloqueos_gimnasio (fecha, motivo, tipo, creado_por, fecha_registro, activo)
       VALUES (?, ?, ?, ?, NOW(), 1)
       ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), tipo = VALUES(tipo), activo = 1`,
      [fecha, motivo.trim(), tipo, user.id_usuario]
    );

    return {
      id_bloqueo: res.insertId,
      fecha,
      motivo: motivo.trim(),
      tipo,
      horarios_afectados: horariosAfectados.length,
      mensaje: `Fecha ${fecha} registrada como día cerrado (${tipo}). ${
        horariosAfectados.length > 0
          ? `Atención: Hay ${horariosAfectados.length} sesión(es) existente(s) en esa fecha que requerirán ajuste.`
          : 'No hay clases en conflicto.'
      }`,
    };
  }

  async eliminarBloqueo(idBloqueo) {
    const { pool } = await import('../config/db.js');
    await pool.query('UPDATE bloqueos_gimnasio SET activo = 0 WHERE id_bloqueo = ?', [idBloqueo]);
    return { id_bloqueo: Number(idBloqueo), eliminado: true };
  }
}

export const adminService = new AdminService();
