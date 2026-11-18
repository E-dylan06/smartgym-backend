import { Router } from 'express';
import { getAdminDashboard } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Dashboard exclusivo para el Administrador / Dueño
router.get('/admin', authenticateToken, requireRole('administrador'), getAdminDashboard);

export default router;
