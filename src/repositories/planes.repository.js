import { pool } from '../config/db.js';
import { PlanEntity } from '../entities/Plan.entity.js';

export class PlanesRepository {
  async findAllActivos() {
    const [rows] = await pool.query(
      `SELECT id_plan, nombre, descripcion, precio, duracion_dias, activo
       FROM planes_membresia
       WHERE activo = 1
       ORDER BY precio ASC`
    );
    return rows.map((row) => new PlanEntity(row));
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT id_plan, nombre, descripcion, precio, duracion_dias, activo
       FROM planes_membresia
       WHERE id_plan = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    return new PlanEntity(rows[0]);
  }
}

export const planesRepository = new PlanesRepository();
