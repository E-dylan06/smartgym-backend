import { Router } from 'express';
import {
  getMisClases,
  getAlumnosDeClase,
  getPerfilEntrenador,
  getEntrenadoresParaSustitucion,
  reprogramarClase,
  sustituirEntrenador,
  getHistorialSustituciones,
} from '../controllers/entrenadores.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Módulo exclusivo para entrenadores (protegido por rol)
router.use(authenticateToken);
router.use(requireRole('entrenador'));

router.get('/mis-clases', getMisClases);
router.get('/clases/:id_horario/alumnos', getAlumnosDeClase);
router.get('/perfil', getPerfilEntrenador);
router.get('/sustituciones', getHistorialSustituciones);

// Rutas de flexibilidad y validaciones del entrenador
router.get('/disponibles', getEntrenadoresParaSustitucion);
router.put('/clases/:id_horario/reprogramar', reprogramarClase);
router.put('/clases/:id_horario/sustituir', sustituirEntrenador);

export default router;
