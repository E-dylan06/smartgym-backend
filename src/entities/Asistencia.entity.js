export class AsistenciaEntity {
  constructor(data) {
    this.id_asistencia = data.id_asistencia;
    this.id_reserva = data.id_reserva;
    this.asistio = data.asistio;
    this.fecha_marcado = data.fecha_marcado;

    // Campos enriquecidos
    this.fecha_reserva = data.fecha_reserva;
    this.clase_nombre = data.clase_nombre;
    this.fecha = data.fecha;
    this.hora_inicio = data.hora_inicio;
    this.hora_fin = data.hora_fin;
    this.entrenador_nombre = data.entrenador_nombre;

    if (data.activo !== undefined) {
      this.activo = Buffer.isBuffer(data.activo) ? data.activo[0] === 1 : Boolean(data.activo);
    }
  }
}
