const encoder = new TextEncoder()

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase()
}

export async function hmacSha256Hex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))

  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashInviteCode(code: string, secret: string) {
  return hmacSha256Hex(normalizeInviteCode(code), secret)
}
