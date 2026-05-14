import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { changePasswordSchema, updateMeSchema } from '../schemas/auth.schema'
import { HttpError } from '../utils/http-error'
import { nowIso } from '../utils/date'
import { hashPassword, verifyPassword } from '../utils/password'
import { toUser } from '../utils/mapper'
import { ok } from '../utils/response'

export const meRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

meRoutes.get('/', (c) => ok(c, { user: c.get('currentUser') }))

meRoutes.patch('/', async (c) => {
  const input = updateMeSchema.parse(await c.req.json())
  const user = c.get('currentUser')
  const next = {
    nickname: input.nickname ?? user.nickname,
    avatarUrl: input.avatarUrl === undefined ? user.avatarUrl ?? null : input.avatarUrl,
    defaultCurrency: input.defaultCurrency ?? user.defaultCurrency,
    locale: input.locale ?? user.locale,
    timezone: input.timezone ?? user.timezone
  }
  const now = nowIso()

  await c.env.DB.prepare(
    `UPDATE users
     SET nickname = ?, avatar_url = ?, default_currency = ?, locale = ?, timezone = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(next.nickname, next.avatarUrl, next.defaultCurrency, next.locale, next.timezone, now, user.id)
    .run()

  const row = await c.env.DB.prepare(
    `SELECT id, email, nickname, avatar_url, default_currency, locale, timezone, system_role, created_at, updated_at, last_login_at
     FROM users WHERE id = ?`
  )
    .bind(user.id)
    .first<Record<string, unknown>>()

  return ok(c, { user: toUser(row!) })
})

meRoutes.patch('/password', async (c) => {
  const input = changePasswordSchema.parse(await c.req.json())
  const user = c.get('currentUser')
  const row = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(user.id)
    .first<{ password_hash: string | null }>()

  if (!row?.password_hash || !(await verifyPassword(input.currentPassword, row.password_hash))) {
    throw new HttpError(422, 'INVALID_CURRENT_PASSWORD', '当前密码不正确')
  }

  const nextHash = await hashPassword(input.newPassword)
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(nextHash, nowIso(), user.id).run()

  return ok(c, { updated: true })
})
