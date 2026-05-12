import { z } from 'zod'

export const createInviteSchema = z
  .object({
    maxUses: z.number().int().positive().max(100).default(1),
    expiresAt: z.string().datetime().nullable().optional(),
    allowedEmail: z.string().email().nullable().optional(),
    inviteRole: z.enum(['admin', 'user']).default('user'),
    note: z.string().trim().max(200).nullable().optional()
  })
  .strict()

export const updateInviteSchema = z
  .object({
    status: z.enum(['active', 'disabled']).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    note: z.string().trim().max(200).nullable().optional()
  })
  .strict()

export const updateUserStatusSchema = z
  .object({
    disabled: z.boolean()
  })
  .strict()
