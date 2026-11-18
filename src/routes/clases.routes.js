import { Router } from 'express';
import {
  getAllClases,
  getClaseById,
  getTiposClase,
  crearClase,
  actualizarClase,
  eliminarClase,
} from '../controllers/clases.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Rutas públicas / socios
router.get('/', getAllClases);
router.get('/tipos', getTiposClase);
router.get('/:id', getClaseById);

// Rutas administrativas (Gestión de Disciplinas C.1)
router.post('/', authenticateToken, requireRole('administrador'), crearClase);
router.put('/:id', authenticateToken, requireRole('administrador'), actualizarClase);
router.delete('/:id', authenticateToken, requireRole('administrador'), eliminarClase);

export default router;
