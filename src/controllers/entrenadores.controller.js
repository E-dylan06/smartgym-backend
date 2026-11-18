import { entrenadoresService } from '../services/entrenadores.service.js';

export const getMisClases = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const clases = await entrenadoresService.getMisClases(userId);

    res.json({
      ok: true,
      total: clases.length,
      data: {
        clases,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAlumnosDeClase = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const { id_horario } = req.params;

    const data = await entrenadoresService.getAlumnosDeClase(id_horario, userId);

    res.json({
      ok: true,
      data,
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

export const getPerfilEntrenador = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const perfil = await entrenadoresService.getPerfilEntrenador(userId);

    res.json({
      ok: true,
      data: {
        entrenador: perfil,
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

export const getEntrenadoresParaSustitucion = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const entrenadores = await entrenadoresService.getEntrenadoresParaSustitucion(userId);

    res.json({
      ok: true,
      total: entrenadores.length,
      data: {
        entrenadores,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const reprogramarClase = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const { id_horario } = req.params;
    const result = await entrenadoresService.reprogramarClase(userId, id_horario, req.body);

    res.json({
      ok: true,
      message: `Clase reprogramada exitosamente. Se notificó a los ${result.total_alumnos_notificados} alumnos inscritos.`,
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

export const sustituirEntrenador = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const { id_horario } = req.params;
    const result = await entrenadoresService.sustituirEntrenador(userId, id_horario, req.body);

    res.json({
      ok: true,
      message: `Sustitución registrada con éxito. Clase transferida a ${result.entrenador_nuevo} y alumnos notificados.`,
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

export const getHistorialSustituciones = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const result = await entrenadoresService.getHistorialSustituciones(userId);

    res.json({
      ok: true,
      total: result.total,
      data: result.sustituciones,
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
