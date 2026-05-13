import { HttpError } from '../utils/http-error'

export const MAX_USER_SESSIONS = 5

interface UserSessionRecord {
  jti: string
  createdAt: string
  expiresAt: string
}

export interface StoredSession {
  userId: string
  expiresAt: string
}

function userSessionsKey(userId: string) {
  return `user_sessions:${userId}`
}

export function sessionKey(jti: string) {
  return `session:${jti}`
}

export function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Partial<StoredSession>
  return typeof session.userId === 'string' && typeof session.expiresAt === 'string'
}

function isUserSessionRecord(value: unknown): value is UserSessionRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Partial<UserSessionRecord>
  return typeof session.jti === 'string' && typeof session.createdAt === 'string' && typeof session.expiresAt === 'string'
}

function parseTime(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function normalizeSessions(value: unknown, now = Date.now()) {
  const rows = Array.isArray(value) ? value : []
  const byJti = new Map<string, UserSessionRecord>()

  for (const row of rows) {
    if (!isUserSessionRecord(row) || parseTime(row.expiresAt) <= now) {
      continue
    }
    byJti.set(row.jti, row)
  }

  return Array.from(byJti.values()).sort((a, b) => parseTime(a.createdAt) - parseTime(b.createdAt))
}

async function saveUserSessions(kv: KVNamespace, userId: string, sessions: UserSessionRecord[]) {
  if (sessions.length === 0) {
    await kv.delete(userSessionsKey(userId))
    return
  }

  const latestExpiresAt = Math.max(...sessions.map((session) => parseTime(session.expiresAt)))
  const expirationTtl = Math.max(60, Math.ceil((latestExpiresAt - Date.now()) / 1000) + 60)
  await kv.put(userSessionsKey(userId), JSON.stringify(sessions), { expirationTtl })
}

async function getActiveUserSessions(kv: KVNamespace, userId: string, verifyStoredSessions = false) {
  const stored = await kv.get(userSessionsKey(userId), 'json')
  const active = normalizeSessions(stored)

  if (!verifyStoredSessions) {
    return active
  }

  const verified: UserSessionRecord[] = []
  for (const session of active) {
    const storedSession = await kv.get(sessionKey(session.jti), 'json')
    if (isStoredSession(storedSession) && storedSession.userId === userId) {
      verified.push(session)
    }
  }

  if (verified.length !== active.length) {
    await saveUserSessions(kv, userId, verified)
  }

  return verified
}

export async function createUserSession(kv: KVNamespace, userId: string, jti: string, expiresIn: number) {
  const activeSessions = await getActiveUserSessions(kv, userId, true)

  if (activeSessions.length >= MAX_USER_SESSIONS) {
    throw new HttpError(409, 'SESSION_LIMIT_REACHED', `已达到 ${MAX_USER_SESSIONS} 个登录设备上限，请先在已登录设备退出其他设备`, {
      maxDevices: MAX_USER_SESSIONS
    })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString()
  const session = { userId, expiresAt }

  await kv.put(sessionKey(jti), JSON.stringify(session), { expirationTtl: expiresIn })
  await saveUserSessions(kv, userId, [
    ...activeSessions,
    {
      jti,
      createdAt: now.toISOString(),
      expiresAt
    }
  ])
}

export async function ensureUserSessionIndexed(kv: KVNamespace, userId: string, jti: string, expiresAt: string) {
  const activeSessions = await getActiveUserSessions(kv, userId)
  if (activeSessions.some((session) => session.jti === jti)) {
    return
  }

  await saveUserSessions(kv, userId, [
    ...activeSessions,
    {
      jti,
      createdAt: new Date().toISOString(),
      expiresAt
    }
  ])
}

export async function removeUserSession(kv: KVNamespace, userId: string, jti: string) {
  await kv.delete(sessionKey(jti))
  const activeSessions = await getActiveUserSessions(kv, userId)
  await saveUserSessions(
    kv,
    userId,
    activeSessions.filter((session) => session.jti !== jti)
  )
}

export async function removeOtherUserSessions(kv: KVNamespace, userId: string, currentJti: string) {
  const activeSessions = await getActiveUserSessions(kv, userId, true)
  const otherSessions = activeSessions.filter((session) => session.jti !== currentJti)

  await Promise.all(otherSessions.map((session) => kv.delete(sessionKey(session.jti))))
  await saveUserSessions(
    kv,
    userId,
    activeSessions.filter((session) => session.jti === currentJti)
  )

  return otherSessions.length
}
