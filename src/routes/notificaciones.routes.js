import { Router } from 'express';
import {
  enviarNotificacionPrueba,
  enviarNotificacionBroadcast,
  registrarPushToken,
  obtenerNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
} from '../controllers/notificaciones.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticateToken);

// Historial y bandeja de notificaciones
router.get('/', obtenerNotificaciones);
router.put('/marcar-todas', marcarTodasComoLeidas);
router.put('/:id/leida', marcarComoLeida);

// Registro de token de Expo Push
router.post('/token', registrarPushToken);

// Emisión individual de prueba al usuario conectado
router.post('/enviar-prueba', enviarNotificacionPrueba);

// Emisión masiva a todos los clientes (Solo administradores)
router.post('/broadcast', requireRole('administrador'), enviarNotificacionBroadcast);

export default router;
