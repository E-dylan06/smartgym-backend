import { body } from 'express-validator';

export const updatePerfilValidator = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('El nombre debe tener al menos 3 caracteres'),
  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
  body('contacto_emergencia')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('El contacto de emergencia no puede exceder 100 caracteres'),
  body('telefono_emergencia')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono de emergencia debe tener entre 7 y 20 caracteres'),
];
