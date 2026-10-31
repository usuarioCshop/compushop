const { z } = require('zod');

const contactSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().optional(),
    subject: z.string().optional(),
    message: z.string().min(5, 'El mensaje debe tener al menos 5 caracteres'),
  }),
});

module.exports = { contactSchema };
