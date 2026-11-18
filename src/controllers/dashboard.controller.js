import { dashboardService } from '../services/dashboard.service.js';

export const getAdminDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminDashboard();

    res.json({
      ok: true,
      message: 'Dashboard administrativo obtenido con éxito',
      data,
    });
  } catch (error) {
    next(error);
  }
};
