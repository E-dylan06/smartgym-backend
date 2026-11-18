import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { usuariosRepository } from '../repositories/usuarios.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preferencias de usuario en memoria (por id_usuario)
const userPreferences = new Map();

export class PerfilService {
  constructor(repository = usuariosRepository) {
    this.repository = repository;
  }

  async getPerfil(userId) {
    const perfil = await this.repository.findById(userId);
    if (!perfil) {
      const error = new Error('Perfil de usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    // Calcular estado de membresía
    let estadoMembresia = 'sin_membresia';
    let diasRestantes = 0;

    if (perfil.fecha_fin_membresia) {
      const now = new Date();
      const fin = new Date(perfil.fecha_fin_membresia);
      const diffMs = fin.getTime() - now.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      estadoMembresia = diasRestantes > 0 ? 'activa' : 'vencida';
    }

    // Estadísticas
    const statsReservas = await this.repository.getStatsReservas(userId);
    const totalAsistencias = await this.repository.getStatsAsistencias(userId);

    const preferencias = this.getPreferencias(userId);

    return {
      ...perfil,
      membresia: {
        id_plan: perfil.id_plan,
        nombre: perfil.plan_nombre || 'Sin membresía activa',
        estado: estadoMembresia,
        dias_restantes: Math.max(0, diasRestantes),
        fecha_inicio: perfil.fecha_inicio_membresia,
        fecha_fin: perfil.fecha_fin_membresia,
      },
      estadisticas: {
        total_reservas: statsReservas?.total_reservas || 0,
        reservas_confirmadas: statsReservas?.reservas_confirmadas || 0,
        reservas_canceladas: statsReservas?.reservas_canceladas || 0,
        asistencias_completadas: totalAsistencias || 0,
      },
      preferencias,
    };
  }

  async updatePerfil(userId, data) {
    const { nombre, telefono, contacto_emergencia, telefono_emergencia } = data;
    const fields = {};

    if (nombre !== undefined) fields.nombre = nombre;
    if (telefono !== undefined) fields.telefono = telefono;
    if (contacto_emergencia !== undefined) fields.contacto_emergencia = contacto_emergencia;
    if (telefono_emergencia !== undefined) fields.telefono_emergencia = telefono_emergencia;

    if (Object.keys(fields).length === 0) {
      const error = new Error('No se enviaron campos válidos para actualizar');
      error.statusCode = 400;
      throw error;
    }

    await this.repository.updateProfile(userId, fields);

    const updatedUser = await this.repository.findById(userId);
    return updatedUser;
  }

  async uploadFoto(userId, file) {
    if (!file) {
      const error = new Error('Debes seleccionar un archivo de imagen válido');
      error.statusCode = 400;
      throw error;
    }

    const fotoUrl = `/uploads/profiles/${file.filename}`;

    const oldFotoUrl = await this.repository.getFotoUrlById(userId);
    if (oldFotoUrl) {
      const oldPath = path.join(__dirname, '../..', oldFotoUrl);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // Si falla borrado local, ignorar
        }
      }
    }

    await this.repository.updateFotoUrl(userId, fotoUrl);

    return {
      foto_url: fotoUrl,
      filename: file.filename,
    };
  }

  getPreferencias(userId) {
    return userPreferences.get(userId) || {
      tema: 'dark',
      notificaciones_activas: true,
      recordatorio_24h: true,
      recordatorio_1h: true,
      idioma: 'es',
    };
  }

  updatePreferencias(userId, prefs) {
    const current = this.getPreferencias(userId);
    const updated = {
      ...current,
      ...prefs,
    };
    userPreferences.set(userId, updated);
    return updated;
  }

  async getMetricas(userId) {
    const entrenamiento = await this.repository.getMetricasEntrenamiento(userId);
    const corporales = await this.repository.getMetricasCorporales(userId);

    return {
      entrenamiento,
      corporales,
    };
  }

  async registrarMetricaCorporal(userId, { peso_kg, altura_cm, objetivo, nivel_actividad }) {
    const pesoNum = Number(peso_kg);
    const alturaNum = Number(altura_cm);

    if (!pesoNum || pesoNum <= 20 || pesoNum >= 350) {
      const error = new Error('El peso ingresado debe ser un valor válido en kg (entre 20 y 350)');
      error.statusCode = 400;
      throw error;
    }

    if (!alturaNum || alturaNum <= 50 || alturaNum >= 260) {
      const error = new Error('La altura ingresada debe ser un valor válido en cm (entre 50 y 260)');
      error.statusCode = 400;
      throw error;
    }

    const insertId = await this.repository.registrarMetricaCorporal(userId, {
      peso_kg: pesoNum,
      altura_cm: alturaNum,
      objetivo,
      nivel_actividad,
    });

    const metricasActualizadas = await this.repository.getMetricasCorporales(userId);
    return {
      id_metrica: insertId,
      ...metricasActualizadas,
    };
  }
}

export const perfilService = new PerfilService();
