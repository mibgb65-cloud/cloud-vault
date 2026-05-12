import { z } from 'zod'

export const createTagSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: z.string().trim().max(24).nullable().optional()
  })
  .strict()

export const updateTagSchema = createTagSchema.partial()
