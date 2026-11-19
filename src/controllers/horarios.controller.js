import { horariosService } from '../services/horarios.service.js';

export const getAllHorarios = async (req, res, next) => {
  try {
    const { fecha, id_clase, id_entrenador, fecha_desde } = req.query;
    const result = await horariosService.listarHorarios({ fecha, id_clase, id_entrenador, fecha_desde });
    res.json({
      ok: true,
      total: result.total,
      data: {
        horarios: result.horarios,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getHorarioById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const horario = await horariosService.obtenerDetalleHorario(id);
    res.json({
      ok: true,
      data: {
        horario,
      },
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getBloqueosGimnasio = async (req, res, next) => {
  try {
    const { pool } = await import('../config/db.js');
    const [rows] = await pool.query(
      `SELECT id_bloqueo, fecha, motivo, tipo FROM bloqueos_gimnasio WHERE activo = 1 ORDER BY fecha ASC`
    );
    res.json({
      ok: true,
      data: {
        bloqueos: rows.map((r) => ({
          id_bloqueo: r.id_bloqueo,
          fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha).substring(0, 10),
          motivo: r.motivo,
          tipo: r.tipo,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const crearHorario = async (req, res, next) => {
  try {
    const horario = await horariosService.crearHorario(req.user, req.body);
    res.status(201).json({
      ok: true,
      message: 'Horario programado exitosamente',
      data: {
        horario,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};

