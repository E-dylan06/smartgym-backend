import { asistenciasService } from '../services/asistencias.service.js';

export const marcarAsistencia = async (req, res, next) => {
  try {
    const result = await asistenciasService.marcarAsistencia(req.body);
    res.json({
      ok: true,
      message: `Asistencia marcada como '${result.asistio}' exitosamente`,
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

export const getMisAsistencias = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const result = await asistenciasService.getMisAsistencias(userId);
    res.json({
      ok: true,
      total: result.total,
      data: {
        asistencias: result.asistencias,
      },
    });
  } catch (error) {
    next(error);
  }
};
