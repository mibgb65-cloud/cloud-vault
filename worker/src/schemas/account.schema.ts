import { z } from 'zod'

export const accountTypeSchema = z.enum(['cash', 'debit_card', 'credit_card', 'ewallet', 'savings', 'investment', 'other'])

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: accountTypeSchema,
    currency: z.string().min(3).max(3).default('CNY'),
    openingBalance: z.number().int().default(0),
    icon: z.string().trim().max(40).nullable().optional(),
    color: z.string().trim().max(24).nullable().optional(),
    includeInAssets: z.boolean().default(true),
    creditLimit: z.number().int().nullable().optional(),
    statementDay: z.number().int().min(1).max(31).nullable().optional(),
    repaymentDay: z.number().int().min(1).max(31).nullable().optional()
  })
  .strict()

export const updateAccountSchema = createAccountSchema.partial()
