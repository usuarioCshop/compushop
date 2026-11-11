const { z } = require('zod');

// Valida forma y existencia real en el calendario (rechaza 2026-02-30, 2026-13-01).
const isCalendarDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine(isCalendarDate, 'La fecha no existe en el calendario');

const optionalDate = z.union([dateString, z.literal('')]).optional().nullable();

const optionalEmail = z
  .union([z.string().trim().email('Email del cliente inválido').max(120), z.literal('')])
  .optional()
  .nullable();

// El select del frontend manda el tecnico como string o null.
const optionalAssignedTo = z.preprocess((value) => {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.union([z.number().int().positive(), z.null()]).optional());

// Los inputs numericos del frontend pueden llegar como string vacio.
const optionalMoney = z.preprocess((value) => {
  if (value === null || value === '' || value === undefined) return undefined;
  return Number(value);
}, z.number().min(0, 'El precio no puede ser negativo').optional());

const partSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  unit_price: optionalMoney,
});

const partsSchema = z
  .array(partSchema)
  .max(100, 'Máximo 100 repuestos por boleta')
  .refine(
    (parts) => new Set(parts.map((part) => part.product_id)).size === parts.length,
    'No se puede repetir el mismo repuesto en la boleta'
  );

const bodySchema = z.object({
  ticket_number: z.string().trim().max(30).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  client_name: z.string().trim().min(2, 'El nombre del cliente debe tener al menos 2 caracteres').max(120),
  client_address: z.string().trim().max(255).optional().nullable(),
  client_id: z.string().trim().max(50).optional().nullable(),
  client_email: optionalEmail,
  client_phone: z.string().trim().max(50).optional().nullable(),
  article: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  serial_number: z.string().trim().max(120).optional().nullable(),
  damage_reported: z.string().trim().min(3, 'El daño reportado debe tener al menos 3 caracteres').max(2000),
  notes: z.string().trim().max(2000).optional().nullable(),
  image_url: z.string().trim().max(500).optional().nullable(),
  probable_repair_date: optionalDate,
  assigned_to: optionalAssignedTo,
  diagnosis: z.string().trim().max(4000).optional().nullable(),
  labor_price: optionalMoney,
  parts: partsSchema.optional(),
});

const technicalRepairCreateSchema = z.object({ body: bodySchema });

const technicalRepairUpdateSchema = z.object({ body: bodySchema.partial() });

const technicalRepairIdSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const technicalRepairQuerySchema = z.object({
  query: z.object({
    status: z.string().trim().max(50).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    received_from: z.union([dateString, z.literal('')]).optional(),
    received_to: z.union([dateString, z.literal('')]).optional(),
    probable_from: z.union([dateString, z.literal('')]).optional(),
    probable_to: z.union([dateString, z.literal('')]).optional(),
    sort_by: z
      .enum([
        'ticket_number',
        'client_name',
        'article',
        'brand',
        'status',
        'received_at',
        'probable_repair_date',
        'assigned_to',
      ])
      .default('received_at'),
    sort_dir: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const technicalReportQuerySchema = z.object({
  query: z.object({
    group_by: z.enum(['status', 'client', 'equipment', 'part']).default('status'),
    received_from: z.union([dateString, z.literal('')]).optional(),
    received_to: z.union([dateString, z.literal('')]).optional(),
    status: z.string().trim().max(50).optional(),
    client: z.string().trim().max(120).optional(),
    article: z.string().trim().max(120).optional(),
    brand: z.string().trim().max(120).optional(),
    part: z.string().trim().max(120).optional(),
  }),
});

const technicalPartsCatalogQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
  }),
});

module.exports = {
  technicalRepairCreateSchema,
  technicalRepairUpdateSchema,
  technicalRepairIdSchema,
  technicalRepairQuerySchema,
  technicalReportQuerySchema,
  technicalPartsCatalogQuerySchema,
};
