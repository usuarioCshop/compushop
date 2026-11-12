const { z } = require('zod');

const receiverSnapshotSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del receptor es obligatorio').max(200),
  doc_type: z.string().trim().max(30).optional().nullable(),
  doc_number: z.string().trim().max(50).optional().nullable(),
  condicion_iva: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
}).passthrough();

const itemSchema = z.object({
  source_type: z.enum(['product', 'repair', 'manual']),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  repair_id: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().trim().min(1, 'La descripción es obligatoria').max(500),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  vat_rate: z.coerce.number().min(0).max(100).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  metadata: z.any().optional().nullable(),
});

const invoiceCreateSchema = z.object({
  body: z.object({
    billing_client_id: z.coerce.number().int().positive().optional().nullable(),
    receiver_snapshot: receiverSnapshotSchema,
    notes: z.string().trim().max(2000).optional().nullable(),
    items: z.array(itemSchema).min(1, 'Debe incluir al menos un ítem'),
  }),
});

const invoiceUpdateSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    billing_client_id: z.coerce.number().int().positive().optional().nullable(),
    receiver_snapshot: receiverSnapshotSchema.optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    items: z.array(itemSchema).min(1).optional(),
  }),
});

const invoiceIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
});

const invoiceVoidSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    reason: z.string().trim().max(500).optional().nullable(),
  }).optional(),
});

module.exports = { invoiceCreateSchema, invoiceUpdateSchema, invoiceIdSchema, invoiceVoidSchema };
