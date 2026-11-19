import { Router } from 'express';
import {
  getAllHorarios,
  getHorarioById,
  crearHorario,
  getBloqueosGimnasio,
} from '../controllers/horarios.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Consulta de días festivos / cierres de atención del gimnasio
router.get('/bloqueos', getBloqueosGimnasio);

// Rutas públicas de consulta de horarios
router.get('/', getAllHorarios);
router.get('/:id', getHorarioById);

// Ruta protegida de programación (Administrador y Entrenador)
router.post('/', authenticateToken, requireRole('administrador', 'entrenador'), crearHorario);

export default router;
