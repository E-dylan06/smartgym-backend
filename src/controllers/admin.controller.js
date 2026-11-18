import { adminService } from '../services/admin.service.js';

export const getUsuarios = async (req, res, next) => {
  try {
    const { rol, busqueda } = req.query;
    const result = await adminService.listarUsuarios({ rol, busqueda });
    res.json({
      ok: true,
      total: result.total,
      data: {
        usuarios: result.usuarios,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateRolUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.cambiarRolUsuario(id, req.body);
    res.json({
      ok: true,
      message: result.mensaje,
      data: result,
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

export const updateEstadoUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.cambiarEstadoUsuario(id, req.body);
    res.json({
      ok: true,
      message: result.mensaje,
      data: result,
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

export const getEntrenadores = async (req, res, next) => {
  try {
    const result = await adminService.listarEntrenadoresActivos();
    res.json({
      ok: true,
      total: result.total,
      data: {
        entrenadores: result.entrenadores,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReporteAsistencias = async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta, id_clase } = req.query;
    const data = await adminService.generarReporteAsistencias({ fecha_desde, fecha_hasta, id_clase });
    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getReporteHorasEntrenadores = async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const data = await adminService.generarReporteHorasEntrenadores({ fecha_desde, fecha_hasta });
    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBloqueos = async (req, res, next) => {
  try {
    const data = await adminService.listarBloqueos();
    res.json({
      ok: true,
      total: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createBloqueo = async (req, res, next) => {
  try {
    const result = await adminService.crearBloqueo(req.user, req.body);
    res.status(201).json({
      ok: true,
      message: result.mensaje,
      data: result,
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

export const deleteBloqueo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.eliminarBloqueo(id);
    res.json({
      ok: true,
      message: 'Bloqueo / feriado eliminado exitosamente',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
