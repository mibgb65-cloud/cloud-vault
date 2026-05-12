<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BrandMark from '@/components/brand/BrandMark.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth.store'
import { ApiError } from '@/services/http'

type EntrancePhase = 'active' | 'reveal' | 'done'

const LOGIN_ENTRANCE_KEY = 'cloud-vault-login-entrance-shown'

function getInitialEntrancePhase(): EntrancePhase {
  if (typeof window === 'undefined') {
    return 'active'
  }

  return window.sessionStorage.getItem(LOGIN_ENTRANCE_KEY) ? 'done' : 'active'
}

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const entrancePhase = ref<EntrancePhase>(getInitialEntrancePhase())
let entranceRevealTimer: number | undefined
let entranceDoneTimer: number | undefined

onMounted(() => {
  if (entrancePhase.value === 'done') {
    return
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    entrancePhase.value = 'done'
    window.sessionStorage.setItem(LOGIN_ENTRANCE_KEY, '1')
    return
  }

  entranceRevealTimer = window.setTimeout(() => {
    entrancePhase.value = 'reveal'
  }, 600)
  entranceDoneTimer = window.setTimeout(() => {
    entrancePhase.value = 'done'
    window.sessionStorage.setItem(LOGIN_ENTRANCE_KEY, '1')
  }, 1600)
})

onBeforeUnmount(() => {
  if (entranceRevealTimer) {
    window.clearTimeout(entranceRevealTimer)
  }
  if (entranceDoneTimer) {
    window.clearTimeout(entranceDoneTimer)
  }
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.signIn({ email: email.value, password: password.value })
    await router.push(String(route.query.redirect || '/'))
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="fixed inset-0 flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[var(--app-bg)] px-4 py-8 text-[var(--app-text)]">
    <Transition name="entrance-overlay">
      <div v-if="entrancePhase !== 'done'" class="login-entrance-overlay" :class="entrancePhase" aria-hidden="true">
        <div class="login-entrance-panel login-entrance-panel--top"></div>
        <div class="login-entrance-panel login-entrance-panel--bottom"></div>
        <div class="login-entrance-brand">
          <div class="login-entrance-icon">
            <BrandMark class="h-14 w-14" />
          </div>
          <span class="login-entrance-label">Cloud-Vault</span>
        </div>
        <div class="login-entrance-line"></div>
      </div>
    </Transition>

    <section class="login-card w-full max-w-md border-t border-[var(--app-border)] bg-[var(--app-surface)] py-8" :class="{ 'login-card--with-entrance': entrancePhase !== 'done' }">
      <div class="mb-6 flex items-start gap-3">
        <BrandMark class="mt-1 h-12 w-12 shrink-0" />
        <div class="min-w-0">
          <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">account access</p>
          <p class="text-4xl font-bold leading-tight">Cloud-Vault</p>
          <p class="mt-3 text-sm font-medium leading-7 text-[var(--app-muted)]">登录后进入记账工作台</p>
        </div>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-2">
          <span class="text-sm font-medium">邮箱</span>
          <BaseInput v-model="email" type="email" placeholder="you@example.com" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium">密码</span>
          <BaseInput v-model="password" type="password" placeholder="********" />
        </label>
        <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-[var(--app-text)]">{{ error }}</p>
        <BaseButton type="submit" class="w-full" :disabled="loading">
          {{ loading ? '登录中' : '登录' }}
        </BaseButton>
      </form>
      <p class="mt-5 border-t border-[var(--app-border-soft)] pt-5 text-center text-sm font-medium text-[var(--app-muted)]">
        没有账号？
        <RouterLink class="font-extrabold text-[var(--app-text)] underline underline-offset-4" to="/register">使用邀请码注册</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.login-card--with-entrance {
  animation: login-card-in 520ms 1120ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.login-entrance-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.login-entrance-panel {
  position: fixed;
  left: 0;
  width: 100%;
  height: 50vh;
  background: var(--app-border);
  transition: transform 900ms cubic-bezier(0.76, 0, 0.24, 1);
}

.login-entrance-panel--top {
  top: 0;
}

.login-entrance-panel--bottom {
  bottom: 0;
}

.login-entrance-overlay.reveal .login-entrance-panel--top {
  transform: translateY(-100%);
}

.login-entrance-overlay.reveal .login-entrance-panel--bottom {
  transform: translateY(100%);
}

.login-entrance-brand {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  gap: 16px;
  color: var(--app-inverse-text);
  transition:
    opacity 500ms 100ms ease,
    transform 500ms 100ms cubic-bezier(0.76, 0, 0.24, 1);
}

.login-entrance-overlay.reveal .login-entrance-brand {
  opacity: 0;
  transform: scale(0.92);
  transition:
    opacity 360ms ease,
    transform 360ms cubic-bezier(0.76, 0, 0.24, 1);
}

.login-entrance-icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  animation: login-entrance-icon-pulse 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.login-entrance-label {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.18em;
  animation: login-entrance-label-in 480ms 120ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.login-entrance-line {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  width: 0;
  height: 1px;
  background: var(--app-inverse-text);
  transform: translate(-50%, -50%);
  animation: login-entrance-line-expand 640ms 200ms cubic-bezier(0.36, 0, 0.64, 1) forwards;
}

.login-entrance-overlay.reveal .login-entrance-line {
  opacity: 0;
  transition: opacity 200ms ease;
}

.entrance-overlay-enter-active {
  transition: none;
}

.entrance-overlay-leave-active {
  transition: opacity 260ms ease;
}

.entrance-overlay-leave-to {
  opacity: 0;
}

@keyframes login-card-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes login-entrance-icon-pulse {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  70% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes login-entrance-label-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes login-entrance-line-expand {
  0% {
    width: 0;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    width: min(280px, 60vw);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-card,
  .login-entrance-icon,
  .login-entrance-label,
  .login-entrance-line {
    animation: none;
  }

  .login-entrance-panel,
  .login-entrance-brand,
  .login-entrance-overlay.reveal .login-entrance-brand {
    transition: none;
  }
}
</style>
