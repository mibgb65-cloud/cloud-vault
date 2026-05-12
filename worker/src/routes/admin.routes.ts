import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireSystemAdmin } from '../middlewares/auth.middleware'
import { createInviteSchema, updateInviteSchema, updateUserStatusSchema } from '../schemas/admin.schema'
import { hashInviteCode } from '../utils/crypto'
import { HttpError } from '../utils/http-error'
import { createInviteCode, newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { toUser } from '../utils/mapper'
import { ok } from '../utils/response'

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

adminRoutes.use('*', requireSystemAdmin)

adminRoutes.get('/users', async (c) => {
  const page = Math.max(Number(c.req.query('page') || 1), 1)
  const pageSize = Math.min(Math.max(Number(c.req.query('pageSize') || 20), 1), 100)
  const offset = (page - 1) * pageSize
  const rows = await c.env.DB.prepare(
    `SELECT id, email, nickname, avatar_url, default_currency, locale, timezone, system_role, created_at, updated_at, last_login_at, deleted_at
     FROM users
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(pageSize, offset)
    .all<Record<string, unknown>>()
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM users`).first<{ count: number }>()

  return ok(c, {
    items: (rows.results ?? []).map((row) => ({
      ...toUser(row),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null
    })),
    pageInfo: {
      page,
      pageSize,
      total: total?.count ?? 0,
      hasMore: offset + pageSize < (total?.count ?? 0)
    }
  })
})

adminRoutes.patch('/users/:userId/status', async (c) => {
  const input = updateUserStatusSchema.parse(await c.req.json())
  const currentUser = c.get('currentUser')
  const userId = c.req.param('userId')!

  if (userId === currentUser.id && input.disabled) {
    throw new HttpError(422, 'VALIDATION_ERROR', '不能禁用当前登录管理员')
  }

  const deletedAt = input.disabled ? nowIso() : null
  await c.env.DB.prepare(`UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(deletedAt, nowIso(), userId).run()
  return ok(c, { updated: true })
})

adminRoutes.get('/registration-invites', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT i.id, i.invite_role, i.allowed_email, i.max_uses, i.used_count, i.expires_at, i.status, i.note, i.created_at, i.updated_at,
            u.email AS created_by_email
     FROM registration_invites i
     LEFT JOIN users u ON u.id = i.created_by
     ORDER BY i.created_at DESC`
  ).all<Record<string, unknown>>()

  return ok(c, {
    items: (rows.results ?? []).map((row) => ({
      id: String(row.id),
      inviteRole: String(row.invite_role),
      allowedEmail: row.allowed_email ? String(row.allowed_email) : null,
      maxUses: Number(row.max_uses),
      usedCount: Number(row.used_count),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      status: String(row.status),
      note: row.note ? String(row.note) : null,
      createdByEmail: row.created_by_email ? String(row.created_by_email) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }))
  })
})

adminRoutes.post('/registration-invites', async (c) => {
  const input = createInviteSchema.parse(await c.req.json())
  const currentUser = c.get('currentUser')
  const now = nowIso()
  const code = createInviteCode()
  const codeHash = await hashInviteCode(code, c.env.invite_hash_secret || c.env.jwt_secret)
  const inviteId = newId('invite')

  await c.env.DB.prepare(
    `INSERT INTO registration_invites (
      id, code_hash, created_by, invite_role, allowed_email, max_uses, used_count,
      expires_at, status, note, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', ?, ?, ?)`
  )
    .bind(
      inviteId,
      codeHash,
      currentUser.id,
      input.inviteRole,
      input.allowedEmail?.toLowerCase() ?? null,
      input.maxUses,
      input.expiresAt ?? null,
      input.note ?? null,
      now,
      now
    )
    .run()

  return ok(
    c,
    {
      invite: {
        id: inviteId,
        code,
        inviteRole: input.inviteRole,
        maxUses: input.maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt ?? null,
        status: 'active'
      }
    },
    201
  )
})

adminRoutes.patch('/registration-invites/:inviteId', async (c) => {
  const input = updateInviteSchema.parse(await c.req.json())
  const inviteId = c.req.param('inviteId')!
  const existing = await c.env.DB.prepare(`SELECT id FROM registration_invites WHERE id = ? LIMIT 1`).bind(inviteId).first()
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '邀请码不存在')
  }

  await c.env.DB.prepare(
    `UPDATE registration_invites
     SET status = COALESCE(?, status),
         expires_at = ?,
         note = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(input.status ?? null, input.expiresAt ?? null, input.note ?? null, nowIso(), inviteId)
    .run()

  return ok(c, { updated: true })
})

adminRoutes.delete('/registration-invites/:inviteId', async (c) => {
  const inviteId = c.req.param('inviteId')!
  const existing = await c.env.DB.prepare(`SELECT used_count FROM registration_invites WHERE id = ? LIMIT 1`).bind(inviteId).first<{
    used_count: number
  }>()

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '邀请码不存在')
  }
  if (existing.used_count > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', '已使用的邀请码不能删除')
  }

  await c.env.DB.prepare(`DELETE FROM registration_invites WHERE id = ?`).bind(inviteId).run()
  return ok(c, { deleted: true })
})

adminRoutes.get('/registration-invites/:inviteId/users', async (c) => {
  const inviteId = c.req.param('inviteId')!
  const rows = await c.env.DB.prepare(
    `SELECT id, email, nickname, avatar_url, default_currency, locale, timezone, system_role, created_at, updated_at, last_login_at
     FROM users
     WHERE registration_invite_id = ?
     ORDER BY created_at DESC`
  )
    .bind(inviteId)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toUser) })
})

adminRoutes.get('/settings', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT key, value, value_type, description, updated_at FROM system_settings ORDER BY key`).all<
    Record<string, unknown>
  >()

  return ok(c, {
    items: (rows.results ?? []).map((row) => ({
      key: String(row.key),
      value: String(row.value),
      valueType: String(row.value_type),
      description: row.description ? String(row.description) : null,
      updatedAt: String(row.updated_at)
    }))
  })
})

adminRoutes.patch('/settings', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>
  const allowedKeys = new Set(['registration_mode', 'default_currency', 'default_locale'])
  const now = nowIso()
  const currentUser = c.get('currentUser')
  const statements: D1PreparedStatement[] = []

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.has(key)) {
      continue
    }
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO system_settings (key, value, value_type, updated_by, updated_at)
         VALUES (?, ?, 'string', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
      ).bind(key, String(value), currentUser.id, now)
    )
  }

  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }

  return ok(c, { updated: statements.length })
})
