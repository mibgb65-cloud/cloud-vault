import { SignJWT, jwtVerify } from 'jose'
import { newId } from './id'

const encoder = new TextEncoder()
const expiresIn = 60 * 60 * 24 * 7

export interface TokenUser {
  id: string
  email: string
  systemRole: 'admin' | 'user'
}

export async function signSessionToken(user: TokenUser, secret: string) {
  const jti = newId('session')
  const now = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({
    email: user.email,
    systemRole: user.systemRole
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(encoder.encode(secret))

  return { token, jti, expiresIn }
}

export async function verifySessionToken(token: string, secret: string) {
  const result = await jwtVerify(token, encoder.encode(secret))
  const subject = result.payload.sub
  const jti = result.payload.jti

  if (!subject || !jti) {
    throw new Error('Invalid token payload')
  }

  return {
    userId: subject,
    jti,
    email: String(result.payload.email ?? ''),
    systemRole: result.payload.systemRole === 'admin' ? 'admin' : 'user'
  }
}
