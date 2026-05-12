import { z } from 'zod'

export const parseTransactionTextSchema = z
  .object({
    text: z.string().trim().min(1).max(300),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currency: z.string().min(3).max(3).default('CNY')
  })
  .strict()

export const aiTransactionDraftSchema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accountName: z.string().nullable().optional(),
    categoryName: z.string().nullable().optional(),
    transferAccountName: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    merchantName: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).optional()
  })
  .strict()
