import { asistenciasRepository } from '../repositories/asistencias.repository.js';
import { pool } from '../config/db.js';

export class AsistenciasService {
  constructor(repository = asistenciasRepository) {
    this.repository = repository;
  }

  async marcarAsistencia({ id_reserva, asistio }) {
    if (!id_reserva || !asistio || !['si', 'no'].includes(asistio.toLowerCase())) {
      const error = new Error("Debes enviar 'id_reserva' y 'asistio' ('si' o 'no')");
      error.statusCode = 400;
      throw error;
    }

    const valorAsistio = asistio.toLowerCase();

    // Comprobar existencia de la reserva
    const [reserva] = await pool.query(
      'SELECT id_reserva, estado FROM reservas WHERE id_reserva = ? AND activo = 1',
      [id_reserva]
    );

    if (reserva.length === 0) {
      const error = new Error('Reserva no encontrada');
      error.statusCode = 404;
      throw error;
    }

    await this.repository.saveMarcado(id_reserva, valorAsistio);

    return {
      id_reserva,
      asistio: valorAsistio,
    };
  }

  async getMisAsistencias(userId) {
    const asistencias = await this.repository.findByUserId(userId);
    return {
      total: asistencias.length,
      asistencias,
    };
  }
}

export const asistenciasService = new AsistenciasService();
