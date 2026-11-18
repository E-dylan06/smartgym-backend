import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Acceso no autorizado: No se proporcionó token de autenticación',
      });
    }

    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_smartgym_2026';
    const decoded = jwt.verify(token, secret);

    // Consultar usuario en la BD para asegurar que sigue activo
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.dni, u.correo, u.telefono, u.foto_url,
              u.id_rol, r.nombre AS rol,
              u.id_tipo_usuario, tu.nombre AS tipo_usuario,
              u.id_plan, pm.nombre AS plan_nombre,
              u.fecha_inicio_membresia, u.fecha_fin_membresia,
              u.contacto_emergencia, u.telefono_emergencia,
              u.activo
       FROM usuarios u
       LEFT JOIN roles r ON u.id_rol = r.id_rol
       LEFT JOIN tipos_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario
       LEFT JOIN planes_membresia pm ON u.id_plan = pm.id_plan
       WHERE u.id_usuario = ?`,
      [decoded.id_usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido: Usuario no encontrado',
      });
    }

    const user = rows[0];

    // Verificar bit de activo (puede venir como Buffer o número)
    const isActivo = Buffer.isBuffer(user.activo) ? user.activo[0] === 1 : Boolean(user.activo);
    if (!isActivo) {
      return res.status(403).json({
        ok: false,
        message: 'Tu cuenta se encuentra inactiva. Contacta a administración.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        message: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.',
        expired: true,
      });
    }
    return res.status(401).json({
      ok: false,
      message: 'Token de autenticación inválido',
    });
  }
};
