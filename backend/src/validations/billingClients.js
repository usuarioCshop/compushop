const { z } = require('zod');

const billingClientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    doc_type: z.string().trim().max(30).optional().nullable(),
    doc_number: z.string().trim().max(50).optional().nullable(),
    condicion_iva: z.string().trim().max(80).optional().nullable(),
    address: z.string().trim().max(255).optional().nullable(),
    email: z.string().trim().max(120).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    source_type: z.string().trim().max(30).optional().nullable(),
    source_id: z.coerce.number().int().positive().optional().nullable(),
  }),
});

const billingClientUpdateSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    doc_type: z.string().trim().max(30).optional().nullable(),
    doc_number: z.string().trim().max(50).optional().nullable(),
    condicion_iva: z.string().trim().max(80).optional().nullable(),
    address: z.string().trim().max(255).optional().nullable(),
    email: z.string().trim().max(120).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
  }),
});

module.exports = { billingClientSchema, billingClientUpdateSchema };
