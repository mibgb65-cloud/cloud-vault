import { z } from 'zod'

const budgetFields = {
  name: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1).nullable().optional(),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('CNY'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  alertThreshold: z.number().int().min(1).max(100).default(80)
}

export const createBudgetSchema = z.object(budgetFields).strict().refine((value) => value.periodStart <= value.periodEnd, {
  message: 'periodStart must be before or equal to periodEnd',
  path: ['periodEnd']
})

export const updateBudgetSchema = z
  .object(budgetFields)
  .partial()
  .strict()
  .refine((value) => !value.periodStart || !value.periodEnd || value.periodStart <= value.periodEnd, {
    message: 'periodStart must be before or equal to periodEnd',
    path: ['periodEnd']
  })
