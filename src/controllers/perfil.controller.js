import { perfilService } from '../services/perfil.service.js';

export const getPerfil = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const perfil = await perfilService.getPerfil(userId);
    res.json({
      ok: true,
      data: {
        perfil,
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

export const updatePerfil = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const usuarioActualizado = await perfilService.updatePerfil(userId, req.body);
    res.json({
      ok: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        usuario: usuarioActualizado,
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

export const uploadFoto = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const result = await perfilService.uploadFoto(userId, req.file);
    res.json({
      ok: true,
      message: 'Foto de perfil actualizada exitosamente',
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

export const getPreferencias = async (req, res) => {
  const userId = req.user.id_usuario;
  const preferencias = perfilService.getPreferencias(userId);
  res.json({
    ok: true,
    data: {
      preferencias,
    },
  });
};

export const updatePreferencias = async (req, res) => {
  const userId = req.user.id_usuario;
  const updated = perfilService.updatePreferencias(userId, req.body);
  res.json({
    ok: true,
    message: 'Preferencias guardadas exitosamente',
    data: {
      preferencias: updated,
    },
  });
};

export const getMetricas = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const metricas = await perfilService.getMetricas(userId);
    res.json({
      ok: true,
      data: metricas,
    });
  } catch (error) {
    next(error);
  }
};

export const registrarMetricaCorporal = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    const result = await perfilService.registrarMetricaCorporal(userId, req.body);
    res.status(201).json({
      ok: true,
      message: 'Métricas corporales registradas e IMC recalculado exitosamente',
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
