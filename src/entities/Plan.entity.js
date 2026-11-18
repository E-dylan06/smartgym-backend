export class PlanEntity {
  constructor({ id_plan, nombre, descripcion, precio, duracion_dias, activo }) {
    this.id_plan = id_plan;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = Number(precio);
    this.duracion_dias = duracion_dias;
    this.activo = Buffer.isBuffer(activo) ? activo[0] === 1 : Boolean(activo);
  }
}
