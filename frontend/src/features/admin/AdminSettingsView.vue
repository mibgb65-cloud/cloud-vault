<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { listSystemSettings, updateSystemSettings, type SystemSetting } from '@/services/admin.api'

const settings = ref<SystemSetting[]>([])
const saving = ref(false)
const error = ref('')
const success = ref('')
const form = ref({
  registrationMode: 'invite_only',
  defaultCurrency: 'CNY',
  defaultLocale: 'zh-CN'
})

const registrationOptions = [
  { label: '仅邀请码', value: 'invite_only' },
  { label: '关闭注册', value: 'closed' },
  { label: '开放注册', value: 'open' }
]
const localeOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const settingMap = computed(() => new Map(settings.value.map((item) => [item.key, item.value])))

async function load() {
  const result = await listSystemSettings()
  settings.value = result.items
  form.value.registrationMode = settingMap.value.get('registration_mode') || 'invite_only'
  form.value.defaultCurrency = settingMap.value.get('default_currency') || 'CNY'
  form.value.defaultLocale = settingMap.value.get('default_locale') || 'zh-CN'
}

async function submit() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await updateSystemSettings({
      registration_mode: form.value.registrationMode,
      default_currency: form.value.defaultCurrency.toUpperCase(),
      default_locale: form.value.defaultLocale
    })
    success.value = `已更新 ${result.updated} 项设置`
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存系统设置失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">admin settings</p>
      <h1 class="text-4xl font-bold leading-tight">系统设置</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">注册模式、默认语言和默认货币</p>
    </div>

    <form class="grid gap-3 border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:grid-cols-4" @submit.prevent="submit">
      <label class="grid gap-2">
        <span class="text-sm font-bold">注册模式</span>
        <BaseSelect v-model="form.registrationMode" :options="registrationOptions" />
      </label>
      <label class="grid gap-2">
        <span class="text-sm font-bold">默认货币</span>
        <BaseInput v-model="form.defaultCurrency" maxlength="3" placeholder="CNY" />
      </label>
      <label class="grid gap-2">
        <span class="text-sm font-bold">默认语言</span>
        <BaseSelect v-model="form.defaultLocale" :options="localeOptions" />
      </label>
      <div class="flex items-end">
        <BaseButton type="submit" class="w-full" :disabled="saving">{{ saving ? '保存中' : '保存设置' }}</BaseButton>
      </div>
    </form>

    <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
    <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>

    <section class="overflow-hidden border-t border-[var(--app-border)] bg-[var(--app-surface)]">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--app-subtle)] text-[var(--app-text)]">
          <tr>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">Key</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">Value</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">更新时间</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border-soft)]">
          <tr v-for="item in settings" :key="item.key">
            <td class="px-4 py-3 font-mono text-xs font-extrabold">{{ item.key }}</td>
            <td class="px-4 py-3 font-mono text-xs font-bold">{{ item.value }}</td>
            <td class="px-4 py-3 font-mono text-xs font-bold">{{ item.updatedAt }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
