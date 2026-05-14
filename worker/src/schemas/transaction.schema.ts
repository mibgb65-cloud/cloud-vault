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
const sourceRefSchema = z.string().trim().min(1).max(200)

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

export const batchTransactionIdsSchema = z
  .object({
    transactionIds: z.array(z.string().min(1)).min(1).max(100)
  })
  .strict()

export const batchCategorySchema = z
  .object({
    transactionIds: z.array(z.string().min(1)).min(1).max(100),
    categoryId: z.string().min(1)
  })
  .strict()

const importTransactionSchema = z
  .discriminatedUnion('type', [
    baseTransactionSchema.extend({
      type: z.literal('expense'),
      categoryId: z.string().min(1),
      transferAccountId: z.null().optional(),
      sourceRef: sourceRefSchema
    }),
    baseTransactionSchema.extend({
      type: z.literal('income'),
      categoryId: z.string().min(1),
      transferAccountId: z.null().optional(),
      sourceRef: sourceRefSchema
    }),
    baseTransactionSchema.extend({
      type: z.literal('transfer'),
      categoryId: z.null().optional(),
      transferAccountId: z.string().min(1),
      sourceRef: sourceRefSchema
    })
  ])
  .refine((value) => value.type !== 'transfer' || value.accountId !== value.transferAccountId, {
    message: 'transferAccountId must differ from accountId',
    path: ['transferAccountId']
  })

export const importTransactionsSchema = z
  .object({
    items: z.array(importTransactionSchema).min(1).max(50)
  })
  .strict()
