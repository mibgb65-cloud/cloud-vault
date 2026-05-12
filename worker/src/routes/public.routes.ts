import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { ok } from '../utils/response'

export const publicRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

publicRoutes.get('/config', async (c) => {
  const settings = await c.env.DB.prepare(`SELECT key, value FROM system_settings WHERE key IN ('registration_mode', 'default_currency', 'default_locale')`).all<{
    key: string
    value: string
  }>()
  const settingMap = Object.fromEntries((settings.results ?? []).map((row) => [row.key, row.value]))

  return ok(c, {
    appName: 'Cloud-Vault',
    registrationMode: settingMap.registration_mode || c.env.registration_mode || 'invite_only',
    defaultCurrency: settingMap.default_currency || c.env.default_currency || 'CNY',
    defaultLocale: settingMap.default_locale || c.env.default_locale || 'zh-CN'
  })
})
