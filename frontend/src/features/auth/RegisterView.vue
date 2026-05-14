<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { getPublicConfig, register, type PublicConfig } from '@/services/auth.api'
import { ApiError } from '@/services/http'

const router = useRouter()
const email = ref('')
const nickname = ref('')
const password = ref('')
const inviteCode = ref('')
const error = ref('')
const loading = ref(false)
const configLoading = ref(false)
const registrationMode = ref<PublicConfig['registrationMode']>('invite_only')
const inviteRequired = computed(() => registrationMode.value === 'invite_only')
const registrationClosed = computed(() => registrationMode.value === 'closed')
const modeLabel = computed(() => {
  if (registrationClosed.value) {
    return 'registration closed'
  }
  return inviteRequired.value ? 'invite only' : 'open registration'
})
const modeDescription = computed(() => {
  if (registrationClosed.value) {
    return '当前站点已关闭新账号注册'
  }
  return inviteRequired.value ? '注册需要管理员分发的邀请码' : '可直接注册，邀请码可选'
})

onMounted(async () => {
  configLoading.value = true
  try {
    const config = await getPublicConfig()
    registrationMode.value = config.registrationMode
  } catch {
    registrationMode.value = 'invite_only'
  } finally {
    configLoading.value = false
  }
})

async function submit() {
  if (registrationClosed.value) {
    error.value = '当前站点已关闭新账号注册'
    return
  }
  if (inviteRequired.value && !inviteCode.value.trim()) {
    error.value = '请填写邀请码'
    return
  }

  loading.value = true
  error.value = ''
  try {
    await register({
      email: email.value,
      nickname: nickname.value || undefined,
      password: password.value,
      inviteCode: inviteCode.value.trim() || undefined
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
        <p class="mb-3 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">{{ modeLabel }}</p>
        <p class="text-4xl font-bold leading-tight">创建账号</p>
        <p class="mt-3 text-sm font-medium leading-7 text-[var(--app-muted)]">{{ configLoading ? '读取注册配置中...' : modeDescription }}</p>
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
          <span class="text-sm font-medium">邀请码{{ inviteRequired ? '' : '（可选）' }}</span>
          <BaseInput v-model="inviteCode" placeholder="管理员提供的邀请码" />
        </label>
        <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-[var(--app-text)]">{{ error }}</p>
        <BaseButton type="submit" class="w-full" :disabled="loading || registrationClosed">
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
