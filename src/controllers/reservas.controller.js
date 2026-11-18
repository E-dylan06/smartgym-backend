import { reservasService } from '../services/reservas.service.js';

export const crearReserva = async (req, res, next) => {
  try {
    const { id_horario } = req.body;
    const result = await reservasService.crearReserva(req.user, id_horario);
    res.status(201).json({
      ok: true,
      message: '¡Reserva confirmada con éxito!',
      advertencia_descanso: result.advertencia_descanso,
      data: result,
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

export const getMisReservas = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const result = await reservasService.getMisReservas(userId);
    res.json({
      ok: true,
      total: result.total,
      data: {
        proximas: result.proximas,
        historial: result.historial,
        todas: result.todas,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await reservasService.cancelarReserva(req.user, id);
    res.json({
      ok: true,
      message: 'Reserva cancelada exitosamente y cupo liberado',
      data: result,
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

export const reprogramarReserva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await reservasService.reprogramarReserva(req.user, id, req.body);
    res.json({
      ok: true,
      message: result.mensaje,
      data: result,
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

export const getAllReservas = async (req, res, next) => {
  try {
    const { fecha, id_clase, estado } = req.query;
    const result = await reservasService.getAllReservas(req.user, { fecha, id_clase, estado });

    if (result.isPrivateNotice) {
      return res.json({
        ok: true,
        message: result.message,
        total: result.total,
        data: {
          reservas: result.reservas,
        },
      });
    }

    res.json({
      ok: true,
      total: result.total,
      data: {
        reservas: result.reservas,
      },
    });
  } catch (error) {
    next(error);
  }
};
