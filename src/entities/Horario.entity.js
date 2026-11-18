export class HorarioEntity {
  constructor(data) {
    this.id_horario = data.id_horario;
    if (data.fecha instanceof Date) {
      this.fecha = data.fecha.toISOString().split('T')[0];
    } else if (data.fecha) {
      this.fecha = String(data.fecha).substring(0, 10);
    } else {
      this.fecha = null;
    }
    this.hora_inicio = data.hora_inicio;
    this.hora_fin = data.hora_fin;
    this.capacidad_maxima = Number(data.capacidad_maxima);
    this.cupos_disponibles = Number(data.cupos_disponibles);
    this.estado = data.estado;

    // Relaciones opcionales enriquecidas
    this.id_clase = data.id_clase;
    this.clase_nombre = data.clase_nombre;
    this.clase_descripcion = data.clase_descripcion;
    this.duracion_minutos = data.duracion_minutos ? Number(data.duracion_minutos) : undefined;
    this.precio_sesion = data.precio_sesion !== undefined ? Number(data.precio_sesion) : undefined;
    this.tipo_clase_nombre = data.tipo_clase_nombre;

    this.id_entrenador = data.id_entrenador;
    this.entrenador_nombre = data.entrenador_nombre;
    this.entrenador_foto = data.entrenador_foto;
    this.especialidad_nombre = data.especialidad_nombre || data.entrenador_especialidad;

    this.id_turno = data.id_turno;
    this.turno_nombre = data.turno_nombre;

    if (data.activo !== undefined) {
      this.activo = Buffer.isBuffer(data.activo) ? data.activo[0] === 1 : Boolean(data.activo);
    }
  }
}
