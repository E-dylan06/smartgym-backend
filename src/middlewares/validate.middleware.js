import { validationResult } from 'express-validator';

export const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Errores de validación en los datos enviados',
      errors: errors.array().map((err) => ({
        campo: err.path || err.param,
        mensaje: err.msg,
      })),
    });
  }
  next();
};
