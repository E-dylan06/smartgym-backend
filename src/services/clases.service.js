import { clasesRepository } from '../repositories/clases.repository.js';

export class ClasesService {
  constructor(repository = clasesRepository) {
    this.repository = repository;
  }

  async listarClases() {
    const clases = await this.repository.findAllActivas();
    return {
      total: clases.length,
      clases,
    };
  }

  async obtenerDetalleClase(id) {
    const clase = await this.repository.findById(id);
    if (!clase) {
      const error = new Error('Clase no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const horarios = await this.repository.findHorariosByClaseId(id);

    return {
      clase,
      horarios,
    };
  }

  async listarTiposClase() {
    return await this.repository.findAllTipos();
  }

  async crearClase({ nombre, descripcion, id_tipo_clase, duracion_minutos, precio_sesion }) {
    if (!nombre || nombre.trim().length < 3) {
      const error = new Error('El nombre de la disciplina/clase debe tener al menos 3 caracteres');
      error.statusCode = 400;
      throw error;
    }

    const duracion = Number(duracion_minutos);
    if (!duracion || duracion < 15 || duracion > 180) {
      const error = new Error('La duración de la clase debe ser entre 15 y 180 minutos');
      error.statusCode = 400;
      throw error;
    }

    const newId = await this.repository.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : '',
      id_tipo_clase: id_tipo_clase || 1,
      duracion_minutos: duracion,
      precio_sesion: precio_sesion !== undefined ? Number(precio_sesion) : 0.0,
    });

    const creada = await this.repository.findById(newId);
    return creada;
  }

  async actualizarClase(id, data) {
    const clase = await this.repository.findById(id);
    if (!clase) {
      const error = new Error('Clase no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const fields = {};
    if (data.nombre !== undefined) {
      if (data.nombre.trim().length < 3) {
        const error = new Error('El nombre debe tener al menos 3 caracteres');
        error.statusCode = 400;
        throw error;
      }
      fields.nombre = data.nombre.trim();
    }
    if (data.descripcion !== undefined) fields.descripcion = data.descripcion.trim();
    if (data.id_tipo_clase !== undefined) fields.id_tipo_clase = Number(data.id_tipo_clase);
    if (data.duracion_minutos !== undefined) fields.duracion_minutos = Number(data.duracion_minutos);
    if (data.precio_sesion !== undefined) fields.precio_sesion = Number(data.precio_sesion);
    if (data.activo !== undefined) fields.activo = data.activo ? 1 : 0;

    await this.repository.update(id, fields);
    return await this.repository.findById(id);
  }

  async eliminarClase(id) {
    const clase = await this.repository.findById(id);
    if (!clase) {
      const error = new Error('Clase no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const tieneHorariosFuturos = await this.repository.hasUpcomingHorarios(id);
    if (tieneHorariosFuturos) {
      const error = new Error('No puedes desactivar esta disciplina porque tiene horarios futuros programados en el calendario');
      error.statusCode = 400;
      throw error;
    }

    await this.repository.delete(id);
    return { id_clase: Number(id), eliminado: true };
  }
}

export const clasesService = new ClasesService();
