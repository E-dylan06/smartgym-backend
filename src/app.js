import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Middlewares globales
import { errorHandler } from './middlewares/error.middleware.js';

// Rutas de la arquitectura en capas
import authRoutes from './routes/auth.routes.js';
import perfilRoutes from './routes/perfil.routes.js';
import clasesRoutes from './routes/clases.routes.js';
import horariosRoutes from './routes/horarios.routes.js';
import reservasRoutes from './routes/reservas.routes.js';
import asistenciasRoutes from './routes/asistencias.routes.js';
import planesRoutes from './routes/planes.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificacionesRoutes from './routes/notificaciones.routes.js';
import entrenadoresRoutes from './routes/entrenadores.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Logger HTTP para desarrollo
app.use(morgan('dev'));

// Middlewares de parseo y CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (fotos de perfil subidas)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ruta de estado de salud y bienvenida
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API SmartGym - Sistema de Citas y Asistencias en funcionamiento',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Montaje de rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/clases', clasesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/entrenadores', entrenadoresRoutes);
app.use('/api/admin', adminRoutes);

// Manejo de ruta no encontrada (404)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

export default app;
