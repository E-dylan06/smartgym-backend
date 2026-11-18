import { entrenadoresRepository } from '../repositories/entrenadores.repository.js';
import { pool } from '../config/db.js';
import { emitNotificationToUser } from '../config/socket.js';

export class EntrenadoresService {
  constructor(repository = entrenadoresRepository) {
    this.repository = repository;
  }

  async getMisClases(userId) {
    return this.repository.getMisClases(userId);
  }

  async getAlumnosDeClase(idHorario, userId) {
    const data = await this.repository.getAlumnosDeClase(idHorario, userId);
    if (!data) {
      const error = new Error('No tienes autorización para ver los alumnos de esta clase o el horario no existe');
      error.statusCode = 403;
      throw error;
    }
    return data;
  }

  async getPerfilEntrenador(userId) {
    const perfil = await this.repository.getPerfilEntrenador(userId);
    if (!perfil) {
      const error = new Error('Perfil de entrenador no encontrado para este usuario');
      error.statusCode = 404;
      throw error;
    }
    return perfil;
  }

  async getEntrenadoresParaSustitucion(userId) {
    const todos = await this.repository.findAllActivos();
    // Excluir al entrenador actual
    return todos.filter((e) => e.id_usuario !== userId);
  }

  /**
   * REGLA 1: Reprogramar fecha/hora de clase por el entrenador
   * - Restricción: No se puede reprogramar con menos de 24 horas de anticipación
   * - Notificación obligatoria: Notifica a todos los alumnos inscritos
   */
  async reprogramarClase(userId, idHorario, { fecha_nueva, hora_inicio_nueva, motivo }) {
    if (!fecha_nueva || !hora_inicio_nueva) {
      const error = new Error('Debes ingresar la nueva fecha y hora de inicio de la clase');
      error.statusCode = 400;
      throw error;
    }

    if (!motivo || motivo.trim().length < 5) {
      const error = new Error('Debes justificar el motivo de la reprogramación (mínimo 5 caracteres)');
      error.statusCode = 400;
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Obtener datos del horario actual
      const horario = await this.repository.findHorarioById(idHorario, connection);
      if (!horario) {
        const error = new Error('El horario de clase no existe o no se encuentra activo');
        error.statusCode = 404;
        throw error;
      }

      if (horario.entrenador_usuario_id !== userId) {
        const error = new Error('No tienes permisos para reprogramar una clase asignada a otro instructor');
        error.statusCode = 403;
        throw error;
      }

      // 2. Validación de 24 Horas
      const fechaStr = horario.fecha instanceof Date
        ? horario.fecha.toISOString().split('T')[0]
        : horario.fecha.toString().substring(0, 10);
      const horaStr = horario.hora_inicio.toString().substring(0, 8);
      const claseOriginalTime = new Date(`${fechaStr}T${horaStr}`).getTime();
      const diffMs = claseOriginalTime - Date.now();
      const horasRestantes = diffMs / (1000 * 60 * 60);

      if (horasRestantes < 24) {
        const error = new Error(
          'No puedes reprogramar la fecha/hora de la clase faltando menos de 24 horas. Para emergencias o imprevistos de último minuto, utiliza la opción de "Sustitución con otro Entrenador".'
        );
        error.statusCode = 400;
        throw error;
      }

      // 3. Validar nueva fecha (no puede ser pasada)
      const hoyStr = new Date().toISOString().split('T')[0];
      if (fecha_nueva < hoyStr) {
        const error = new Error('No puedes reprogramar una clase a una fecha pasada');
        error.statusCode = 400;
        throw error;
      }

      // 4. Formatear y calcular hora fin
      const formatTime = (t) => {
        const parts = t.toString().trim().split(':');
        const h = parts[0].padStart(2, '0');
        const m = (parts[1] || '00').padStart(2, '0');
        const s = (parts[2] || '00').padStart(2, '0');
        return `${h}:${m}:${s}`;
      };

      const horaInicioNorm = formatTime(hora_inicio_nueva);
      const [h, m] = horaInicioNorm.split(':').map(Number);
      const totalMin = h * 60 + m + (horario.duracion_minutos || 60);
      const finH = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const finM = String(totalMin % 60).padStart(2, '0');
      const horaFinNorm = `${finH}:${finM}:00`;

      // Validar franja 06:00 a 23:00
      if (horaInicioNorm < '06:00:00' || horaFinNorm > '23:00:00') {
        const error = new Error('El nuevo horario debe estar dentro de la jornada de atención del gimnasio (06:00 a 23:00)');
        error.statusCode = 400;
        throw error;
      }

      // 4.1 Validar que la nueva fecha no esté bloqueada por feriado o mantenimiento (C.3)
      const [bloqueo] = await connection.query(
        'SELECT motivo, tipo FROM bloqueos_gimnasio WHERE fecha = ? AND activo = 1',
        [fecha_nueva]
      );
      if (bloqueo.length > 0) {
        const error = new Error(`El gimnasio estará cerrado el ${fecha_nueva}: ${bloqueo[0].motivo} (${bloqueo[0].tipo})`);
        error.statusCode = 400;
        throw error;
      }

      // 5. Validar que el entrenador no tenga cruces en ese nuevo horario
      const [cruces] = await connection.query(
        `SELECT id_horario FROM horarios
         WHERE id_entrenador = ? AND fecha = ? AND id_horario != ? AND activo = 1
           AND ((hora_inicio < ? AND hora_fin > ?))`,
        [horario.id_entrenador, fecha_nueva, idHorario, horaFinNorm, horaInicioNorm]
      );

      if (cruces.length > 0) {
        const error = new Error('Ya tienes otra clase asignada que se cruza con esa nueva fecha y horario');
        error.statusCode = 409;
        throw error;
      }

      // 6. Inferir turno
      let idTurno = 1;
      if (horaInicioNorm >= '12:00:00' && horaInicioNorm < '18:00:00') idTurno = 2;
      else if (horaInicioNorm >= '18:00:00') idTurno = 3;

      // 7. Registrar auditoría de reprogramación
      await this.repository.registrarReprogramacionHorario(
        {
          id_horario: idHorario,
          id_usuario_entrenador: userId,
          fecha_anterior: fechaStr,
          hora_inicio_anterior: horaStr,
          hora_fin_anterior: horario.hora_fin.toString().substring(0, 8),
          fecha_nueva,
          hora_inicio_nueva: horaInicioNorm,
          hora_fin_nueva: horaFinNorm,
          motivo: motivo.trim(),
        },
        connection
      );

      // 8. Actualizar horario
      await this.repository.actualizarFechaHoraHorario(
        idHorario,
        fecha_nueva,
        horaInicioNorm,
        horaFinNorm,
        idTurno,
        connection
      );

      // 9. Obtener alumnos inscritos para notificarlos
      const alumnos = await this.repository.obtenerAlumnosInscritos(idHorario, connection);

      await connection.commit();

      // 10. Emitir notificaciones a todos los alumnos inscritos
      alumnos.forEach((alumno) => {
        emitNotificationToUser(alumno.id_usuario, {
          title: 'Horario de Clase Actualizado 📅',
          body: `Tu clase de "${horario.clase_nombre}" ha sido reprogramada al ${fecha_nueva} (${horaInicioNorm.substring(0, 5)} - ${horaFinNorm.substring(0, 5)}). Motivo: ${motivo.trim()}`,
          data: {
            id_horario: idHorario,
            tipo: 'clase_reprogramada_por_entrenador',
            fecha_nueva,
            hora_inicio_nueva: horaInicioNorm,
          },
        });
      });

      return {
        id_horario: idHorario,
        clase: horario.clase_nombre,
        fecha_anterior: fechaStr,
        fecha_nueva,
        hora_inicio_nueva: horaInicioNorm,
        hora_fin_nueva: horaFinNorm,
        total_alumnos_notificados: alumnos.length,
        motivo: motivo.trim(),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * REGLA 2: Sustitución de entrenador por otro colega
   * - Permisión: En cualquier momento (incluso faltando menos de 24 horas)
   * - Requisito: Justificación obligatoria para medición y trazabilidad
   * - Notificaciones: Al nuevo entrenador asignado y a todos los clientes inscritos
   */
  async sustituirEntrenador(userId, idHorario, { id_entrenador_nuevo, motivo }) {
    if (!id_entrenador_nuevo) {
      const error = new Error('Debes seleccionar el entrenador que cubrirá la clase');
      error.statusCode = 400;
      throw error;
    }

    if (!motivo || motivo.trim().length < 5) {
      const error = new Error('La justificación del cambio de entrenador es obligatoria (mínimo 5 caracteres para auditoría)');
      error.statusCode = 400;
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Obtener horario actual
      const horario = await this.repository.findHorarioById(idHorario, connection);
      if (!horario) {
        const error = new Error('El horario de clase no existe o no se encuentra activo');
        error.statusCode = 404;
        throw error;
      }

      if (horario.entrenador_usuario_id !== userId) {
        const error = new Error('No tienes permisos para transferir una clase que no tienes asignada');
        error.statusCode = 403;
        throw error;
      }

      if (Number(horario.id_entrenador) === Number(id_entrenador_nuevo)) {
        const error = new Error('No puedes transferir la clase al mismo entrenador ya asignado');
        error.statusCode = 400;
        throw error;
      }

      // 2. Validar que el nuevo entrenador exista y esté activo
      const [nuevoEntrenadorRows] = await connection.query(
        `SELECT e.id_entrenador, e.id_usuario, u.nombre, u.correo
         FROM entrenadores e
         INNER JOIN usuarios u ON e.id_usuario = u.id_usuario
         WHERE e.id_entrenador = ? AND e.activo = 1 AND u.activo = 1`,
        [id_entrenador_nuevo]
      );

      if (nuevoEntrenadorRows.length === 0) {
        const error = new Error('El entrenador seleccionado no existe o no se encuentra activo');
        error.statusCode = 404;
        throw error;
      }
      const nuevoEntrenador = nuevoEntrenadorRows[0];

      // 3. Validar que el nuevo entrenador no tenga cruces de horarios en esa fecha y hora
      const fechaStr = horario.fecha instanceof Date
        ? horario.fecha.toISOString().split('T')[0]
        : horario.fecha.toString().substring(0, 10);
      const horaInicioStr = horario.hora_inicio.toString().substring(0, 8);
      const horaFinStr = horario.hora_fin.toString().substring(0, 8);

      const [cruces] = await connection.query(
        `SELECT id_horario FROM horarios
         WHERE id_entrenador = ? AND fecha = ? AND id_horario != ? AND activo = 1
           AND ((hora_inicio < ? AND hora_fin > ?))`,
        [id_entrenador_nuevo, fechaStr, idHorario, horaFinStr, horaInicioStr]
      );

      if (cruces.length > 0) {
        const error = new Error(`El entrenador ${nuevoEntrenador.nombre} ya tiene otra clase asignada en ese mismo horario`);
        error.statusCode = 409;
        throw error;
      }

      // 4. Registrar la sustitución para auditoría y medición
      await this.repository.registrarSustitucion(
        {
          id_horario: idHorario,
          id_entrenador_anterior: horario.id_entrenador,
          id_entrenador_nuevo,
          id_usuario_solicitante: userId,
          motivo: motivo.trim(),
        },
        connection
      );

      // 5. Actualizar el horario con el nuevo entrenador
      await this.repository.actualizarEntrenadorHorario(idHorario, id_entrenador_nuevo, connection);

      // 6. Obtener alumnos inscritos
      const alumnos = await this.repository.obtenerAlumnosInscritos(idHorario, connection);

      await connection.commit();

      // 7. Notificar al nuevo entrenador
      emitNotificationToUser(nuevoEntrenador.id_usuario, {
        title: 'Nueva Asignación de Clase 📋',
        body: `Has sido asignado para cubrir la clase de "${horario.clase_nombre}" el ${fechaStr} a las ${horaInicioStr.substring(0, 5)}. Motivo: ${motivo.trim()}`,
        data: {
          id_horario: idHorario,
          tipo: 'asignacion_sustituto',
        },
      });

      // 8. Notificar a todos los alumnos inscritos sobre el cambio de coach
      alumnos.forEach((alumno) => {
        emitNotificationToUser(alumno.id_usuario, {
          title: 'Cambio de Instructor en tu Clase 🏋️',
          body: `Tu clase de "${horario.clase_nombre}" el ${fechaStr} (${horaInicioStr.substring(0, 5)}) será impartida por el coach ${nuevoEntrenador.nombre}. Motivo informado: ${motivo.trim()}`,
          data: {
            id_horario: idHorario,
            tipo: 'cambio_entrenador_notificado',
            nuevo_entrenador: nuevoEntrenador.nombre,
          },
        });
      });

      return {
        id_horario: idHorario,
        clase: horario.clase_nombre,
        fecha: fechaStr,
        horario: `${horaInicioStr.substring(0, 5)} - ${horaFinStr.substring(0, 5)}`,
        entrenador_anterior: horario.entrenador_nombre,
        entrenador_nuevo: nuevoEntrenador.nombre,
        total_alumnos_notificados: alumnos.length,
        motivo: motivo.trim(),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getHistorialSustituciones(userId) {
    const entrenador = await this.repository.findByUserId(userId);
    if (!entrenador) {
      const error = new Error('No estás registrado como entrenador');
      error.statusCode = 403;
      throw error;
    }

    const sustituciones = await this.repository.obtenerHistorialSustituciones(entrenador.id_entrenador);
    return {
      total: sustituciones.length,
      sustituciones,
    };
  }
}

export const entrenadoresService = new EntrenadoresService();
