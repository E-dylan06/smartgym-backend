export const authorizeRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'No autenticado',
      });
    }

    const rolUsuario = req.user.rol?.toLowerCase();
    const rolesNormalizados = rolesPermitidos.map((r) => r.toLowerCase());

    if (!rolesNormalizados.includes(rolUsuario)) {
      return res.status(403).json({
        ok: false,
        message: `Acceso denegado: Se requiere rol [${rolesPermitidos.join(', ')}]`,
      });
    }

    next();
  };
};

export const requireRole = authorizeRoles;

