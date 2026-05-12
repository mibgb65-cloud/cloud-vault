<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ArrowLeft, Ticket, Users, Settings } from 'lucide-vue-next'
import BrandMark from '@/components/brand/BrandMark.vue'

const navItems = [
  { to: '/admin/users', label: '用户', icon: Users },
  { to: '/admin/invites', label: '邀请码', icon: Ticket },
  { to: '/admin/settings', label: '设置', icon: Settings }
]
</script>

<template>
  <div class="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
    <header class="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div class="flex items-center gap-4">
          <RouterLink to="/" class="inline-flex h-9 w-9 items-center justify-center border border-[var(--app-border)] hover:bg-[var(--app-inverse)] hover:text-[var(--app-inverse-text)]">
            <ArrowLeft class="h-4 w-4" />
          </RouterLink>
          <BrandMark class="h-9 w-9 shrink-0" />
          <div>
            <p class="font-mono text-sm font-extrabold tracking-[0.16em]">CLOUD ADMIN</p>
            <p class="text-xs font-bold text-[var(--app-muted)]">系统管理</p>
          </div>
        </div>
        <nav class="flex gap-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="inline-flex h-9 items-center gap-2 border border-transparent px-3 text-sm font-bold text-[var(--app-muted)] hover:border-[var(--app-border)] hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)]"
            active-class="!border-[var(--app-border)] !bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]"
          >
            <component :is="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="route-transition-frame mx-auto max-w-[1200px] px-4 py-8">
      <RouterView v-slot="{ Component, route }">
        <Transition name="route-page" mode="out-in">
          <component :is="Component" :key="route.name" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>
