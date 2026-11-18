import { dashboardRepository } from '../repositories/dashboard.repository.js';

export class DashboardService {
  constructor(repository = dashboardRepository) {
    this.repository = repository;
  }

  /**
   * Genera el resumen ejecutivo para el Dueño / Administrador del Gimnasio
   */
  async getAdminDashboard() {
    const [kpis, ocupacion, topClases, alertas, roles] = await Promise.all([
      this.repository.getKPIs(),
      this.repository.getOcupacionHorarios(6),
      this.repository.getTopClases(5),
      this.repository.getAlertas(),
      this.repository.getDistribucionRoles(),
    ]);

    return {
      kpis: {
        ...kpis,
        ingresosFormateados: `S/ ${kpis.ingresosEstimados.toFixed(2)}`,
        porcentajeSociosActivos: kpis.totalSocios > 0
          ? Math.round((kpis.sociosActivos / kpis.totalSocios) * 100)
          : 0,
      },
      aforoEnVivo: ocupacion,
      topClases,
      alertas: {
        totalAlertas: alertas.membresiasPorVencer.length + alertas.clasesLlenas.length,
        membresiasPorVencer: alertas.membresiasPorVencer,
        clasesLlenas: alertas.clasesLlenas,
      },
      distribucionRoles: roles,
      generadoEl: new Date().toISOString(),
    };
  }
}

export const dashboardService = new DashboardService();
