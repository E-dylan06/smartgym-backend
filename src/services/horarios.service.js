import { horariosRepository } from '../repositories/horarios.repository.js';

export class HorariosService {
  constructor(repository = horariosRepository) {
    this.repository = repository;
  }

  async listarHorarios(filtros) {
    const horarios = await this.repository.findAll(filtros);
    return {
      total: horarios.length,
      horarios,
    };
  }

  async obtenerDetalleHorario(id) {
    const horario = await this.repository.findById(id);
    if (!horario) {
      const error = new Error('Horario no encontrado');
      error.statusCode = 404;
      throw error;
    }
    return horario;
  }

  async crearHorario(user, data) {
    const { clasesRepository } = await import('../repositories/clases.repository.js');
    const { entrenadoresRepository } = await import('../repositories/entrenadores.repository.js');

    const { id_clase, fecha, capacidad_maxima } = data;
    let { id_entrenador, hora_inicio, hora_fin, id_turno } = data;

    // 1. Permisos y asignación de entrenador
    if (user.rol === 'entrenador') {
      const entrenador = await entrenadoresRepository.findByUserId(user.id_usuario);
      if (!entrenador || !entrenador.activo) {
        const error = new Error('No tienes un perfil de entrenador activo para programar clases');
        error.statusCode = 403;
        throw error;
      }
      // El entrenador SOLAMENTE puede programarse a sí mismo
      id_entrenador = entrenador.id_entrenador;
    } else if (user.rol === 'administrador') {
      if (!id_entrenador) {
        const error = new Error('El administrador debe especificar el id_entrenador asignado');
        error.statusCode = 400;
        throw error;
      }
    } else {
      const error = new Error('No tienes permisos para programar horarios');
      error.statusCode = 403;
      throw error;
    }

    // 2. Validar clase
    if (!id_clase) {
      const error = new Error('El campo id_clase es obligatorio');
      error.statusCode = 400;
      throw error;
    }
    const clase = await clasesRepository.findById(id_clase);
    if (!clase) {
      const error = new Error('La clase seleccionada no existe o no se encuentra activa');
      error.statusCode = 404;
      throw error;
    }

    // 3. Validar fecha
    if (!fecha) {
      const error = new Error('El campo fecha es obligatorio (formato YYYY-MM-DD)');
      error.statusCode = 400;
      throw error;
    }
    const hoyStr = new Date().toISOString().split('T')[0];
    if (fecha < hoyStr) {
      const error = new Error('No puedes programar horarios en fechas pasadas');
      error.statusCode = 400;
      throw error;
    }

    // 3.1 Validar si la fecha está bloqueada por feriado o mantenimiento (C.3)
    const { pool } = await import('../config/db.js');
    const [bloqueo] = await pool.query(
      'SELECT motivo, tipo FROM bloqueos_gimnasio WHERE fecha = ? AND activo = 1',
      [fecha]
    );
    if (bloqueo.length > 0) {
      const error = new Error(`El gimnasio estará cerrado el ${fecha}: ${bloqueo[0].motivo} (${bloqueo[0].tipo})`);
      error.statusCode = 400;
      throw error;
    }

    // 4. Validar horas (Apertura y Cierre)
    if (!hora_inicio) {
      const error = new Error('El campo hora_inicio es obligatorio (ej. 08:00)');
      error.statusCode = 400;
      throw error;
    }

    // Formatear a HH:MM:SS
    const formatTime = (t) => {
      const parts = t.toString().trim().split(':');
      const h = parts[0].padStart(2, '0');
      const m = (parts[1] || '00').padStart(2, '0');
      const s = (parts[2] || '00').padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    hora_inicio = formatTime(hora_inicio);

    // Si no se envió hora_fin, se calcula automáticamente con la duración de la clase
    if (!hora_fin) {
      const [h, m] = hora_inicio.split(':').map(Number);
      const totalMin = h * 60 + m + (clase.duracion_minutos || 60);
      const finH = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const finM = String(totalMin % 60).padStart(2, '0');
      hora_fin = `${finH}:${finM}:00`;
    } else {
      hora_fin = formatTime(hora_fin);
    }

    if (hora_inicio >= hora_fin) {
      const error = new Error('La hora de inicio debe ser anterior a la hora de fin');
      error.statusCode = 400;
      throw error;
    }

    // Apertura: 06:00:00 / Cierre: 23:00:00
    if (hora_inicio < '06:00:00' || hora_fin > '23:00:00') {
      const error = new Error(
        'El horario solicitado está fuera de la jornada de atención del gimnasio (Apertura: 06:00, Cierre: 23:00)'
      );
      error.statusCode = 400;
      throw error;
    }

    // 5. Determinar turno si no viene especificado
    if (!id_turno) {
      if (hora_inicio < '12:00:00') {
        id_turno = 1; // Mañana
      } else if (hora_inicio < '18:00:00') {
        id_turno = 2; // Tarde
      } else {
        id_turno = 3; // Noche
      }
    }

    // 6. Validar traslape/cruce de horario del entrenador
    const cruces = await this.repository.findCruceEntrenador(id_entrenador, fecha, hora_inicio, hora_fin);
    if (cruces.length > 0) {
      const cruce = cruces[0];
      const error = new Error(
        `Conflicto de horario: El entrenador ya tiene asignada la clase "${cruce.clase_nombre}" de ${cruce.hora_inicio} a ${cruce.hora_fin} en esa misma fecha`
      );
      error.statusCode = 400;
      throw error;
    }

    const capacidad = Number(capacidad_maxima) > 0 ? Number(capacidad_maxima) : 20;

    const newHorarioId = await this.repository.create({
      id_clase,
      id_entrenador,
      id_turno,
      fecha,
      hora_inicio,
      hora_fin,
      capacidad_maxima: capacidad,
    });

    const creado = await this.repository.findById(newHorarioId);

    return creado;
  }
}

export const horariosService = new HorariosService();
