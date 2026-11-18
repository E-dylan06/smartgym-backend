import { Router } from 'express';
import { getAllPlanes } from '../controllers/planes.controller.js';

const router = Router();

router.get('/', getAllPlanes);

export default router;
