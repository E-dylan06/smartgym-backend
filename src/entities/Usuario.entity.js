export class UsuarioEntity {
  constructor(data) {
    this.id_usuario = data.id_usuario;
    this.nombre = data.nombre;
    this.dni = data.dni || null;
    this.correo = data.correo;
    this.telefono = data.telefono || null;
    this.foto_url = data.foto_url || null;
    this.id_rol = data.id_rol;
    this.rol = data.rol_nombre || data.rol;
    this.id_tipo_usuario = data.id_tipo_usuario;
    this.tipo_usuario = data.tipo_usuario_nombre || data.tipo_usuario;
    this.id_plan = data.id_plan || null;
    this.plan_nombre = data.plan_nombre || null;
    this.contacto_emergencia = data.contacto_emergencia || null;
    this.telefono_emergencia = data.telefono_emergencia || null;
    this.fecha_registro = data.fecha_registro;
    this.fecha_inicio_membresia = data.fecha_inicio_membresia;
    this.fecha_fin_membresia = data.fecha_fin_membresia;

    if (data.activo !== undefined) {
      this.activo = Buffer.isBuffer(data.activo) ? data.activo[0] === 1 : Boolean(data.activo);
    }
  }
}
