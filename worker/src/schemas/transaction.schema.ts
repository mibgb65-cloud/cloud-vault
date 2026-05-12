import { z } from 'zod'

const baseTransactionSchema = z.object({
  accountId: z.string().min(1),
  transferAccountId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('CNY'),
  occurredAt: z.string().datetime(),
  note: z.string().trim().max(300).nullable().optional(),
  merchantName: z.string().trim().max(120).nullable().optional(),
  tagIds: z.array(z.string().min(1)).max(20).default([])
})

export const createTransactionSchema = z
  .discriminatedUnion('type', [
    baseTransactionSchema.extend({
      type: z.literal('expense'),
      categoryId: z.string().min(1),
      transferAccountId: z.null().optional()
    }),
    baseTransactionSchema.extend({
      type: z.literal('income'),
      categoryId: z.string().min(1),
      transferAccountId: z.null().optional()
    }),
    baseTransactionSchema.extend({
      type: z.literal('transfer'),
      categoryId: z.null().optional(),
      transferAccountId: z.string().min(1)
    })
  ])
  .refine((value) => value.type !== 'transfer' || value.accountId !== value.transferAccountId, {
    message: 'transferAccountId must differ from accountId',
    path: ['transferAccountId']
  })

export const updateTransactionSchema = createTransactionSchema
