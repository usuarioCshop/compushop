const { ZodError } = require('zod');

// Un schema puede venir como z.object({ body, query, params }) o como un objeto
// plano { body, query, params }. En el primer caso las partes viven en .shape.
function resolvePart(schema, key) {
  if (!schema) return null;
  if (schema.shape && schema.shape[key]) return schema.shape[key];
  if (schema[key]) return schema[key];
  return null;
}

// En Express 4 req.query es un getter del prototipo, asi que asignarlo no
// persiste. Definimos una propiedad propia para que el valor validado llegue
// al controlador.
function setQuery(req, value) {
  Object.defineProperty(req, 'query', {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

function validate(schema) {
  return (req, res, next) => {
    try {
      const bodySchema = resolvePart(schema, 'body');
      const querySchema = resolvePart(schema, 'query');
      const paramsSchema = resolvePart(schema, 'params');

      if (bodySchema) {
        req.body = bodySchema.parse(req.body);
      }
      if (querySchema) {
        setQuery(req, querySchema.parse(req.query));
      }
      if (paramsSchema) {
        req.params = paramsSchema.parse(req.params);
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
