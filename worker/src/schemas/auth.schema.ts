import { z } from 'zod'

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    inviteCode: z.string().min(4).max(64),
    nickname: z.string().trim().min(1).max(40).optional()
  })
  .strict()

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(128)
  })
  .strict()

export const updateMeSchema = z
  .object({
    nickname: z.string().trim().min(1).max(40).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    defaultCurrency: z.string().min(3).max(3).optional(),
    locale: z.string().min(2).max(20).optional(),
    timezone: z.string().min(1).max(64).optional()
  })
  .strict()
