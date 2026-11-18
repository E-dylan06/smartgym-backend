import { pool } from '../config/db.js';

export class DashboardRepository {
  /**
   * Obtiene métricas clave (KPIs) para el dueño / administrador
   */
  async getKPIs() {
    // 1. Total socios y activos con membresía
    const [sociosTotalRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE id_rol = 3 AND activo = 1`
    );
    const totalSocios = sociosTotalRows[0]?.total || 0;

    const [sociosActivosRows] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM usuarios 
       WHERE id_rol = 3 
         AND activo = 1 
         AND fecha_fin_membresia >= CURDATE()`
    );
    const sociosActivos = sociosActivosRows[0]?.total || 0;
    const sociosInactivos = Math.max(0, totalSocios - sociosActivos);

    // 2. Ingresos proyectados de membresías activas vigentes
    const [ingresosRows] = await pool.query(
      `SELECT COALESCE(SUM(pm.precio), 0) AS total_ingresos
       FROM usuarios u
       INNER JOIN planes_membresia pm ON u.id_plan = pm.id_plan
       WHERE u.id_rol = 3 
         AND u.activo = 1 
         AND u.fecha_fin_membresia >= CURDATE()`
    );
    const ingresosEstimados = parseFloat(ingresosRows[0]?.total_ingresos || 0);

    // 3. Reservas del mes actual
    const [reservasMesRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reservas
       WHERE activo = 1
         AND MONTH(fecha_reserva) = MONTH(CURDATE())
         AND YEAR(fecha_reserva) = YEAR(CURDATE())`
    );
    const reservasMes = reservasMesRows[0]?.total || 0;

    // 4. Reservas de hoy
    const [reservasHoyRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       WHERE r.activo = 1 
         AND r.estado = 'confirmada'
         AND DATE(h.fecha) = CURDATE()`
    );
    const reservasHoy = reservasHoyRows[0]?.total || 0;

    // 5. Tasa de asistencia histórica
    const [asistenciasRows] = await pool.query(
      `SELECT 
         COUNT(*) AS total_marcadas,
         COALESCE(SUM(CASE WHEN asistio = 'si' THEN 1 ELSE 0 END), 0) AS asistieron
       FROM asistencias
       WHERE activo = 1`
    );
    const totalMarcadas = asistenciasRows[0]?.total_marcadas || 0;
    const totalAsistieron = asistenciasRows[0]?.asistieron || 0;
    const tasaAsistencia = totalMarcadas > 0 
      ? Math.round((totalAsistieron / totalMarcadas) * 100) 
      : 0;

    return {
      totalSocios,
      sociosActivos,
      sociosInactivos,
      ingresosEstimados,
      reservasMes,
      reservasHoy,
      totalAsistieron,
      tasaAsistencia,
    };
  }

  /**
   * Obtiene el aforo y estado de ocupación de los próximos horarios programados
   */
  async getOcupacionHorarios(limite = 6) {
    const [rows] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
              h.capacidad_maxima, h.cupos_disponibles, h.estado,
              c.nombre AS clase_nombre,
              u.nombre AS entrenador_nombre,
              t.nombre AS turno
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       LEFT JOIN entrenadores e ON h.id_entrenador = e.id_entrenador
       LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
       LEFT JOIN turnos t ON h.id_turno = t.id_turno
       WHERE h.activo = 1
       ORDER BY h.fecha ASC, h.hora_inicio ASC
       LIMIT ?`,
      [limite]
    );

    return rows.map((h) => {
      const capacidad = h.capacidad_maxima || 0;
      const disponibles = h.cupos_disponibles || 0;
      const ocupados = Math.max(0, capacidad - disponibles);
      const porcentaje = capacidad > 0 ? Math.round((ocupados / capacidad) * 100) : 0;

      let nivelAforo = 'normal'; // < 70%
      if (porcentaje >= 100) {
        nivelAforo = 'lleno';
      } else if (porcentaje >= 70) {
        nivelAforo = 'alto';
      }

      return {
        ...h,
        cupos_ocupados: ocupados,
        porcentaje_ocupacion: porcentaje,
        nivel_aforo: nivelAforo,
      };
    });
  }

  /**
   * Clases más populares según el número de reservas
   */
  async getTopClases(limite = 5) {
    const [rows] = await pool.query(
      `SELECT c.id_clase, c.nombre, c.duracion_minutos, c.precio_sesion,
              COUNT(r.id_reserva) AS total_reservas
       FROM clases c
       LEFT JOIN horarios h ON c.id_clase = h.id_clase
       LEFT JOIN reservas r ON h.id_horario = r.id_horario AND r.activo = 1 AND r.estado = 'confirmada'
       WHERE c.activo = 1
       GROUP BY c.id_clase, c.nombre, c.duracion_minutos, c.precio_sesion
       ORDER BY total_reservas DESC
       LIMIT ?`,
      [limite]
    );

    return rows;
  }

  /**
   * Alertas administrativas: membresías próximas a vencer en 7 días y clases llenas
   */
  async getAlertas() {
    // Membresías por vencer en los próximos 7 días
    const [porVencer] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.telefono,
              u.fecha_fin_membresia,
              DATEDIFF(u.fecha_fin_membresia, CURDATE()) AS dias_restantes,
              pm.nombre AS plan_nombre
       FROM usuarios u
       LEFT JOIN planes_membresia pm ON u.id_plan = pm.id_plan
       WHERE u.id_rol = 3
         AND u.activo = 1
         AND u.fecha_fin_membresia BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY u.fecha_fin_membresia ASC
       LIMIT 10`
    );

    // Horarios llenos (0 cupos)
    const [horariosLlenos] = await pool.query(
      `SELECT h.id_horario, h.fecha, h.hora_inicio, c.nombre AS clase_nombre,
              h.capacidad_maxima
       FROM horarios h
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE h.activo = 1
         AND h.cupos_disponibles = 0
         AND h.fecha >= CURDATE()
       ORDER BY h.fecha ASC
       LIMIT 5`
    );

    return {
      membresiasPorVencer: porVencer,
      clasesLlenas: horariosLlenos,
    };
  }

  /**
   * Distribución de usuarios registrados por rol
   */
  async getDistribucionRoles() {
    const [rows] = await pool.query(
      `SELECT r.id_rol, r.nombre AS rol, COUNT(u.id_usuario) AS total
       FROM roles r
       LEFT JOIN usuarios u ON r.id_rol = u.id_rol AND u.activo = 1
       GROUP BY r.id_rol, r.nombre`
    );
    return rows;
  }
}

export const dashboardRepository = new DashboardRepository();
