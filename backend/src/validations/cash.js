const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

const paymentMethodIngreso = z.enum(['efectivo', 'transferencia', 'cuenta_corriente']);
const paymentMethodEgreso = z.enum(['efectivo', 'transferencia', 'otro']);

const openSessionSchema = z.object({
  body: z.object({
    session_date: dateString.optional(),
    opening_balance: z.coerce.number().min(0, 'El saldo inicial no puede ser negativo').default(0),
    notes: z.string().trim().max(1000).optional().nullable(),
  }),
});

const closeSessionSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    counted_cash: z.coerce.number().min(0, 'El arqueo no puede ser negativo'),
    notes: z.string().trim().max(1000).optional().nullable(),
  }),
});

const sessionIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
});

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  }),
});

const updateCategorySchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    is_active: z.boolean().optional(),
  }).refine((v) => v.name !== undefined || v.is_active !== undefined, { message: 'Nada para actualizar' }),
});

const createMovementSchema = z.object({
  body: z.object({
    movement_type: z.enum(['ingreso', 'egreso']),
    movement_date: dateString.optional(),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    description: z.string().trim().min(1, 'El concepto es obligatorio').max(500),
    payment_method: z.string().trim().min(1),
    category_id: z.coerce.number().int().positive().optional().nullable(),
    reference: z.string().trim().max(120).optional().nullable(),
    counterparty: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  }),
});

const updateExpenseSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    movement_date: dateString.optional(),
    amount: z.coerce.number().positive().optional(),
    description: z.string().trim().min(1).max(500).optional(),
    payment_method: paymentMethodEgreso.optional(),
    category_id: z.coerce.number().int().positive().optional().nullable(),
    reference: z.string().trim().max(120).optional().nullable(),
    counterparty: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  }).refine((v) => Object.keys(v).length > 0, { message: 'Nada para actualizar' }),
});

const movementIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
});

const voidMovementSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    reason: z.string().trim().max(500).optional().nullable(),
  }).optional(),
});

const confirmMovementSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    accredited_at: z.string().optional().nullable(), // fecha/hora o date
  }).optional(),
});

module.exports = {
  openSessionSchema,
  closeSessionSchema,
  sessionIdSchema,
  createCategorySchema,
  updateCategorySchema,
  createMovementSchema,
  updateExpenseSchema,
  movementIdSchema,
  voidMovementSchema,
  confirmMovementSchema,
  paymentMethodIngreso,
  paymentMethodEgreso,
};
