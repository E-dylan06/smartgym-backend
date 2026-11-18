import { planesRepository } from '../repositories/planes.repository.js';

export class PlanesService {
  constructor(repository = planesRepository) {
    this.repository = repository;
  }

  async listarPlanesActivos() {
    const planes = await this.repository.findAllActivos();
    return {
      total: planes.length,
      planes,
    };
  }
}

export const planesService = new PlanesService();
