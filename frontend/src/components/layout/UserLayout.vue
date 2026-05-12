<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { BarChart3, Home, Languages, List, LogOut, Moon, PieChart, Settings, Shield, Sun, WalletCards } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/brand/BrandMark.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useBookStore } from '@/stores/book.store'
import { useThemeStore } from '@/stores/theme.store'

type EntrancePhase = 'active' | 'reveal' | 'done'

const APP_ENTRANCE_KEY = 'cloud-vault-app-entrance-shown'

const auth = useAuthStore()
const books = useBookStore()
const theme = useThemeStore()
const router = useRouter()
const { locale } = useI18n({ useScope: 'global' })
const preferenceMotion = ref(false)
const themeMotion = ref(false)
const entrancePhase = ref<EntrancePhase>('active')
let preferenceMotionTimer: number | undefined
let themeMotionTimer: number | undefined
let entranceRevealTimer: number | undefined
let entranceDoneTimer: number | undefined

const navItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/transactions', label: '账单', icon: List },
  { to: '/accounts', label: '账户', icon: WalletCards },
  { to: '/reports', label: '统计', icon: BarChart3 },
  { to: '/budgets', label: '预算', icon: PieChart },
  { to: '/settings', label: '设置', icon: Settings }
]
const desktopNavActiveClass = '!border-[var(--app-border)] !bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]'
const mobileNavActiveClass = '!bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]'
const themeItems = [
  { label: '亮色', value: 'light', icon: Sun },
  { label: '暗色', value: 'dark', icon: Moon }
] as const
const languageItems = [
  { label: '简体中文', short: '中', value: 'zh-CN' },
  { label: 'English', short: 'EN', value: 'en-US' }
] as const
const bookOptions = computed(() => books.books.map((book) => ({ label: book.name, value: book.id })))

onMounted(() => {
  void books.loadBooks()
  if (window.sessionStorage.getItem(APP_ENTRANCE_KEY) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    entrancePhase.value = 'done'
    window.sessionStorage.setItem(APP_ENTRANCE_KEY, '1')
    return
  }

  entranceRevealTimer = window.setTimeout(() => {
    entrancePhase.value = 'reveal'
  }, 600)
  entranceDoneTimer = window.setTimeout(() => {
    entrancePhase.value = 'done'
    window.sessionStorage.setItem(APP_ENTRANCE_KEY, '1')
  }, 1600)
})

onBeforeUnmount(() => {
  if (preferenceMotionTimer) {
    window.clearTimeout(preferenceMotionTimer)
  }
  if (themeMotionTimer) {
    window.clearTimeout(themeMotionTimer)
  }
  if (entranceRevealTimer) {
    window.clearTimeout(entranceRevealTimer)
  }
  if (entranceDoneTimer) {
    window.clearTimeout(entranceDoneTimer)
  }
})

async function signOut() {
  await auth.signOut()
  await router.push('/login')
}

function triggerPreferenceMotion() {
  if (preferenceMotionTimer) {
    window.clearTimeout(preferenceMotionTimer)
  }
  preferenceMotion.value = false
  window.requestAnimationFrame(() => {
    preferenceMotion.value = true
    preferenceMotionTimer = window.setTimeout(() => {
      preferenceMotion.value = false
    }, 240)
  })
}

function triggerThemeMotion() {
  if (themeMotionTimer) {
    window.clearTimeout(themeMotionTimer)
  }
  themeMotion.value = false
  window.requestAnimationFrame(() => {
    themeMotion.value = true
    themeMotionTimer = window.setTimeout(() => {
      themeMotion.value = false
    }, 240)
  })
}

function setThemeMode(value: 'light' | 'dark') {
  if (theme.mode === value) {
    return
  }
  triggerThemeMotion()
  theme.mode = value
}

function setLocale(value: string) {
  if (locale.value === value) {
    return
  }
  triggerPreferenceMotion()
  locale.value = value
  localStorage.setItem('cloud-vault-locale', value)
}
</script>

