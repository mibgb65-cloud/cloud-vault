import { createI18n } from 'vue-i18n'
import enUS from './en-US'
import zhCN from './zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('cloud-vault-locale') || import.meta.env.VITE_DEFAULT_LOCALE || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})
