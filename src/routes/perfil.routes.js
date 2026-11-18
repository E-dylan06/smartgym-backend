import { Router } from 'express';
import {
  getPerfil,
  updatePerfil,
  uploadFoto,
  getPreferencias,
  updatePreferencias,
  getMetricas,
  registrarMetricaCorporal,
} from '../controllers/perfil.controller.js';
import { updatePerfilValidator } from '../validators/perfil.validator.js';
import { validateFields } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { uploadProfile } from '../config/multer.js';

const router = Router();

// Todas las rutas de perfil requieren autenticación JWT
router.use(authenticateToken);

router.get('/', getPerfil);
router.put('/', updatePerfilValidator, validateFields, updatePerfil);
router.post('/avatar', uploadProfile.single('foto'), uploadFoto);
router.get('/preferencias', getPreferencias);
router.put('/preferencias', updatePreferencias);
router.get('/metricas', getMetricas);
router.post('/metricas-corporales', registrarMetricaCorporal);

export default router;