<template>
  <div
    class="app-shell min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]"
    :class="{ 'app-shell--theme-switching': themeMotion }"
  >
    <aside class="fixed inset-y-0 left-0 hidden w-20 border-r border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-3 lg:block">
      <div class="mb-4 border-b border-[var(--app-border)] pb-3">
        <div class="flex flex-col items-center gap-2">
          <BrandMark class="h-10 w-10" />
          <p class="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em]">CV</p>
          <p class="sr-only">{{ books.currentBook?.name || '我的账本' }}</p>
        </div>
      </div>

      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :title="item.label"
          class="flex h-11 items-center justify-center border border-transparent text-[var(--app-muted)] transition hover:border-[var(--app-border)] hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)]"
          :active-class="item.to === '/' ? '' : desktopNavActiveClass"
          :exact-active-class="desktopNavActiveClass"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span class="sr-only">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="absolute bottom-3 left-2 right-2 space-y-1">
        <RouterLink
          v-if="auth.isAdmin"
          to="/admin"
          title="管理后台"
          class="flex h-11 items-center justify-center border border-transparent text-[var(--app-muted)] transition hover:border-[var(--app-border)] hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)]"
        >
          <Shield class="h-4 w-4" />
          <span class="sr-only">管理后台</span>
        </RouterLink>
        <BaseButton variant="ghost" class="h-11 w-full justify-center px-0" title="退出登录" @click="signOut">
          <LogOut class="h-4 w-4" />
          <span class="sr-only">退出登录</span>
        </BaseButton>
      </div>
    </aside>

    <div class="lg:pl-20">
      <header class="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5">
        <div class="flex min-w-0 items-center gap-2">
          <BrandMark class="h-8 w-8 shrink-0 lg:hidden" />
          <div class="min-w-0">
            <p class="hidden font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)] sm:block">workspace</p>
            <p class="truncate text-sm font-extrabold">{{ books.currentBook?.name || '我的账本' }}</p>
          </div>
        </div>
        <div class="preference-controls flex shrink-0 items-center gap-2">
          <BaseSelect
            v-if="books.books.length > 1"
            class="hidden h-8 w-40 text-xs sm:block"
            :model-value="books.currentBookId || ''"
            :options="bookOptions"
            aria-label="切换账本"
            @update:model-value="books.setCurrentBook"
          />
          <div class="theme-toggle" :class="theme.mode === 'dark' ? 'theme-toggle--dark' : 'theme-toggle--light'" role="group" aria-label="主题模式">
            <span class="theme-toggle__thumb" aria-hidden="true"></span>
            <button
              v-for="item in themeItems"
              :key="item.value"
              type="button"
              class="theme-toggle__button"
              :class="{ 'theme-toggle__button--active': theme.mode === item.value }"
              :title="item.label"
              :aria-pressed="theme.mode === item.value"
              @click="setThemeMode(item.value)"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span class="sr-only">{{ item.label }}</span>
            </button>
          </div>
          <div
            class="language-toggle"
            :class="[locale === 'en-US' ? 'language-toggle--en' : 'language-toggle--zh', { 'language-toggle--moving': preferenceMotion }]"
            role="group"
            aria-label="语言"
          >
            <Languages class="language-toggle__icon" aria-hidden="true" />
            <span class="language-toggle__thumb" aria-hidden="true"></span>
            <button
              v-for="item in languageItems"
              :key="item.value"
              type="button"
              class="language-toggle__button"
              :class="{ 'language-toggle__button--active': locale === item.value }"
              :title="item.label"
              :aria-pressed="locale === item.value"
              @click="setLocale(item.value)"
            >
              <span aria-hidden="true">{{ item.short }}</span>
              <span class="sr-only">{{ item.label }}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="route-transition-frame w-full px-3 py-3 pb-20 lg:pb-3">
        <RouterView v-slot="{ Component, route }">
          <Transition name="route-page" mode="out-in">
            <component :is="Component" :key="route.name" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav class="fixed bottom-0 left-0 right-0 grid grid-cols-5 border-t border-[var(--app-border)] bg-[var(--app-surface)] lg:hidden">
      <RouterLink
        v-for="item in navItems.slice(0, 5)"
        :key="item.to"
        :to="item.to"
        class="flex h-14 flex-col items-center justify-center gap-1 border-r border-[var(--app-border-soft)] text-xs font-bold text-[var(--app-muted)]"
        :active-class="item.to === '/' ? '' : mobileNavActiveClass"
        :exact-active-class="mobileNavActiveClass"
      >
        <component :is="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <Transition name="app-entrance-overlay">
      <div v-if="entrancePhase !== 'done'" class="app-entrance-overlay" :class="entrancePhase" aria-hidden="true">
        <div class="app-entrance-panel app-entrance-panel--top"></div>
        <div class="app-entrance-panel app-entrance-panel--bottom"></div>
        <div class="app-entrance-brand">
          <BrandMark class="h-14 w-14" />
          <span class="app-entrance-label">Cloud-Vault</span>
        </div>
        <div class="app-entrance-line"></div>
      </div>
    </Transition>
  </div>
</template>
