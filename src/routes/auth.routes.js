import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '../validators/auth.validator.js';
import { validateFields } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Rutas públicas
router.post('/register', registerValidator, validateFields, authController.register);
router.post('/login', loginValidator, validateFields, authController.login);
router.post('/forgot-password', forgotPasswordValidator, validateFields, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validateFields, authController.resetPassword);

// Rutas protegidas
router.get('/me', authenticateToken, authController.getMe);
router.put('/update-password', authenticateToken, updatePasswordValidator, validateFields, authController.updatePassword);

export default router;
