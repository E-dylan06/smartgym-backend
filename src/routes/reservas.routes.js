import { Router } from 'express';
import {
  crearReserva,
  getMisReservas,
  cancelarReserva,
  reprogramarReserva,
  getAllReservas,
} from '../controllers/reservas.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Todas las operaciones de reservas requieren autenticación
router.use(authenticateToken);

// Rutas de cliente (Socio)
router.post('/', crearReserva);
router.get('/mis-reservas', getMisReservas);
router.put('/:id/cancelar', cancelarReserva);
router.put('/:id/reprogramar', reprogramarReserva);

// Rutas de staff (Administrador y Entrenador)
router.get('/', requireRole('administrador', 'entrenador', 'recepcionista'), getAllReservas);

export default router;
