import { clasesService } from '../services/clases.service.js';

export const getAllClases = async (req, res, next) => {
  try {
    const result = await clasesService.listarClases();
    res.json({
      ok: true,
      total: result.total,
      data: {
        clases: result.clases,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getClaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await clasesService.obtenerDetalleClase(id);
    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getTiposClase = async (req, res, next) => {
  try {
    const tipos = await clasesService.listarTiposClase();
    res.json({
      ok: true,
      total: tipos.length,
      data: tipos,
    });
  } catch (error) {
    next(error);
  }
};

export const crearClase = async (req, res, next) => {
  try {
    const nueva = await clasesService.crearClase(req.body);
    res.status(201).json({
      ok: true,
      message: 'Disciplina creada y registrada en el catálogo exitosamente',
      data: nueva,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const actualizarClase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actualizada = await clasesService.actualizarClase(id, req.body);
    res.json({
      ok: true,
      message: 'Disciplina actualizada exitosamente',
      data: actualizada,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const eliminarClase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resultado = await clasesService.eliminarClase(id);
    res.json({
      ok: true,
      message: 'Disciplina desactivada del catálogo exitosamente',
      data: resultado,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
      });
    }
    next(error);
  }
};
