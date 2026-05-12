<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Archive, CreditCard, Edit3, RefreshCw, WalletCards, X } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { archiveAccount, createAccount, listAccounts, recalculateAccountBalances, updateAccount } from '@/services/accounts.api'
import { useBookStore } from '@/stores/book.store'
import { formatMoney, parseMoneyToMinorUnit } from '@/utils/money'
import type { Account } from '@/types/domain'

const bookStore = useBookStore()
const accounts = ref<Account[]>([])
const selectedAccountId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const typeFilter = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const form = ref({
  name: '',
  type: 'cash',
  openingBalance: '0',
  includeInAssets: true,
  creditLimit: '',
  statementDay: '',
  repaymentDay: ''
})

const typeOptions = [
  { label: '现金', value: 'cash' },
  { label: '借记卡', value: 'debit_card' },
  { label: '信用卡', value: 'credit_card' },
  { label: '电子钱包', value: 'ewallet' },
  { label: '储蓄', value: 'savings' },
  { label: '投资', value: 'investment' },
  { label: '其他', value: 'other' }
]
const filterTypeOptions = computed(() => [{ label: '全部账户', value: '' }, ...typeOptions])
const filteredAccounts = computed(() => accounts.value.filter((account) => !typeFilter.value || account.type === typeFilter.value))
const selectedAccount = computed(() => accounts.value.find((account) => account.id === selectedAccountId.value) ?? accounts.value[0] ?? null)
const totalBalance = computed(() => accounts.value.reduce((sum, account) => sum + account.cachedBalance, 0))
const includedBalance = computed(() => accounts.value.filter((account) => account.includeInAssets).reduce((sum, account) => sum + account.cachedBalance, 0))
const includedCount = computed(() => accounts.value.filter((account) => account.includeInAssets).length)
const cardCount = computed(() => accounts.value.filter((account) => account.type === 'credit_card' || account.type === 'debit_card').length)
const liability = computed(() => accounts.value.reduce((sum, account) => (account.cachedBalance < 0 ? sum + Math.abs(account.cachedBalance) : sum), 0))
const currency = computed(() => bookStore.currentBook?.defaultCurrency || 'CNY')
const isCreditCard = computed(() => form.value.type === 'credit_card')
const formTitle = computed(() => (editingId.value ? '编辑账户' : '新建账户'))

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const previousSelection = selectedAccountId.value
    const result = await listAccounts(bookStore.currentBookId)
    accounts.value = result.items
    selectedAccountId.value = result.items.some((account) => account.id === previousSelection) ? previousSelection : result.items[0]?.id ?? null
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    type: 'cash',
    openingBalance: '0',
    includeInAssets: true,
    creditLimit: '',
    statementDay: '',
    repaymentDay: ''
  }
  error.value = ''
}

function edit(account: Account) {
  selectedAccountId.value = account.id
  editingId.value = account.id
  form.value = {
    name: account.name,
    type: account.type,
    openingBalance: String(account.openingBalance / 100),
    includeInAssets: account.includeInAssets,
    creditLimit: account.creditLimit == null ? '' : String(account.creditLimit / 100),
    statementDay: account.statementDay == null ? '' : String(account.statementDay),
    repaymentDay: account.repaymentDay == null ? '' : String(account.repaymentDay)
  }
  error.value = ''
  success.value = ''
}

function readNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function accountTypeLabel(type: string) {
  return typeOptions.find((option) => option.value === type)?.label || type
}

function selectAccount(account: Account) {
  selectedAccountId.value = account.id
}

async function submit() {
  if (!bookStore.currentBookId) {
    return
  }
  const name = form.value.name.trim()
  if (!name) {
    error.value = '请输入账户名称'
    return
  }

  const openingBalance = parseMoneyToMinorUnit(form.value.openingBalance)
  if (openingBalance == null) {
    error.value = '请输入有效初始余额'
    return
  }

  const statementDay = readNullableNumber(form.value.statementDay)
  const repaymentDay = readNullableNumber(form.value.repaymentDay)
  if (isCreditCard.value && ((statementDay != null && (statementDay < 1 || statementDay > 31)) || (repaymentDay != null && (repaymentDay < 1 || repaymentDay > 31)))) {
    error.value = '账单日和还款日必须在 1 到 31 之间'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const creditLimit = form.value.creditLimit.trim() ? parseMoneyToMinorUnit(form.value.creditLimit) : null
    const input = {
      name,
      type: form.value.type,
      currency: currency.value,
      openingBalance,
      icon: 'wallet',
      color: '#111111',
      includeInAssets: form.value.includeInAssets,
      creditLimit: isCreditCard.value ? creditLimit ?? null : null,
      statementDay: isCreditCard.value ? statementDay : null,
      repaymentDay: isCreditCard.value ? repaymentDay : null
    }
    if (editingId.value) {
      await updateAccount(bookStore.currentBookId, editingId.value, input)
      selectedAccountId.value = editingId.value
      success.value = '账户已更新'
    } else {
      const result = await createAccount(bookStore.currentBookId, input)
      selectedAccountId.value = result.account.id
      success.value = '账户已创建'
    }
    resetForm()
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存账户失败'
  } finally {
    saving.value = false
  }
}

