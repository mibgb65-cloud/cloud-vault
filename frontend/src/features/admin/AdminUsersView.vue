<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import MetricCard from '@/components/ui/MetricCard.vue'
import { listUsers, updateUserStatus } from '@/services/admin.api'
import type { User } from '@/types/domain'

const users = ref<User[]>([])
const saving = ref(false)
const error = ref('')
const success = ref('')
const adminCount = computed(() => users.value.filter((user) => user.systemRole === 'admin').length)
const userCount = computed(() => users.value.filter((user) => user.systemRole === 'user').length)
const localeCount = computed(() => new Set(users.value.map((user) => user.locale)).size)
const disabledCount = computed(() => users.value.filter((user) => user.deletedAt).length)

async function load() {
  const result = await listUsers()
  users.value = result.items
}

async function toggleUser(user: User) {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await updateUserStatus(user.id, !user.deletedAt)
    success.value = user.deletedAt ? '用户已启用' : '用户已禁用'
    await load()
  } catch (toggleError) {
    error.value = toggleError instanceof Error ? toggleError.message : '更新用户状态失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">admin users</p>
      <h1 class="text-4xl font-bold leading-tight">用户管理</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">查看注册用户和系统角色</p>
    </div>
    <section class="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="用户总数" :value="String(users.length)" />
      <MetricCard label="管理员" :value="String(adminCount)" />
      <MetricCard label="普通用户" :value="String(userCount)" />
      <MetricCard label="禁用/语言" :value="`${disabledCount}/${localeCount}`" />
    </section>
    <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
    <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>
    <section class="overflow-hidden border-t border-[var(--app-border)] bg-[var(--app-surface)]">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--app-subtle)] text-[var(--app-text)]">
          <tr>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">邮箱</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">昵称</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">角色</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">状态</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border-soft)]">
          <tr v-for="user in users" :key="user.id">
            <td class="px-4 py-3 font-mono text-xs font-bold">{{ user.email }}</td>
            <td class="px-4 py-3 font-bold">{{ user.nickname }}</td>
            <td class="px-4 py-3 font-mono text-xs font-extrabold">{{ user.systemRole }}</td>
            <td class="px-4 py-3 font-mono text-xs font-extrabold">{{ user.deletedAt ? 'disabled' : 'active' }}</td>
            <td class="px-4 py-3">
              <BaseButton size="sm" :variant="user.deletedAt ? 'secondary' : 'ghost'" :disabled="saving" @click="toggleUser(user)">
                {{ user.deletedAt ? '启用' : '禁用' }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
