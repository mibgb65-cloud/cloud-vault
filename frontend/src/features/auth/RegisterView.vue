<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { register } from '@/services/auth.api'
import { ApiError } from '@/services/http'

const router = useRouter()
const email = ref('')
const nickname = ref('')
const password = ref('')
const inviteCode = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await register({
      email: email.value,
      nickname: nickname.value || undefined,
      password: password.value,
      inviteCode: inviteCode.value
    })
    await router.push('/login')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-8 text-[var(--app-text)]">
    <section class="w-full max-w-md border-t border-[var(--app-border)] bg-[var(--app-surface)] py-8">
      <div class="mb-6">
        <p class="mb-3 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">invite only</p>
        <p class="text-4xl font-bold leading-tight">创建账号</p>
        <p class="mt-3 text-sm font-medium leading-7 text-[var(--app-muted)]">注册需要管理员分发的邀请码</p>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-2">
          <span class="text-sm font-medium">邮箱</span>
          <BaseInput v-model="email" type="email" placeholder="you@example.com" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium">昵称</span>
          <BaseInput v-model="nickname" placeholder="可选" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium">密码</span>
          <BaseInput v-model="password" type="password" placeholder="至少 8 位" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium">邀请码</span>
          <BaseInput v-model="inviteCode" placeholder="管理员提供的邀请码" />
        </label>
        <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-[var(--app-text)]">{{ error }}</p>
        <BaseButton type="submit" class="w-full" :disabled="loading">
          {{ loading ? '注册中' : '注册' }}
        </BaseButton>
      </form>
      <p class="mt-5 border-t border-[var(--app-border-soft)] pt-5 text-center text-sm font-medium text-[var(--app-muted)]">
        已有账号？
        <RouterLink class="font-extrabold text-[var(--app-text)] underline underline-offset-4" to="/login">登录</RouterLink>
      </p>
    </section>
  </main>
</template>
