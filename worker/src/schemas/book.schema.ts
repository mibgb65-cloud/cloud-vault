import { z } from 'zod'

export const createBookSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    defaultCurrency: z.string().min(3).max(3).default('CNY'),
    icon: z.string().trim().max(40).nullable().optional()
  })
  .strict()

export const updateBookSchema = createBookSchema.partial()
