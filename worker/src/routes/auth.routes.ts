import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { registerSchema, loginSchema } from '../schemas/auth.schema'
import { buildDefaultBookStatements } from '../services/default-data'
import { hashInviteCode } from '../utils/crypto'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { hashPassword, verifyPassword } from '../utils/password'
import { signSessionToken } from '../utils/jwt'
import { toUser } from '../utils/mapper'
import { assertRateLimitAvailable, clearRateLimit, consumeRateLimit, getClientIp, rateLimitKey } from '../utils/rate-limit'
import { ok } from '../utils/response'
import { requireAuth } from '../middlewares/auth.middleware'
import { createUserSession, removeOtherUserSessions, removeUserSession } from '../services/session.service'

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

authRoutes.post('/register', async (c) => {
  const clientIp = getClientIp(c)
  await consumeRateLimit(c.env.SESSION_KV, await rateLimitKey('auth:register:ip', clientIp), 10, 600, '注册请求过于频繁，请稍后再试')

  const input = registerSchema.parse(await c.req.json())
  const email = input.email.trim().toLowerCase()
  const now = nowIso()
  const inviteSecret = c.env.invite_hash_secret || c.env.jwt_secret
  const codeHash = await hashInviteCode(input.inviteCode, inviteSecret)

  const invite = await c.env.DB.prepare(
    `SELECT id, invite_role, allowed_email, max_uses, used_count, expires_at
     FROM registration_invites
     WHERE code_hash = ? AND status = 'active'
     LIMIT 1`
  )
    .bind(codeHash)
    .first<{
      id: string
      invite_role: 'admin' | 'user'
      allowed_email: string | null
      max_uses: number
      used_count: number
      expires_at: string | null
    }>()

  if (!invite) {
    throw new HttpError(422, 'INVALID_INVITE_CODE', '邀请码无效')
  }
  if (invite.expires_at && invite.expires_at <= now) {
    throw new HttpError(422, 'INVITE_CODE_EXPIRED', '邀请码已过期')
  }
  if (invite.used_count >= invite.max_uses) {
    throw new HttpError(422, 'INVITE_CODE_USED_UP', '邀请码已用完')
  }
  if (invite.allowed_email && invite.allowed_email.toLowerCase() !== email) {
    throw new HttpError(422, 'INVITE_EMAIL_MISMATCH', '邀请码限定邮箱不匹配')
  }

  const existingUser = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).bind(email).first()
  if (existingUser) {
    throw new HttpError(409, 'EMAIL_REGISTERED', '邮箱已注册')
  }

  const userId = newId('user')
  const passwordHash = await hashPassword(input.password)
  const nickname = input.nickname?.trim() || email.split('@')[0]
  const defaultCurrency = c.env.default_currency || 'CNY'
  const defaultLocale = c.env.default_locale || 'zh-CN'
  const { bookId, statements } = buildDefaultBookStatements({
    db: c.env.DB,
    userId,
    currency: defaultCurrency,
    now
  })

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (
        id, email, password_hash, nickname, default_currency, locale, timezone,
        system_role, registration_invite_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'Asia/Shanghai', ?, ?, ?, ?)`
    ).bind(userId, email, passwordHash, nickname, defaultCurrency, defaultLocale, invite.invite_role, invite.id, now, now),
    c.env.DB.prepare(
      `UPDATE registration_invites
       SET used_count = used_count + 1, updated_at = ?
       WHERE id = ? AND used_count < max_uses`
    ).bind(now, invite.id),
    ...statements
  ])

  return ok(
    c,
    {
      user: {
        id: userId,
        email,
        nickname,
        systemRole: invite.invite_role
      },
      defaultBookId: bookId
    },
    201
  )
})

authRoutes.post('/login', async (c) => {
  const clientIp = getClientIp(c)
  await consumeRateLimit(c.env.SESSION_KV, await rateLimitKey('auth:login:ip', clientIp), 20, 600, '登录请求过于频繁，请稍后再试')

  const input = loginSchema.parse(await c.req.json())
  const email = input.email.trim().toLowerCase()
  const failedLoginKey = await rateLimitKey('auth:login:fail', `${clientIp}:${email}`)
  await assertRateLimitAvailable(c.env.SESSION_KV, failedLoginKey, 5, '登录失败次数过多，请稍后再试')

  const row = await c.env.DB.prepare(
    `SELECT id, email, password_hash, nickname, avatar_url, default_currency, locale, timezone, system_role, created_at, updated_at, last_login_at
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`
  )
    .bind(email)
    .first<Record<string, unknown> & { password_hash: string | null }>()

  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    await consumeRateLimit(c.env.SESSION_KV, failedLoginKey, 5, 600, '登录失败次数过多，请稍后再试')
    throw new HttpError(401, 'UNAUTHORIZED', '邮箱或密码错误')
  }

  await clearRateLimit(c.env.SESSION_KV, failedLoginKey)

  const user = toUser(row)
  const { token, jti, expiresIn } = await signSessionToken(
    { id: user.id, email: user.email, systemRole: user.systemRole as 'admin' | 'user' },
    c.env.jwt_secret
  )

  await createUserSession(c.env.SESSION_KV, user.id, jti, expiresIn)
  await c.env.DB.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), user.id).run()

  return ok(c, { token, expiresIn, user })
})

authRoutes.post('/logout', requireAuth, async (c) => {
  await removeUserSession(c.env.SESSION_KV, c.get('currentUser').id, c.get('sessionJti'))
  return ok(c, { loggedOut: true })
})

authRoutes.post('/logout-other-devices', requireAuth, async (c) => {
  const loggedOutDevices = await removeOtherUserSessions(c.env.SESSION_KV, c.get('currentUser').id, c.get('sessionJti'))
  return ok(c, { loggedOutDevices })
})
