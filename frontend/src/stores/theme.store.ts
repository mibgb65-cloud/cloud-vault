import { defineStore } from 'pinia'
import { useColorMode } from '@vueuse/core'

export const useThemeStore = defineStore('theme', () => {
  const mode = useColorMode({
    selector: 'html',
    attribute: 'class',
    modes: {
      light: '',
      dark: 'dark'
    },
    storageKey: 'cloud-vault-theme'
  })

  return { mode }
})
