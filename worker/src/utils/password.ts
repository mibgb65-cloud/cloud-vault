const encoder = new TextEncoder()
const iterations = 100_000

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function derive(password: string, salt: Uint8Array, iterationCount: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      iterations: iterationCount
    },
    key,
    256
  )
  return new Uint8Array(bits)
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

export async function hashPassword(password: string) {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const digest = await derive(password, salt, iterations)

  return `pbkdf2_sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(digest)}`
}

export async function verifyPassword(password: string, encodedHash: string | null | undefined) {
  if (!encodedHash) {
    return false
  }

  const [algorithm, iterationValue, saltValue, digestValue] = encodedHash.split('$')
  if (algorithm !== 'pbkdf2_sha256' || !iterationValue || !saltValue || !digestValue) {
    return false
  }

  const digest = await derive(password, base64ToBytes(saltValue), Number(iterationValue))
  return constantTimeEqual(digest, base64ToBytes(digestValue))
}
