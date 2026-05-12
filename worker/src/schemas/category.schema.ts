import { z } from 'zod'

export const createCategorySchema = z
  .object({
    parentId: z.string().nullable().optional(),
    name: z.string().trim().min(1).max(60),
    type: z.enum(['income', 'expense']),
    icon: z.string().trim().min(1).max(40),
    color: z.string().trim().max(24).nullable().optional(),
    sortOrder: z.number().int().optional()
  })
  .strict()

export const updateCategorySchema = createCategorySchema.partial()
