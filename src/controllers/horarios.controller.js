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

