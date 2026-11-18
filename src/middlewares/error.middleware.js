import multer from 'multer';

export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error capturado:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        message: 'El tamaño de la imagen no puede superar los 5MB',
      });
    }
    return res.status(400).json({
      ok: false,
      message: `Error al subir archivo: ${err.message}`,
    });
  }

  if (err.message && err.message.includes('Solo se permiten archivos de imagen')) {
    return res.status(400).json({
      ok: false,
      message: err.message,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
