export class ReservaEntity {
  constructor(data) {
    this.id_reserva = data.id_reserva;
    this.id_usuario = data.id_usuario;
    this.id_horario = data.id_horario;
    this.fecha_reserva = data.fecha_reserva;
    this.monto_abonado = data.monto_abonado !== undefined ? Number(data.monto_abonado) : 0;
    this.estado = data.estado;

    // Campos enriquecidos
    if (data.fecha instanceof Date) {
      this.fecha = data.fecha.toISOString().split('T')[0];
    } else if (data.fecha) {
      this.fecha = String(data.fecha).substring(0, 10);
    } else {
      this.fecha = null;
    }
    this.hora_inicio = data.hora_inicio;
    this.hora_fin = data.hora_fin;
    this.id_clase = data.id_clase;
    this.clase_nombre = data.clase_nombre;
    this.clase_descripcion = data.clase_descripcion;
    this.duracion_minutos = data.duracion_minutos;
    this.entrenador_nombre = data.entrenador_nombre;
    this.entrenador_foto = data.entrenador_foto;
    this.entrenador_especialidad = data.entrenador_especialidad;
    this.id_asistencia = data.id_asistencia;
    this.asistio = data.asistio;
    this.asistencia_fecha = data.asistencia_fecha;
    this.id_reprogramacion = data.id_reprogramacion || null;
    this.reprogramacion_motivo = data.reprogramacion_motivo || null;
    this.fecha_reprogramacion = data.fecha_reprogramacion || null;

    if (data.activo !== undefined) {
      this.activo = Buffer.isBuffer(data.activo) ? data.activo[0] === 1 : Boolean(data.activo);
    }
  }
}
