import { authService } from '../services/auth.service.js';

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      ok: true,
      message: 'Usuario registrado exitosamente en SmartGym',
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

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({
      ok: true,
      message: 'Inicio de sesión exitoso',
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

export const updatePassword = async (req, res, next) => {
  try {
    const userId = req.user.id_usuario;
    await authService.updatePassword(userId, req.body);
    res.json({
      ok: true,
      message: 'Contraseña actualizada exitosamente',
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

export const forgotPassword = async (req, res, next) => {
  try {
    const { correo } = req.body;
    const result = await authService.forgotPassword(correo);
    res.json({
      ok: true,
      message: 'Se ha generado un código de recuperación válido por 15 minutos',
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

export const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    res.json({
      ok: true,
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
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

export const getMe = async (req, res) => {
  res.json({
    ok: true,
    data: {
      usuario: req.user,
    },
  });
};
