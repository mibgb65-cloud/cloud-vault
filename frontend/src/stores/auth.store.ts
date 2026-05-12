import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getMe, login, logout, type LoginInput } from '@/services/auth.api'
import { setToken, getToken } from '@/services/http'
import type { User } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(getToken())
  const isAuthenticated = computed(() => Boolean(token.value && user.value))
  const isAdmin = computed(() => user.value?.systemRole === 'admin')

  async function signIn(input: LoginInput) {
    const result = await login(input)
    token.value = result.token
    user.value = result.user
    setToken(result.token)
  }

  async function loadMe() {
    if (!token.value) {
      return null
    }
    const result = await getMe()
    user.value = result.user
    return result.user
  }

  async function signOut() {
    try {
      await logout()
    } finally {
      token.value = null
      user.value = null
      setToken(null)
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    signIn,
    loadMe,
    signOut
  }
})
