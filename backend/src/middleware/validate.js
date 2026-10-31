const { ZodError } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          campo: e.path.join('.'),
          mensaje: e.message,
        }));
        return res.status(400).json({ error: 'Datos inválidos', detalles: issues });
      }
      next(error);
    }
  };
}

module.exports = validate;
