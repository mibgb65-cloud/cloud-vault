import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { ensureSchema } from '../db/schema'
import { hashInviteCode } from '../utils/crypto'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { ok } from '../utils/response'

export const initRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

initRoutes.get('/:secret', async (c) => {
  const secret = c.req.param('secret')
  if (!c.env.jwt_secret || secret !== c.env.jwt_secret) {
    throw new HttpError(403, 'FORBIDDEN', '初始化密钥无效')
  }

  await ensureSchema(c.env.DB)

  const now = nowIso()
  const registrationMode = c.env.registration_mode || 'invite_only'
  const defaultCurrency = c.env.default_currency || 'CNY'
  const defaultLocale = c.env.default_locale || 'zh-CN'

  const settings = [
    ['registration_mode', registrationMode, 'string', '注册模式'],
    ['default_currency', defaultCurrency, 'string', '默认货币'],
    ['default_locale', defaultLocale, 'string', '默认语言']
  ] as const

  await c.env.DB.batch(
    settings.map(([key, value, valueType, description]) =>
      c.env.DB.prepare(
        `INSERT INTO system_settings (key, value, value_type, description, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, value_type = excluded.value_type, description = excluded.description, updated_at = excluded.updated_at`
      ).bind(key, value, valueType, description, now)
    )
  )

  const adminEmail = c.env.admin_email?.trim().toLowerCase()
  const inviteCode = c.env.registration_invite_code?.trim()
  if (!adminEmail || !inviteCode) {
    throw new HttpError(500, 'INTERNAL_ERROR', '缺少 admin_email 或 registration_invite_code 配置')
  }

  const inviteSecret = c.env.invite_hash_secret || c.env.jwt_secret
  const codeHash = await hashInviteCode(inviteCode, inviteSecret)
  const existingInvite = await c.env.DB.prepare(`SELECT id FROM registration_invites WHERE code_hash = ? LIMIT 1`)
    .bind(codeHash)
    .first()

  if (!existingInvite) {
    await c.env.DB.prepare(
      `INSERT INTO registration_invites (
        id, code_hash, created_by, invite_role, allowed_email, max_uses,
        used_count, expires_at, status, note, created_at, updated_at
      )
      VALUES (?, ?, NULL, 'admin', ?, 1, 0, NULL, 'active', 'Initial administrator invite', ?, ?)`
    )
      .bind(newId('invite'), codeHash, adminEmail, now, now)
      .run()
  }

  await c.env.SESSION_KV.put('init_lock', JSON.stringify({ initializedAt: now }))

  return ok(c, { initialized: true })
})
