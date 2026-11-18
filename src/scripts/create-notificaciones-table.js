import { pool } from '../config/db.js';

async function setupNotificaciones() {
  try {
    console.log('--- Configurando tabla notificaciones y tokens push ---');
    
    // 1. Agregar columna expo_push_token a usuarios si no existe
    const [cols] = await pool.query(`SHOW COLUMNS FROM usuarios LIKE 'expo_push_token'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE usuarios ADD COLUMN expo_push_token VARCHAR(255) NULL`);
      console.log('✅ Columna expo_push_token agregada a tabla usuarios');
    } else {
      console.log('ℹ️ Columna expo_push_token ya existe en usuarios');
    }

    // 2. Crear tabla notificaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NULL,
        titulo VARCHAR(150) NOT NULL,
        mensaje TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'general',
        datos_extra JSON NULL,
        leido TINYINT(1) DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_usuario_fecha (id_usuario, fecha_creacion),
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla notificaciones verificada/creada');

    // 3. Insertar algunas notificaciones de bienvenida si está vacía
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM notificaciones');
    if (countRows[0].total === 0) {
      const [users] = await pool.query('SELECT id_usuario FROM usuarios LIMIT 5');
      for (const u of users) {
        await pool.query(
          `INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leido) 
           VALUES (?, '¡Bienvenido a SmartGym 2026! 🏋️', 'Tu cuenta está activa y sincronizada con el sistema.', 'bienvenida', 0)`,
          [u.id_usuario]
        );
      }
      console.log('✅ Notificaciones iniciales creadas');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error configurando notificaciones:', error);
    process.exit(1);
  }
}

setupNotificaciones();
