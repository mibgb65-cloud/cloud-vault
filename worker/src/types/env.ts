export interface Env {
  ASSETS: Fetcher
  DB: D1Database
  SESSION_KV: KVNamespace
  admin_email: string
  registration_invite_code: string
  jwt_secret: string
  invite_hash_secret?: string
  registration_mode?: string
  default_currency?: string
  default_locale?: string
  deepseek_api_key?: string
  deepseek_model?: string
}

export interface CurrentUser {
  id: string
  email: string
  nickname: string
  avatarUrl?: string | null
  systemRole: 'admin' | 'user'
  defaultCurrency: string
  locale: string
  timezone: string
}

export type AppVariables = {
  requestId: string
  currentUser: CurrentUser
  sessionJti: string
}
