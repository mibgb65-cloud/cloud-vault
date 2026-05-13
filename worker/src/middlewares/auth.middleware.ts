import type { Context, MiddlewareHandler } from 'hono'
import type { AppVariables, CurrentUser, Env } from '../types/env'
import { HttpError } from '../utils/http-error'
import { toUser } from '../utils/mapper'
import { verifySessionToken } from '../utils/jwt'
import { ensureUserSessionIndexed, isStoredSession, sessionKey } from '../services/session.service'

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>

function readBearerToken(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', '请先登录')
  }

  return header.slice('Bearer '.length).trim()
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (c, next) => {
  const token = readBearerToken(c.req.header('Authorization'))

  let payload: Awaited<ReturnType<typeof verifySessionToken>>
  try {
    payload = await verifySessionToken(token, c.env.jwt_secret)
  } catch {
    throw new HttpError(401, 'TOKEN_EXPIRED', '登录已过期，请重新登录')
  }

  const session = await c.env.SESSION_KV.get(sessionKey(payload.jti), 'json')
  if (!isStoredSession(session) || session.userId !== payload.userId) {
    throw new HttpError(401, 'TOKEN_EXPIRED', '登录已过期，请重新登录')
  }

  const row = await c.env.DB.prepare(
    `SELECT id, email, nickname, avatar_url, default_currency, locale, timezone, system_role, created_at, updated_at, last_login_at
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`
  )
    .bind(payload.userId)
    .first<Record<string, unknown>>()

  if (!row) {
    throw new HttpError(401, 'UNAUTHORIZED', '请先登录')
  }

  c.set('currentUser', toUser(row) as CurrentUser)
  c.set('sessionJti', payload.jti)
  await ensureUserSessionIndexed(c.env.SESSION_KV, payload.userId, payload.jti, session.expiresAt)
  await next()
}

export const requireSystemAdmin: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (c, next) => {
  const user = c.get('currentUser')
  if (user.systemRole !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', '需要系统管理员权限')
  }

  await next()
}

export async function requireBookRole(c: AppContext, bookId: string, allowedRoles: string[]) {
  const user = c.get('currentUser')
  const row = await c.env.DB.prepare(
    `SELECT role
     FROM book_members
     WHERE book_id = ? AND user_id = ? AND status = 'active'
     LIMIT 1`
  )
    .bind(bookId, user.id)
    .first<{ role: string }>()

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', '账本不存在或不可见')
  }

  if (!allowedRoles.includes(row.role)) {
    throw new HttpError(403, 'INSUFFICIENT_PERMISSION', '账本权限不足')
  }

  return row.role
}

export function canWriteBook(role: string) {
  return role === 'owner' || role === 'admin' || role === 'editor'
}
