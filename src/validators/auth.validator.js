import { body } from 'express-validator';

export const registerValidator = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('correo')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .isEmail()
    .withMessage('Ingresa un correo electrónico válido')
    .normalizeEmail(),
  body('contrasenia')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('dni')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 8, max: 15 })
    .withMessage('El DNI o documento debe tener entre 8 y 15 caracteres'),
  body('telefono')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
];

export const loginValidator = [
  body('login')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu correo electrónico o DNI'),
  body('contrasenia')
    .notEmpty()
    .withMessage('Ingresa tu contraseña'),
];

export const updatePasswordValidator = [
  body('contrasenia_actual')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('nueva_contrasenia')
    .notEmpty()
    .withMessage('La nueva contraseña es requerida')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
];

export const forgotPasswordValidator = [
  body('correo')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .isEmail()
    .withMessage('Ingresa un correo electrónico válido')
    .normalizeEmail(),
];

export const resetPasswordValidator = [
  body('correo')
    .trim()
    .notEmpty()
    .withMessage('El correo es obligatorio')
    .isEmail()
    .withMessage('Ingresa un correo válido')
    .normalizeEmail(),
  body('codigo')
    .trim()
    .notEmpty()
    .withMessage('El código de recuperación es obligatorio'),
  body('nueva_contrasenia')
    .notEmpty()
    .withMessage('La nueva contraseña es obligatoria')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
];
