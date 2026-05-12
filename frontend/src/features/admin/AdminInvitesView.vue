<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import MetricCard from '@/components/ui/MetricCard.vue'
import { createInvite, deleteInvite, listInvites, updateInvite, type Invite } from '@/services/admin.api'

const invites = ref<Invite[]>([])
const newCode = ref('')
const saving = ref(false)
const error = ref('')
const success = ref('')
const form = ref({
  maxUses: '1',
  expiresAt: '',
  allowedEmail: '',
  note: ''
})
const activeCount = computed(() => invites.value.filter((invite) => invite.status === 'active').length)
const usedCount = computed(() => invites.value.reduce((sum, invite) => sum + invite.usedCount, 0))
const capacityCount = computed(() => invites.value.reduce((sum, invite) => sum + invite.maxUses, 0))
const limitedEmailCount = computed(() => invites.value.filter((invite) => invite.allowedEmail).length)

async function load() {
  const result = await listInvites()
  invites.value = result.items
}

onMounted(load)

async function submit() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await createInvite({
      maxUses: Number(form.value.maxUses || 1),
      expiresAt: form.value.expiresAt ? new Date(`${form.value.expiresAt}T23:59:59.000Z`).toISOString() : null,
      allowedEmail: form.value.allowedEmail || null,
      inviteRole: 'user',
      note: form.value.note || null
    })
    newCode.value = result.invite.code || ''
    form.value.allowedEmail = ''
    form.value.expiresAt = ''
    form.value.note = ''
    success.value = '邀请码已创建'
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '创建邀请码失败'
  } finally {
    saving.value = false
  }
}

async function toggleInvite(invite: Invite) {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await updateInvite(invite.id, {
      status: invite.status === 'active' ? 'disabled' : 'active',
      expiresAt: invite.expiresAt,
      note: invite.note
    })
    success.value = invite.status === 'active' ? '邀请码已禁用' : '邀请码已启用'
    await load()
  } catch (toggleError) {
    error.value = toggleError instanceof Error ? toggleError.message : '更新邀请码失败'
  } finally {
    saving.value = false
  }
}

async function removeInvite(invite: Invite) {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await deleteInvite(invite.id)
    success.value = '邀请码已删除'
    await load()
  } catch (removeError) {
    error.value = removeError instanceof Error ? removeError.message : '删除邀请码失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">admin invites</p>
      <h1 class="text-4xl font-bold leading-tight">邀请码管理</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">创建和查看注册邀请码</p>
    </div>

    <section class="border-t border-[var(--app-border)] bg-[var(--app-surface)] py-4">
      <form class="grid gap-3 md:grid-cols-[120px_180px_1fr_1fr_auto]" @submit.prevent="submit">
        <BaseInput v-model="form.maxUses" type="number" placeholder="次数" />
        <BaseInput v-model="form.expiresAt" type="date" />
        <BaseInput v-model="form.allowedEmail" type="email" placeholder="限定邮箱，可选" />
        <BaseInput v-model="form.note" placeholder="备注" />
        <BaseButton type="submit" :disabled="saving">{{ saving ? '创建中' : '创建邀请码' }}</BaseButton>
      </form>
      <p v-if="newCode" class="mt-3 border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 font-mono text-sm font-extrabold text-[var(--app-text)]">
        新邀请码：{{ newCode }}
      </p>
      <p v-if="error" class="mt-3 border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
      <p v-else-if="success" class="mt-3 border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>
    </section>

    <section class="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="邀请码总数" :value="String(invites.length)" />
      <MetricCard label="启用中" :value="String(activeCount)" />
      <MetricCard label="使用容量" :value="`${usedCount}/${capacityCount}`" />
      <MetricCard label="限定邮箱" :value="String(limitedEmailCount)" />
    </section>

    <section class="overflow-hidden border-t border-[var(--app-border)] bg-[var(--app-surface)]">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--app-subtle)] text-[var(--app-text)]">
          <tr>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">状态</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">使用</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">有效期</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">限定邮箱</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">备注</th>
            <th class="border-b border-[var(--app-border)] px-4 py-3 font-extrabold">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--app-border-soft)]">
          <tr v-for="invite in invites" :key="invite.id">
            <td class="px-4 py-3 font-mono text-xs font-extrabold">{{ invite.status }}</td>
            <td class="px-4 py-3 font-mono text-xs font-extrabold">{{ invite.usedCount }}/{{ invite.maxUses }}</td>
            <td class="px-4 py-3 font-mono text-xs font-bold">{{ invite.expiresAt ? invite.expiresAt.slice(0, 10) : '-' }}</td>
            <td class="px-4 py-3 font-mono text-xs font-bold">{{ invite.allowedEmail || '-' }}</td>
            <td class="px-4 py-3 font-bold">{{ invite.note || '-' }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <BaseButton size="sm" :variant="invite.status === 'active' ? 'ghost' : 'secondary'" :disabled="saving" @click="toggleInvite(invite)">
                  {{ invite.status === 'active' ? '禁用' : '启用' }}
                </BaseButton>
                <BaseButton size="sm" variant="ghost" :disabled="saving || invite.usedCount > 0" @click="removeInvite(invite)">删除</BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
