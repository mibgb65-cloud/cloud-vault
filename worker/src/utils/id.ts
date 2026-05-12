const prefixes = {
  user: 'user',
  invite: 'inv',
  book: 'book',
  account: 'acc',
  budget: 'bud',
  category: 'cat',
  tag: 'tag',
  transaction: 'txn',
  session: 'sess',
  request: 'req'
} as const

export type IdKind = keyof typeof prefixes

export function newId(kind: IdKind) {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefixes[kind]}_${token}`
}

export function createInviteCode(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
