import { pool } from '../config/db.js';
import { emitNotificationToUser, emitNotificationToRole } from '../config/socket.js';
import { reservasRepository } from '../repositories/reservas.repository.js';
import { horariosRepository } from '../repositories/horarios.repository.js';
import { asistenciasRepository } from '../repositories/asistencias.repository.js';

export class ReservasService {
  constructor(
    resRepo = reservasRepository,
    horRepo = horariosRepository,
    asistRepo = asistenciasRepository
  ) {
    this.reservasRepo = resRepo;
    this.horariosRepo = horRepo;
    this.asistenciasRepo = asistRepo;
  }

  async crearReserva(user, id_horario) {
    if (!id_horario) {
      const error = new Error('El id_horario es obligatorio para realizar una reserva');
      error.statusCode = 400;
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Bloquear horario para control de aforo
      const horario = await this.horariosRepo.findByIdForUpdate(id_horario, connection);
      if (!horario) {
        const error = new Error('El horario seleccionado no existe');
        error.statusCode = 404;
        throw error;
      }

      const isActivo = Buffer.isBuffer(horario.activo) ? horario.activo[0] === 1 : Boolean(horario.activo);
      if (!isActivo) {
        const error = new Error('Este horario ya no se encuentra activo');
        error.statusCode = 400;
        throw error;
      }

      // 2. Validar aforo y cupos
      if (horario.cupos_disponibles <= 0 || horario.estado !== 'disponible') {
        const error = new Error('Aforo completo: No quedan cupos disponibles para esta clase');
        error.statusCode = 400;
        throw error;
      }

      // 2.1 Si el usuario es entrenador, no puede reservar como alumno su propia clase
      if (user.rol === 'entrenador') {
        const { entrenadoresRepository } = await import('../repositories/entrenadores.repository.js');
        const entrenador = await entrenadoresRepository.findByUserId(user.id_usuario);
        if (entrenador && Number(entrenador.id_entrenador) === Number(horario.id_entrenador)) {
          const error = new Error('No puedes reservar como alumno una clase en la que eres el instructor asignado');
          error.statusCode = 400;
          throw error;
        }
      }

      // 3. Validar duplicidad o reingreso tras cancelación previa
      const reservaPrevia = await this.reservasRepo.findByUserAndHorario(user.id_usuario, id_horario, connection);
      if (reservaPrevia) {
        if (reservaPrevia.estado === 'confirmada') {
          const error = new Error('Ya tienes una reserva confirmada para este horario');
          error.statusCode = 400;
          throw error;
        }
        if (reservaPrevia.estado === 'finalizada') {
          const error = new Error('Esta clase ya ha concluido y tu asistencia fue registrada');
          error.statusCode = 400;
          throw error;
        }
      }

      // 4. Validar cruce de horario en misma fecha (RF05)
      const cruces = await this.reservasRepo.findCruces(
        user.id_usuario,
        horario.fecha,
        horario.hora_inicio,
        horario.hora_fin,
        connection
      );

      if (cruces.length > 0) {
        const cruce = cruces[0];
        const error = new Error(
          `Cruce de horario: Ya tienes programada la clase "${cruce.clase_nombre}" de ${cruce.hora_inicio} a ${cruce.hora_fin}`
        );
        error.statusCode = 400;
        throw error;
      }

      // 4.1 Advertencia de descanso para clases contiguas
      const mismasFecha = await this.reservasRepo.findMismaFechaReservas(user.id_usuario, horario.fecha, connection);
      const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.toString().substring(0, 5).split(':').map(Number);
        return h * 60 + m;
      };

      const nuevoInicioMin = toMinutes(horario.hora_inicio);
      const nuevoFinMin = toMinutes(horario.hora_fin);
      let advertenciaDescanso = null;

      for (const otra of mismasFecha) {
        const otraInicioMin = toMinutes(otra.hora_inicio);
        const otraFinMin = toMinutes(otra.hora_fin);

        if (otraFinMin <= nuevoInicioMin) {
          const gap = nuevoInicioMin - otraFinMin;
          if (gap <= 45) {
            advertenciaDescanso = {
              requiere_descanso: true,
              tipo: 'contigua_previa',
              clase_relacionada: otra.clase_nombre,
              horario_relacionado: `${otra.hora_inicio.substring(0, 5)} - ${otra.hora_fin.substring(0, 5)}`,
              minutos_descanso: gap,
              mensaje: 'Advertencia: Tómate un descanso antes de comenzar con tu siguiente rutina.',
              detalle: `Has seleccionado una clase contigua (${gap} min de intervalo tras terminar ${otra.clase_nombre}). Te recomendamos hidratarte y recuperar energías.`,
            };
            break;
          }
        } else if (otraInicioMin >= nuevoFinMin) {
          const gap = otraInicioMin - nuevoFinMin;
          if (gap <= 45) {
            advertenciaDescanso = {
              requiere_descanso: true,
              tipo: 'contigua_posterior',
              clase_relacionada: otra.clase_nombre,
              horario_relacionado: `${otra.hora_inicio.substring(0, 5)} - ${otra.hora_fin.substring(0, 5)}`,
              minutos_descanso: gap,
              mensaje: 'Advertencia: Tómate un descanso antes de comenzar con tu siguiente rutina.',
              detalle: `Has seleccionado una clase contigua (${gap} min de intervalo antes de empezar ${otra.clase_nombre}). Te recomendamos hidratarte y recuperar energías.`,
            };
            break;
          }
        }
      }

      // 5. Insertar nueva reserva o reactivar reserva previamente cancelada
      let newReservaId;
      if (reservaPrevia && reservaPrevia.estado === 'cancelada') {
        newReservaId = reservaPrevia.id_reserva;
        await this.reservasRepo.reactivarReserva(newReservaId, 0.0, connection);
      } else {
        newReservaId = await this.reservasRepo.create(
          {
            id_usuario: user.id_usuario,
            id_horario,
            monto_abonado: 0.0,
          },
          connection
        );
      }

      // 6. Actualizar cupos en horario
      const nuevosCupos = horario.cupos_disponibles - 1;
      const nuevoEstado = nuevosCupos === 0 ? 'lleno' : 'disponible';
      await this.horariosRepo.updateCupos(id_horario, nuevosCupos, nuevoEstado, connection);

      // 7. Insertar o resetear asistencia inicial
      await this.asistenciasRepo.createInitial(newReservaId, connection);

      await connection.commit();

      const notifBody = advertenciaDescanso
        ? `Tu clase de ${horario.clase_nombre} (${horario.hora_inicio?.substring(0, 5)}) está asegurada. ¡Tómate un descanso antes de comenzar tu siguiente rutina!`
        : `Tu clase de ${horario.clase_nombre} (${horario.hora_inicio?.substring(0, 5)}) está asegurada.`;

      // Notificaciones Socket.IO
      emitNotificationToUser(user.id_usuario, {
        title: '¡Reserva Confirmada! 🏋️',
        body: notifBody,
        data: {
          id_reserva: newReservaId,
          tipo: 'reserva_confirmada',
          advertencia_descanso: advertenciaDescanso,
        },
      });

      emitNotificationToRole('administrador', {
        title: 'Nueva Reserva Registrada 📋',
        body: `${user.nombre} reservó cupo en ${horario.clase_nombre}.`,
        data: { id_reserva: newReservaId, tipo: 'admin_reserva' },
      });

      return {
        id_reserva: newReservaId,
        id_horario,
        clase: horario.clase_nombre,
        fecha: horario.fecha,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        cupos_restantes: nuevosCupos,
        estado: 'confirmada',
        advertencia_descanso: advertenciaDescanso,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getMisReservas(userId) {
    const reservas = await this.reservasRepo.findByUserId(userId);

    const getFechaStr = (f) => {
      if (!f) return '';
      if (f instanceof Date) return f.toISOString().split('T')[0];
      return String(f).substring(0, 10);
    };

    const hoy = new Date().toISOString().split('T')[0];
    const proximas = reservas.filter((r) => r.estado === 'confirmada' && getFechaStr(r.fecha) >= hoy);
    const historial = reservas.filter((r) => r.estado !== 'confirmada' || getFechaStr(r.fecha) < hoy);

    return {
      total: reservas.length,
      proximas,
      historial,
      todas: reservas,
    };
  }

  async cancelarReserva(user, id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const reserva = await this.reservasRepo.findByIdForUpdate(id, connection);
      if (!reserva) {
        const error = new Error('Reserva no encontrada');
        error.statusCode = 404;
        throw error;
      }

      const esAdmin = user.rol === 'administrador';
      if (!esAdmin && reserva.id_usuario !== user.id_usuario) {
        const error = new Error('No tienes permiso para cancelar esta reserva');
        error.statusCode = 403;
        throw error;
      }

      if (reserva.estado === 'cancelada') {
        const error = new Error('Esta reserva ya se encuentra cancelada');
        error.statusCode = 400;
        throw error;
      }

      // Validar límite de 1 hora para cancelar (salvo administrador)
      if (!esAdmin) {
        const horario = await this.horariosRepo.findById(reserva.id_horario);
        if (horario) {
          const fechaStr = horario.fecha instanceof Date
            ? horario.fecha.toISOString().split('T')[0]
            : horario.fecha.toString().substring(0, 10);
          const horaStr = horario.hora_inicio.toString().substring(0, 8);
          const claseTime = new Date(`${fechaStr}T${horaStr}`).getTime();
          const diffMs = claseTime - Date.now();
          const horasRestantes = diffMs / (1000 * 60 * 60);

          if (horasRestantes < 1) {
            const error = new Error(
              'Solo puedes cancelar tu reserva hasta con 1 hora de anticipación respecto al inicio de la clase'
            );
            error.statusCode = 400;
            throw error;
          }
        }
      }

      await this.reservasRepo.updateEstado(id, 'cancelada', connection);
      await this.horariosRepo.incrementarCupo(reserva.id_horario, connection);

      await connection.commit();

      emitNotificationToUser(user.id_usuario, {
        title: 'Reserva Cancelada ❌',
        body: 'Tu reserva fue cancelada exitosamente y el cupo ha sido liberado.',
        data: { id_reserva: Number(id), tipo: 'reserva_cancelada' },
      });

      return {
        id_reserva: Number(id),
        estado: 'cancelada',
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reprogramarReserva(user, idReserva, { nuevo_id_horario, motivo }) {
    if (!nuevo_id_horario) {
      const error = new Error('El nuevo_id_horario es obligatorio para reprogramar la clase');
      error.statusCode = 400;
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Obtener la reserva actual con bloqueo
      const reserva = await this.reservasRepo.findByIdForUpdate(idReserva, connection);
      if (!reserva) {
        const error = new Error('Reserva no encontrada');
        error.statusCode = 404;
        throw error;
      }

      const esAdmin = user.rol === 'administrador';
      if (!esAdmin && reserva.id_usuario !== user.id_usuario) {
        const error = new Error('No tienes permiso para reprogramar esta reserva');
        error.statusCode = 403;
        throw error;
      }

      if (reserva.estado !== 'confirmada') {
        const error = new Error(`Solo se pueden reprogramar reservas confirmadas (estado actual: ${reserva.estado})`);
        error.statusCode = 400;
        throw error;
      }

      if (Number(nuevo_id_horario) === Number(reserva.id_horario)) {
        const error = new Error('El nuevo horario seleccionado debe ser diferente al horario actual');
        error.statusCode = 400;
        throw error;
      }

      // 2. Obtener datos del horario original para validar el límite de anticipación (1 hora)
      const horarioOriginal = await this.horariosRepo.findByIdForUpdate(reserva.id_horario, connection);
      if (horarioOriginal) {
        const fechaStr = horarioOriginal.fecha instanceof Date
          ? horarioOriginal.fecha.toISOString().split('T')[0]
          : horarioOriginal.fecha.toString().substring(0, 10);
        const horaStr = horarioOriginal.hora_inicio.toString().substring(0, 8);
        const claseOriginalTime = new Date(`${fechaStr}T${horaStr}`).getTime();
        const diffMs = claseOriginalTime - Date.now();
        const horasRestantes = diffMs / (1000 * 60 * 60);

        if (!esAdmin && horasRestantes < 1) {
          const error = new Error(
            'Solo puedes reprogramar tu reserva hasta con 1 hora de anticipación respecto al inicio de la clase'
          );
          error.statusCode = 400;
          throw error;
        }
      }

      // 3. Validar y bloquear el nuevo horario
      const horarioNuevo = await this.horariosRepo.findByIdForUpdate(nuevo_id_horario, connection);
      if (!horarioNuevo) {
        const error = new Error('El nuevo horario seleccionado no existe');
        error.statusCode = 404;
        throw error;
      }

      const isActivoNuevo = Buffer.isBuffer(horarioNuevo.activo) ? horarioNuevo.activo[0] === 1 : Boolean(horarioNuevo.activo);
      if (!isActivoNuevo) {
        const error = new Error('El nuevo horario ya no se encuentra activo');
        error.statusCode = 400;
        throw error;
      }

      if (horarioNuevo.cupos_disponibles <= 0 || horarioNuevo.estado !== 'disponible') {
        const error = new Error('Aforo completo: No quedan cupos disponibles en el nuevo horario seleccionado');
        error.statusCode = 400;
        throw error;
      }

      // 4. Validar duplicidad en el nuevo horario
      const duplicada = await this.reservasRepo.findDuplicada(reserva.id_usuario, nuevo_id_horario, connection);
      if (duplicada) {
        const error = new Error('Ya tienes otra reserva confirmada para este nuevo horario');
        error.statusCode = 400;
        throw error;
      }

      // 5. Validar cruce de horario en la nueva fecha (excluyendo la reserva actual)
      const cruces = await this.reservasRepo.findCruces(
        reserva.id_usuario,
        horarioNuevo.fecha,
        horarioNuevo.hora_inicio,
        horarioNuevo.hora_fin,
        connection
      );
      const crucesReales = cruces.filter((c) => Number(c.id_reserva) !== Number(idReserva));
      if (crucesReales.length > 0) {
        const cruce = crucesReales[0];
        const error = new Error(
          `Cruce de horario: En esa fecha ya tienes reservada la clase "${cruce.clase_nombre}" de ${cruce.hora_inicio} a ${cruce.hora_fin}`
        );
        error.statusCode = 400;
        throw error;
      }

      // 6. Transacción atómica:
      // a) Devolver cupo al horario anterior
      await this.horariosRepo.incrementarCupo(reserva.id_horario, connection);

      // b) Descontar cupo en el nuevo horario
      const nuevosCupos = horarioNuevo.cupos_disponibles - 1;
      const nuevoEstado = nuevosCupos === 0 ? 'lleno' : 'disponible';
      await this.horariosRepo.updateCupos(nuevo_id_horario, nuevosCupos, nuevoEstado, connection);

      // c) Actualizar id_horario en la reserva
      await this.reservasRepo.updateHorarioReserva(idReserva, nuevo_id_horario, connection);

      // d) Registrar justificante en la tabla reprogramaciones_reservas
      const idReprogramacion = await this.reservasRepo.registrarReprogramacion(
        idReserva,
        reserva.id_horario,
        nuevo_id_horario,
        motivo,
        connection
      );

      await connection.commit();

      return {
        id_reserva: Number(idReserva),
        id_reprogramacion: idReprogramacion,
        id_horario_anterior: reserva.id_horario,
        id_horario_nuevo: Number(nuevo_id_horario),
        nueva_clase: horarioNuevo.clase_nombre,
        nueva_fecha: horarioNuevo.fecha,
        nueva_hora_inicio: horarioNuevo.hora_inicio,
        nueva_hora_fin: horarioNuevo.hora_fin,
        cupos_restantes_nuevo_horario: nuevosCupos,
        motivo: motivo || 'Sin motivo especificado',
        mensaje: 'Clase reprogramada exitosamente',
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getAllReservas(user, filtros) {
    if (user.rol === 'administrador') {
      return {
        isPrivateNotice: true,
        message: 'La gestión de citas individuales es privada entre el entrenador y sus clientes. El administrador supervisa el aforo general y la recaudación en el Dashboard.',
        total: 0,
        reservas: [],
      };
    }

    const rows = await this.reservasRepo.findAllAdmin({
      rol: user.rol,
      id_usuario: user.id_usuario,
      ...filtros,
    });

    return {
      isPrivateNotice: false,
      total: rows.length,
      reservas: rows,
    };
  }
}

export const reservasService = new ReservasService();
