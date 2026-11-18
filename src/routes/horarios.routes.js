import { Router } from 'express';
import { getAllHorarios, getHorarioById, crearHorario } from '../controllers/horarios.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Rutas públicas de consulta
router.get('/', getAllHorarios);
router.get('/:id', getHorarioById);

// Ruta protegida de programación (Administrador y Entrenador)
router.post('/', authenticateToken, requireRole('administrador', 'entrenador'), crearHorario);

export default router;
