import { planesService } from '../services/planes.service.js';

export const getAllPlanes = async (req, res, next) => {
  try {
    const result = await planesService.listarPlanesActivos();
    res.json({
      ok: true,
      total: result.total,
      data: {
        planes: result.planes,
      },
    });
  } catch (error) {
    next(error);
  }
};
