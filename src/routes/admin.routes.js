import { Router } from 'express';
import {
  getUsuarios,
  updateRolUsuario,
  updateEstadoUsuario,
  getEntrenadores,
  getReporteAsistencias,
  getReporteHorasEntrenadores,
  getBloqueos,
  createBloqueo,
  deleteBloqueo,
} from '../controllers/admin.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Todas las rutas del módulo admin requieren rol de administrador
router.use(authenticateToken);
router.use(requireRole('administrador'));

// Gestión de usuarios y cambio de roles
router.get('/usuarios', getUsuarios);
router.put('/usuarios/:id/rol', updateRolUsuario);
router.put('/usuarios/:id/estado', updateEstadoUsuario);

// Lista de entrenadores del gimnasio
router.get('/entrenadores', getEntrenadores);

// Punto C.2: Reportes y Auditoría
router.get('/reportes/asistencias', getReporteAsistencias);
router.get('/reportes/entrenadores', getReporteHorasEntrenadores);

// Punto C.3: Bloqueo de Días Festivos y Mantenimiento
router.get('/bloqueos', getBloqueos);
router.post('/bloqueos', createBloqueo);
router.delete('/bloqueos/:id', deleteBloqueo);

export default router;
