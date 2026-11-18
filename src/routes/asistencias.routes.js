import { Router } from 'express';
import {
  marcarAsistencia,
  getMisAsistencias,
} from '../controllers/asistencias.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticateToken);

// Marcar asistencia (Solo personal autorizado: entrenadores, recepcionistas, admin)
router.post('/marcar', requireRole('entrenador', 'recepcionista', 'administrador'), marcarAsistencia);

// Consultar mis asistencias (Cliente)
router.get('/mis-asistencias', getMisAsistencias);

export default router;