async function archive(account: Account) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await archiveAccount(bookStore.currentBookId, account.id)
    if (editingId.value === account.id) {
      resetForm()
    }
    success.value = '账户已归档'
    await load()
  } catch (archiveError) {
    error.value = archiveError instanceof Error ? archiveError.message : '归档账户失败'
  } finally {
    saving.value = false
  }
}

async function recalculate() {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await recalculateAccountBalances(bookStore.currentBookId)
    success.value = `已重算 ${result.repaired} 个账户余额`
    await load()
  } catch (recalculateError) {
    error.value = recalculateError instanceof Error ? recalculateError.message : '重算余额失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="grid gap-3 xl:h-[calc(100vh-4.5rem)] xl:min-h-[720px] xl:grid-cols-[286px_minmax(360px,520px)_minmax(420px,1fr)]">
    <aside class="min-h-0 space-y-3 overflow-y-auto">
      <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">accounts</p>
        <h1 class="mt-1 text-xl font-extrabold">账户工作台</h1>
        <p class="mt-2 text-xs font-bold leading-5 text-[var(--app-muted)]">余额、账户类型、信用卡周期和账户维护集中在当前屏幕。</p>
      </section>

      <section class="grid grid-cols-2 border-l border-t border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="border-b border-r border-[var(--app-border)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">账户</p>
          <p class="mt-1 font-mono text-lg font-extrabold">{{ accounts.length }}</p>
        </div>
        <div class="border-b border-r border-[var(--app-border)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">计入资产</p>
          <p class="mt-1 font-mono text-lg font-extrabold">{{ includedCount }}</p>
        </div>
        <div class="border-b border-r border-[var(--app-border)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">卡类</p>
          <p class="mt-1 font-mono text-lg font-extrabold">{{ cardCount }}</p>
        </div>
        <div class="border-b border-r border-[var(--app-border)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">负债</p>
          <p class="mt-1 truncate font-mono text-sm font-extrabold text-expense">{{ formatMoney(liability, currency) }}</p>
        </div>
      </section>

      <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <p class="text-sm font-extrabold">账户余额</p>
        <p class="mt-2 truncate font-mono text-2xl font-extrabold">{{ formatMoney(totalBalance, currency) }}</p>
        <div class="mt-3 border-t border-[var(--app-border-soft)] pt-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">计入资产余额</p>
          <p class="mt-1 truncate font-mono text-lg font-extrabold">{{ formatMoney(includedBalance, currency) }}</p>
        </div>
      </section>

      <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="mb-2 flex items-center gap-2">
          <WalletCards class="h-4 w-4 text-[var(--app-muted)]" />
          <h2 class="text-sm font-extrabold">筛选</h2>
        </div>
        <BaseSelect v-model="typeFilter" :options="filterTypeOptions" />
        <BaseButton class="mt-2 w-full" variant="secondary" :disabled="saving" @click="recalculate">
          <RefreshCw class="h-4 w-4" />
          重算余额
        </BaseButton>
      </section>
    </aside>

    <section class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <header class="flex h-12 items-center justify-between border-b border-[var(--app-border)] px-3">
        <div>
          <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">list</p>
          <h2 class="text-sm font-extrabold">账户列表</h2>
        </div>
        <p class="font-mono text-xs font-extrabold text-[var(--app-muted)]">{{ loading ? 'loading' : `${filteredAccounts.length} rows` }}</p>
      </header>

      <div class="max-h-[520px] overflow-y-auto xl:h-[calc(100%-3rem)] xl:max-h-none">
        <button
          v-for="account in filteredAccounts"
          :key="account.id"
          type="button"
          class="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 border-b border-[var(--app-border-soft)] px-3 py-2 text-left transition hover:bg-[var(--app-subtle)]"
          :class="{ 'bg-[var(--app-subtle)]': selectedAccount?.id === account.id }"
          @click="selectAccount(account)"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-extrabold">{{ account.name }}</span>
            <span class="mt-1 block truncate font-mono text-[11px] font-bold text-[var(--app-muted)]">
              {{ accountTypeLabel(account.type) }} / {{ account.includeInAssets ? '计入资产' : '不计资产' }}
            </span>
          </span>
          <span class="min-w-28 text-right">
            <span class="block truncate font-mono text-sm font-extrabold" :class="{ 'text-expense': account.cachedBalance < 0 }">
              {{ formatMoney(account.cachedBalance, account.currency) }}
            </span>
            <span class="mt-1 block font-mono text-[11px] font-bold text-[var(--app-muted)]">{{ account.currency }}</span>
          </span>
        </button>
        <p v-if="!loading && filteredAccounts.length === 0" class="px-3 py-10 text-center text-sm font-bold text-[var(--app-muted)]">暂无账户</p>
      </div>
    </section>

    <aside class="min-h-0 space-y-3 overflow-y-auto">
    <section class="min-h-[360px] overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)] xl:min-h-0">
      <template v-if="selectedAccount">
        <header class="flex h-12 items-center justify-between gap-3 border-b border-[var(--app-border)] px-3">
          <div class="min-w-0">
            <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">detail</p>
            <h2 class="truncate text-sm font-extrabold">{{ selectedAccount.name }}</h2>
          </div>
          <p class="truncate font-mono text-lg font-extrabold" :class="{ 'text-expense': selectedAccount.cachedBalance < 0 }">
            {{ formatMoney(selectedAccount.cachedBalance, selectedAccount.currency) }}
          </p>
        </header>

        <div class="grid grid-cols-2 border-b border-[var(--app-border)] 2xl:grid-cols-4">
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">类型</p>
            <p class="mt-1 text-sm font-extrabold">{{ accountTypeLabel(selectedAccount.type) }}</p>
          </div>
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">币种</p>
            <p class="mt-1 font-mono text-sm font-extrabold">{{ selectedAccount.currency }}</p>
          </div>
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">初始余额</p>
            <p class="mt-1 truncate font-mono text-sm font-extrabold">{{ formatMoney(selectedAccount.openingBalance, selectedAccount.currency) }}</p>
          </div>
          <div class="border-b border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">资产口径</p>
            <p class="mt-1 text-sm font-extrabold">{{ selectedAccount.includeInAssets ? '计入' : '不计入' }}</p>
          </div>
        </div>

        <div class="space-y-3 p-3">
          <div class="grid grid-cols-2 gap-px bg-[var(--app-border-soft)] p-px">
            <div class="bg-[var(--app-surface)] p-3">
              <p class="text-[10px] font-bold text-[var(--app-muted)]">信用额度</p>
              <p class="mt-1 truncate font-mono text-sm font-extrabold">
                {{ selectedAccount.creditLimit == null ? '-' : formatMoney(selectedAccount.creditLimit, selectedAccount.currency) }}
              </p>
            </div>
            <div class="bg-[var(--app-surface)] p-3">
              <p class="text-[10px] font-bold text-[var(--app-muted)]">账单 / 还款日</p>
              <p class="mt-1 truncate font-mono text-sm font-extrabold">
                {{ selectedAccount.statementDay || '-' }} / {{ selectedAccount.repaymentDay || '-' }}
              </p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <BaseButton variant="secondary" @click="edit(selectedAccount)">
              <Edit3 class="h-4 w-4" />
              编辑
            </BaseButton>
            <BaseButton variant="ghost" :disabled="saving" @click="archive(selectedAccount)">
              <Archive class="h-4 w-4" />
              归档
            </BaseButton>
          </div>
        </div>
      </template>
      <div v-else class="flex h-full min-h-[360px] items-center justify-center p-6 text-center">
        <div>
          <CreditCard class="mx-auto mb-3 h-10 w-10 text-[var(--app-muted)]" />
          <p class="text-sm font-extrabold text-[var(--app-muted)]">选择一个账户查看详情</p>
        </div>
      </div>
    </section>

    <section class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <form class="h-full overflow-y-auto" @submit.prevent="submit">
        <header class="flex h-12 items-center justify-between border-b border-[var(--app-border)] px-3">
          <div>
            <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">form</p>
            <h2 class="text-sm font-extrabold">{{ formTitle }}</h2>
          </div>
          <BaseButton v-if="editingId" variant="ghost" size="sm" @click="resetForm">
            <X class="h-4 w-4" />
          </BaseButton>
        </header>

        <div class="space-y-3 p-3">
          <BaseInput v-model="form.name" placeholder="账户名称，如：支付宝、招商银行" />
          <BaseSelect v-model="form.type" :options="typeOptions" />
          <BaseInput v-model="form.openingBalance" inputmode="decimal" placeholder="初始余额" />
          <label class="flex h-10 items-center gap-2 border border-[var(--app-border)] px-3 text-sm font-bold">
            <input v-model="form.includeInAssets" type="checkbox" class="h-4 w-4" />
            计入资产
          </label>
          <template v-if="isCreditCard">
            <BaseInput v-model="form.creditLimit" inputmode="decimal" placeholder="信用额度" />
            <div class="grid grid-cols-2 gap-2">
              <BaseInput v-model="form.statementDay" inputmode="numeric" placeholder="账单日" />
              <BaseInput v-model="form.repaymentDay" inputmode="numeric" placeholder="还款日" />
            </div>
          </template>
          <BaseButton type="submit" class="w-full" :disabled="saving">
            <WalletCards class="h-4 w-4" />
            {{ saving ? '保存中' : editingId ? '保存修改' : '新建账户' }}
          </BaseButton>
          <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
          <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>
        </div>
      </form>
    </section>
    </aside>
  </div>
</template>
