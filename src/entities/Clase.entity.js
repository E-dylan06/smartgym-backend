export class ClaseEntity {
  constructor({
    id_clase,
    nombre,
    descripcion,
    duracion_minutos,
    precio_sesion,
    id_tipo_clase,
    tipo_clase_nombre,
    tipo_clase_descripcion,
    activo,
  }) {
    this.id_clase = id_clase;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.duracion_minutos = duracion_minutos;
    this.precio_sesion = Number(precio_sesion);
    this.id_tipo_clase = id_tipo_clase;
    this.tipo_clase_nombre = tipo_clase_nombre;
    this.tipo_clase_descripcion = tipo_clase_descripcion;
    if (activo !== undefined) {
      this.activo = Buffer.isBuffer(activo) ? activo[0] === 1 : Boolean(activo);
    }
  }
}
