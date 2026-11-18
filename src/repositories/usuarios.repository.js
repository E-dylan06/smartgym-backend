import { pool } from '../config/db.js';
import { UsuarioEntity } from '../entities/Usuario.entity.js';

export class UsuariosRepository {
  async findByEmail(correo) {
    const [rows] = await pool.query(
      'SELECT id_usuario, correo, nombre, contrasenia, activo FROM usuarios WHERE correo = ?',
      [correo]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async findByDni(dni) {
    const [rows] = await pool.query(
      'SELECT id_usuario, dni FROM usuarios WHERE dni = ?',
      [dni]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async findByLogin(login) {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.dni, u.correo, u.contrasenia, u.telefono, u.foto_url,
              u.id_rol, r.nombre AS rol_nombre,
              u.id_tipo_usuario, tu.nombre AS tipo_usuario_nombre,
              u.id_plan, pm.nombre AS plan_nombre, pm.precio AS plan_precio,
              u.fecha_inicio_membresia, u.fecha_fin_membresia,
              u.contacto_emergencia, u.telefono_emergencia,
              u.activo
       FROM usuarios u
       LEFT JOIN roles r ON u.id_rol = r.id_rol
       LEFT JOIN tipos_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario
       LEFT JOIN planes_membresia pm ON u.id_plan = pm.id_plan
       WHERE u.correo = ? OR u.dni = ?`,
      [login, login]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.dni, u.correo, u.telefono, u.foto_url,
              u.id_rol, r.nombre AS rol,
              u.id_tipo_usuario, tu.nombre AS tipo_usuario,
              u.id_plan, pm.nombre AS plan_nombre, pm.descripcion AS plan_descripcion,
              pm.precio AS plan_precio, pm.duracion_dias,
              u.costo_plan_pagado,
              u.fecha_inicio_membresia, u.fecha_fin_membresia,
              u.contacto_emergencia, u.telefono_emergencia,
              u.fecha_registro, u.activo
       FROM usuarios u
       LEFT JOIN roles r ON u.id_rol = r.id_rol
       LEFT JOIN tipos_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario
       LEFT JOIN planes_membresia pm ON u.id_plan = pm.id_plan
       WHERE u.id_usuario = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    return new UsuarioEntity(rows[0]);
  }

  async getPasswordById(id) {
    const [rows] = await pool.query(
      'SELECT contrasenia FROM usuarios WHERE id_usuario = ?',
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0].contrasenia;
  }

  async getFotoUrlById(id) {
    const [rows] = await pool.query(
      'SELECT foto_url FROM usuarios WHERE id_usuario = ?',
      [id]
    );
    if (rows.length === 0) return null;
    return rows[0].foto_url;
  }

  async create({ nombre, dni, correo, contrasenia, telefono, id_rol, id_tipo_usuario, contacto_emergencia, telefono_emergencia }) {
    const [result] = await pool.query(
      `INSERT INTO usuarios (
        nombre, dni, correo, contrasenia, telefono,
        id_rol, id_tipo_usuario,
        contacto_emergencia, telefono_emergencia,
        fecha_registro, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(2), 1)`,
      [
        nombre,
        dni || null,
        correo,
        contrasenia,
        telefono || null,
        id_rol,
        id_tipo_usuario,
        contacto_emergencia || null,
        telefono_emergencia || null,
      ]
    );
    return result.insertId;
  }

  async updatePassword(id, hashedPassword) {
    await pool.query('UPDATE usuarios SET contrasenia = ? WHERE id_usuario = ?', [hashedPassword, id]);
  }

  async updateFotoUrl(id, fotoUrl) {
    await pool.query('UPDATE usuarios SET foto_url = ? WHERE id_usuario = ?', [fotoUrl, id]);
  }

  async updateProfile(id, fields) {
    const fieldsToUpdate = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fieldsToUpdate.length === 0) return;

    values.push(id);
    const query = `UPDATE usuarios SET ${fieldsToUpdate.join(', ')} WHERE id_usuario = ?`;
    await pool.query(query, values);
  }

  async getStatsReservas(id) {
    const [rows] = await pool.query(
      `SELECT 
        COUNT(*) AS total_reservas,
        SUM(CASE WHEN estado = 'confirmada' THEN 1 ELSE 0 END) AS reservas_confirmadas,
        SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS reservas_canceladas,
        SUM(CASE WHEN estado = 'finalizada' THEN 1 ELSE 0 END) AS reservas_finalizadas
       FROM reservas
       WHERE id_usuario = ?`,
      [id]
    );
    return rows[0];
  }

  async getStatsAsistencias(id) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total_asistencias
       FROM asistencias a
       INNER JOIN reservas r ON a.id_reserva = r.id_reserva
       WHERE r.id_usuario = ? AND a.asistio = 'si'`,
      [id]
    );
    return rows[0]?.total_asistencias || 0;
  }

  async findAll({ rol, busqueda } = {}) {
    let query = `
      SELECT u.id_usuario, u.nombre, u.dni, u.correo, u.telefono, u.foto_url,
             u.id_rol, r.nombre AS rol_nombre,
             u.id_tipo_usuario, tu.nombre AS tipo_usuario_nombre,
             u.id_plan, pm.nombre AS plan_nombre,
             u.fecha_inicio_membresia, u.fecha_fin_membresia,
             u.fecha_registro, u.activo,
             e.id_entrenador, esp.nombre AS especialidad_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN tipos_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario
      LEFT JOIN planes_membresia pm ON u.id_plan = pm.id_plan
      LEFT JOIN entrenadores e ON u.id_usuario = e.id_usuario AND e.activo = 1
      LEFT JOIN especialidades esp ON e.id_especialidad = esp.id_especialidad
      WHERE 1 = 1
    `;

    const params = [];

    if (rol) {
      query += ' AND r.nombre = ?';
      params.push(rol.toLowerCase());
    }

    if (busqueda) {
      query += ' AND (u.nombre LIKE ? OR u.correo LIKE ? OR u.dni LIKE ?)';
      const term = `%${busqueda}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY u.fecha_registro DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  async updateRol(id_usuario, id_rol) {
    await pool.query('UPDATE usuarios SET id_rol = ? WHERE id_usuario = ?', [id_rol, id_usuario]);
  }

  async updateEstadoActivo(id_usuario, activo) {
    await pool.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, id_usuario]);
  }

  async getMetricasEntrenamiento(id) {
    const [asistencias] = await pool.query(
      `SELECT a.id_asistencia, a.fecha_marcado, h.fecha, h.hora_inicio, c.nombre AS clase_nombre, c.duracion_minutos
       FROM asistencias a
       INNER JOIN reservas r ON a.id_reserva = r.id_reserva
       INNER JOIN horarios h ON r.id_horario = h.id_horario
       INNER JOIN clases c ON h.id_clase = c.id_clase
       WHERE r.id_usuario = ? AND a.asistio = 'si'
       ORDER BY h.fecha DESC, h.hora_inicio DESC`,
      [id]
    );

    const totalAsistencias = asistencias.length;

    // Asistencias del mes actual
    const mesActualStr = new Date().toISOString().substring(0, 7);
    const asistenciasMes = asistencias.filter(a => {
      const f = a.fecha instanceof Date ? a.fecha.toISOString().substring(0, 7) : String(a.fecha).substring(0, 7);
      return f === mesActualStr;
    }).length;

    // Minutos totales entrenados
    const minutosTotales = asistencias.reduce((acc, curr) => acc + (Number(curr.duracion_minutos) || 60), 0);
    const horasTotales = Number((minutosTotales / 60).toFixed(1));

    // Disciplina favorita
    const conteoDisciplinas = {};
    asistencias.forEach(a => {
      conteoDisciplinas[a.clase_nombre] = (conteoDisciplinas[a.clase_nombre] || 0) + 1;
    });
    let disciplinaFavorita = 'Ninguna aún';
    let maxConteo = 0;
    for (const [disc, cant] of Object.entries(conteoDisciplinas)) {
      if (cant > maxConteo) {
        maxConteo = cant;
        disciplinaFavorita = disc;
      }
    }

    // Cálculo de Racha
    const fechasUnicas = Array.from(new Set(asistencias.map(a => {
      return a.fecha instanceof Date ? a.fecha.toISOString().substring(0, 10) : String(a.fecha).substring(0, 10);
    }))).sort((a, b) => b.localeCompare(a));

    let rachaDias = 0;
    if (fechasUnicas.length > 0) {
      rachaDias = 1;
      for (let i = 0; i < fechasUnicas.length - 1; i++) {
        const d1 = new Date(fechasUnicas[i]);
        const d2 = new Date(fechasUnicas[i + 1]);
        const diffDias = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
        if (diffDias <= 4) {
          rachaDias++;
        } else {
          break;
        }
      }
    }

    const ultima = asistencias.length > 0 ? {
      clase: asistencias[0].clase_nombre,
      fecha: asistencias[0].fecha instanceof Date ? asistencias[0].fecha.toISOString().substring(0, 10) : String(asistencias[0].fecha).substring(0, 10),
      hora: asistencias[0].hora_inicio?.substring(0, 5)
    } : null;

    return {
      total_asistencias: totalAsistencias,
      asistencias_mes: asistenciasMes,
      minutos_totales: minutosTotales,
      horas_totales: horasTotales,
      disciplina_favorita: disciplinaFavorita,
      conteo_favorita: maxConteo,
      racha_dias: rachaDias,
      ultima_asistencia: ultima
    };
  }

  async getMetricasCorporales(id) {
    const [rows] = await pool.query(
      `SELECT id_metrica, peso_kg, altura_cm, objetivo, nivel_actividad, fecha_registro
       FROM metricas_corporales
       WHERE id_usuario = ?
       ORDER BY fecha_registro DESC`,
      [id]
    );

    if (rows.length === 0) {
      return {
        actual: null,
        historial: [],
      };
    }

    const actualRow = rows[0];
    const peso = Number(actualRow.peso_kg);
    const altura = Number(actualRow.altura_cm);
    const alturaM = altura / 100;
    const imc = alturaM > 0 ? Number((peso / (alturaM * alturaM)).toFixed(1)) : 0;

    let clasificacionImc = 'Normal';
    let colorImc = '#10B981';
    if (imc < 18.5) {
      clasificacionImc = 'Bajo peso';
      colorImc = '#60A5FA';
    } else if (imc >= 18.5 && imc <= 24.9) {
      clasificacionImc = 'Peso saludable';
      colorImc = '#10B981';
    } else if (imc >= 25.0 && imc <= 29.9) {
      clasificacionImc = 'Sobrepeso';
      colorImc = '#F59E0B';
    } else {
      clasificacionImc = 'Obesidad';
      colorImc = '#EF4444';
    }

    return {
      actual: {
        id_metrica: actualRow.id_metrica,
        peso_kg: peso,
        altura_cm: altura,
        imc,
        clasificacion_imc: clasificacionImc,
        color_imc: colorImc,
        objetivo: actualRow.objetivo,
        nivel_actividad: actualRow.nivel_actividad,
        fecha_registro: actualRow.fecha_registro,
      },
      historial: rows.map(r => ({
        id_metrica: r.id_metrica,
        peso_kg: Number(r.peso_kg),
        altura_cm: Number(r.altura_cm),
        fecha_registro: r.fecha_registro,
        objetivo: r.objetivo,
      })),
    };
  }

  async registrarMetricaCorporal(id, { peso_kg, altura_cm, objetivo, nivel_actividad }) {
    const [res] = await pool.query(
      `INSERT INTO metricas_corporales (id_usuario, peso_kg, altura_cm, objetivo, nivel_actividad, fecha_registro)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, peso_kg, altura_cm, objetivo || 'Mantenimiento y Salud', nivel_actividad || 'Moderado']
    );
    return res.insertId;
  }
}

export const usuariosRepository = new UsuariosRepository();
