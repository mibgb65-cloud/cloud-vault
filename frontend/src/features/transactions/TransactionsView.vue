<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArchiveRestore, CalendarDays, Edit3, Filter, Search, Trash2, WalletCards, X } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { listAccounts } from '@/services/accounts.api'
import { listCategories } from '@/services/categories.api'
import { createTransaction, deleteTransaction, listTransactions, restoreTransaction, updateTransaction } from '@/services/transactions.api'
import { useBookStore } from '@/stores/book.store'
import { dateTimeInputToIso, dateTimeInputValue, dateTimeInputValueFromIso } from '@/utils/date'
import { formatMoney, parseMoneyToMinorUnit } from '@/utils/money'
import type { Account, Category, Transaction, TransactionType } from '@/types/domain'

const bookStore = useBookStore()
const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const transactions = ref<Transaction[]>([])
const selectedTransactionId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const filters = ref({
  keyword: '',
  type: '',
  accountId: '',
  categoryId: '',
  dateFrom: '',
  dateTo: '',
  includeDeleted: false
})
const form = ref({
  type: 'expense' as TransactionType,
  amount: '',
  accountId: '',
  transferAccountId: '',
  categoryId: '',
  date: dateTimeInputValue(),
  note: '',
  merchantName: ''
})

const typeOptions = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' },
  { label: '转账', value: 'transfer' }
]
const filterTypeOptions = [{ label: '全部类型', value: '' }, ...typeOptions]
const accountOptions = computed(() => accounts.value.map((account) => ({ label: account.name, value: account.id })))
const filterAccountOptions = computed(() => [{ label: '全部账户', value: '' }, ...accountOptions.value])
const categoryOptions = computed(() =>
  categories.value
    .filter((category) => category.type === form.value.type)
    .map((category) => ({ label: category.name, value: category.id }))
)
const filterCategoryOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...categories.value.map((category) => ({ label: `${category.type === 'expense' ? '支出' : '收入'} / ${category.name}`, value: category.id }))
])
const activeTransactions = computed(() => transactions.value.filter((item) => !item.deletedAt))
const visibleExpense = computed(() => activeTransactions.value.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0))
const visibleIncome = computed(() => activeTransactions.value.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0))
const deletedCount = computed(() => transactions.value.filter((item) => item.deletedAt).length)
const visibleTransferCount = computed(() => activeTransactions.value.filter((item) => item.type === 'transfer').length)
const currency = computed(() => bookStore.currentBook?.defaultCurrency || 'CNY')
const formTitle = computed(() => (editingId.value ? '编辑账单' : '新建账单'))
const selectedTransaction = computed(() => transactions.value.find((item) => item.id === selectedTransactionId.value) ?? null)

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.keyword.trim()) {
      params.set('keyword', filters.value.keyword.trim())
    }
    if (filters.value.type) {
      params.set('type', filters.value.type)
    }
    if (filters.value.accountId) {
      params.set('accountId', filters.value.accountId)
    }
    if (filters.value.categoryId) {
      params.set('categoryId', filters.value.categoryId)
    }
    if (filters.value.dateFrom) {
      params.set('dateFrom', filters.value.dateFrom)
    }
    if (filters.value.dateTo) {
      params.set('dateTo', filters.value.dateTo)
    }
    if (filters.value.includeDeleted) {
      params.set('includeDeleted', 'true')
    }
    params.set('pageSize', '100')

    const previousSelection = selectedTransactionId.value
    const [accountResult, expenseCategories, incomeCategories, transactionResult] = await Promise.all([
      listAccounts(bookStore.currentBookId),
      listCategories(bookStore.currentBookId, 'expense'),
      listCategories(bookStore.currentBookId, 'income'),
      listTransactions(bookStore.currentBookId, params)
    ])
    accounts.value = accountResult.items
    categories.value = [...expenseCategories.items, ...incomeCategories.items]
    transactions.value = transactionResult.items
    selectedTransactionId.value = transactionResult.items.some((item) => item.id === previousSelection) ? previousSelection : null
    ensureFormDefaults()
  } finally {
    loading.value = false
  }
}

function ensureFormDefaults() {
  if (!accounts.value.some((account) => account.id === form.value.accountId)) {
    form.value.accountId = accounts.value[0]?.id || ''
  }
  if (form.value.type === 'transfer') {
    const target = accounts.value.find((account) => account.id !== form.value.accountId)
    if (!accounts.value.some((account) => account.id === form.value.transferAccountId) || form.value.transferAccountId === form.value.accountId) {
      form.value.transferAccountId = target?.id || ''
    }
    form.value.categoryId = ''
    return
  }
  if (!categoryOptions.value.some((option) => option.value === form.value.categoryId)) {
    form.value.categoryId = categoryOptions.value[0]?.value || ''
  }
  form.value.transferAccountId = ''
}

function resetForm() {
  editingId.value = null
  form.value = {
    type: 'expense',
    amount: '',
    accountId: accounts.value[0]?.id || '',
    transferAccountId: accounts.value[1]?.id || '',
    categoryId: categories.value.find((category) => category.type === 'expense')?.id || '',
    date: dateTimeInputValue(),
    note: '',
    merchantName: ''
  }
  error.value = ''
  ensureFormDefaults()
}

function edit(item: Transaction) {
  selectedTransactionId.value = item.id
  editingId.value = item.id
  form.value = {
    type: item.type,
    amount: String(item.amount / 100),
    accountId: item.accountId,
    transferAccountId: item.transferAccountId || '',
    categoryId: item.categoryId || '',
    date: dateTimeInputValueFromIso(item.occurredAt),
    note: item.note || '',
    merchantName: item.merchantName || ''
  }
  error.value = ''
  success.value = ''
  ensureFormDefaults()
}

function transactionTitle(item: Transaction) {
  return item.note || item.merchantName || item.categoryName || typeLabel(item.type)
}

function typeLabel(type: TransactionType) {
  if (type === 'expense') {
    return '支出'
  }
  if (type === 'income') {
    return '收入'
  }
  return '转账'
}

function amountPrefix(type: TransactionType) {
  return type === 'expense' ? '-' : type === 'income' ? '+' : ''
}

function padTimePart(value: number) {
  return String(value).padStart(2, '0')
}

function formatOccurrenceMinute(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16).replace('T', ' ')
  }
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`
}

function formatOccurrenceShort(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(5, 16).replace('T', ' ')
  }
  return `${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`
}

function clearSelection() {
  const currentSelection = selectedTransactionId.value
  selectedTransactionId.value = null
  if (currentSelection && editingId.value === currentSelection) {
    resetForm()
  }
}

function selectTransaction(item: Transaction) {
  if (selectedTransactionId.value === item.id) {
    clearSelection()
    return
  }
  selectedTransactionId.value = item.id
}

async function submit() {
  if (!bookStore.currentBookId) {
    return
  }
  ensureFormDefaults()
  const amount = parseMoneyToMinorUnit(form.value.amount)
  if (!amount || amount <= 0) {
    error.value = '请输入有效金额'
    return
  }
  if (!form.value.accountId) {
    error.value = '请选择账户'
    return
  }
  if (form.value.type === 'transfer') {
    if (!form.value.transferAccountId || form.value.transferAccountId === form.value.accountId) {
      error.value = '请选择不同的转入账户'
      return
    }
  } else if (!form.value.categoryId) {
    error.value = '请选择分类'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const input = {
      type: form.value.type,
      amount,
      accountId: form.value.accountId,
      transferAccountId: form.value.type === 'transfer' ? form.value.transferAccountId : null,
      categoryId: form.value.type === 'transfer' ? null : form.value.categoryId,
      currency: currency.value,
      occurredAt: dateTimeInputToIso(form.value.date),
      note: form.value.note || null,
      merchantName: form.value.merchantName || null,
      tagIds: []
    }
    const result = editingId.value
      ? await updateTransaction(bookStore.currentBookId, editingId.value, input)
      : await createTransaction(bookStore.currentBookId, input)
    selectedTransactionId.value = result.transaction.id
    success.value = editingId.value ? '账单已更新' : '账单已创建'
    resetForm()
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存账单失败'
  } finally {
    saving.value = false
  }
}

async function remove(transactionId: string) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await deleteTransaction(bookStore.currentBookId, transactionId)
    success.value = '账单已删除，可开启“含已删除”后恢复'
    await load()
  } catch (removeError) {
    error.value = removeError instanceof Error ? removeError.message : '删除账单失败'
  } finally {
    saving.value = false
  }
}

async function restore(transactionId: string) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await restoreTransaction(bookStore.currentBookId, transactionId)
    success.value = '账单已恢复'
    selectedTransactionId.value = transactionId
    await load()
  } catch (restoreError) {
    error.value = restoreError instanceof Error ? restoreError.message : '恢复账单失败'
  } finally {
    saving.value = false
  }
}

function clearFilters() {
  filters.value = {
    keyword: '',
    type: '',
    accountId: '',
    categoryId: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false
  }
  void load()
}

watch(
  () => form.value.type,
  () => ensureFormDefaults()
)
watch(
  () => form.value.accountId,
  () => ensureFormDefaults()
)
onMounted(load)
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="grid gap-3 xl:h-[calc(100vh-4.5rem)] xl:min-h-[720px] xl:grid-cols-[280px_minmax(420px,620px)_minmax(420px,1fr)] 2xl:grid-cols-[286px_minmax(460px,680px)_minmax(460px,1fr)]">
    <aside class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <section class="border-b border-[var(--app-border)] p-3">
        <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">ledger</p>
        <h1 class="mt-1 text-xl font-extrabold">账单工作台</h1>
        <p class="mt-2 text-xs font-bold leading-5 text-[var(--app-muted)]">左侧筛选，中间流水，右侧记录和处理当前账单。</p>
      </section>

      <section class="grid grid-cols-2 border-b border-[var(--app-border)]">
        <div class="border-b border-r border-[var(--app-border-soft)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">列表</p>
          <p class="mt-1 font-mono text-lg font-extrabold">{{ transactions.length }}</p>
        </div>
        <div class="border-b border-[var(--app-border-soft)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">转账</p>
          <p class="mt-1 font-mono text-lg font-extrabold">{{ visibleTransferCount }}</p>
        </div>
        <div class="border-r border-[var(--app-border-soft)] p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">收入</p>
          <p class="mt-1 truncate font-mono text-sm font-extrabold text-income">{{ formatMoney(visibleIncome, currency) }}</p>
        </div>
        <div class="p-3">
          <p class="text-[11px] font-bold text-[var(--app-muted)]">支出</p>
          <p class="mt-1 truncate font-mono text-sm font-extrabold text-expense">{{ formatMoney(visibleExpense, currency) }}</p>
        </div>
      </section>

      <section>
        <div class="flex h-10 items-center gap-2 border-b border-[var(--app-border)] px-3">
          <Filter class="h-4 w-4 text-[var(--app-muted)]" />
          <h2 class="text-sm font-extrabold">筛选</h2>
        </div>
        <form class="space-y-2 overflow-y-auto p-3 xl:max-h-[calc(100vh-20rem)]" @submit.prevent="load">
          <label class="flex h-10 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[var(--app-muted)]">
            <Search class="h-4 w-4" />
            <input
              v-model="filters.keyword"
              class="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
              placeholder="备注 / 商户"
            />
          </label>
          <BaseSelect v-model="filters.type" :options="filterTypeOptions" />
          <BaseSelect v-model="filters.accountId" :options="filterAccountOptions" />
          <BaseSelect v-model="filters.categoryId" :options="filterCategoryOptions" />
          <div class="grid grid-cols-2 gap-2">
            <BaseInput v-model="filters.dateFrom" type="date" />
            <BaseInput v-model="filters.dateTo" type="date" />
          </div>
          <label class="flex h-10 items-center gap-2 border border-[var(--app-border)] px-3 text-sm font-bold">
            <input v-model="filters.includeDeleted" type="checkbox" class="h-4 w-4" />
            含已删除 {{ deletedCount }}
          </label>
          <div class="grid grid-cols-2 gap-2">
            <BaseButton type="submit" :disabled="loading">应用</BaseButton>
            <BaseButton variant="ghost" @click="clearFilters">清空</BaseButton>
          </div>
        </form>
      </section>
    </aside>

    <section class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <header class="flex h-12 items-center justify-between border-b border-[var(--app-border)] px-3">
        <div>
          <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">records</p>
          <h2 class="text-sm font-extrabold">账单列表</h2>
        </div>
        <p class="font-mono text-xs font-extrabold text-[var(--app-muted)]">{{ loading ? 'loading' : `${transactions.length} rows` }}</p>
      </header>

      <div class="max-h-[520px] overflow-y-auto xl:h-[calc(100%-3rem)] xl:max-h-none">
        <button
          v-for="item in transactions"
          :key="item.id"
          type="button"
          class="grid w-full cursor-pointer grid-cols-[5.75rem_minmax(0,1fr)_8rem] items-center gap-3 border-b border-[var(--app-border-soft)] px-3 py-2 text-left transition hover:bg-[var(--app-subtle)]"
          :class="{ 'bg-[var(--app-subtle)]': selectedTransaction?.id === item.id, 'opacity-60': item.deletedAt }"
          @click="selectTransaction(item)"
        >
          <span class="min-w-0">
            <span class="block font-mono text-xs font-extrabold">{{ formatOccurrenceShort(item.occurredAt) }}</span>
            <span class="mt-1 inline-flex border border-[var(--app-border-soft)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--app-muted)]">
              {{ typeLabel(item.type) }}
            </span>
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-extrabold">{{ transactionTitle(item) }}</span>
              <span v-if="item.deletedAt" class="border border-[var(--app-border)] px-1.5 py-0.5 font-mono text-[10px] font-extrabold">DEL</span>
            </span>
            <span class="mt-1 block truncate font-mono text-[11px] font-bold text-[var(--app-muted)]">
              {{ formatOccurrenceMinute(item.occurredAt) }} / {{ item.accountName || '账户' }}
              <span v-if="item.transferAccountName"> -> {{ item.transferAccountName }}</span>
              <span v-else-if="item.categoryName"> / {{ item.categoryName }}</span>
            </span>
          </span>
          <span class="min-w-0 text-right">
            <span
              class="block truncate font-mono text-sm font-extrabold"
              :class="{ 'text-expense': item.type === 'expense', 'text-income': item.type === 'income' }"
            >
              {{ amountPrefix(item.type) }}{{ formatMoney(item.amount, item.currency) }}
            </span>
            <span class="mt-1 block truncate text-[11px] font-bold text-[var(--app-muted)]">{{ item.merchantName || item.categoryName || item.accountName || '-' }}</span>
          </span>
        </button>
        <p v-if="!loading && transactions.length === 0" class="px-3 py-10 text-center text-sm font-bold text-[var(--app-muted)]">暂无账单</p>
      </div>
    </section>

    <aside class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <div class="h-full overflow-y-auto">
        <form v-if="!selectedTransaction || editingId" class="flex min-h-full flex-col" @submit.prevent="submit">
        <header class="flex h-12 items-center justify-between border-b border-[var(--app-border)] px-3">
          <div>
            <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">entry</p>
            <h2 class="text-sm font-extrabold">{{ formTitle }}</h2>
          </div>
          <BaseButton v-if="editingId" variant="ghost" size="sm" @click="resetForm">
            <X class="h-4 w-4" />
          </BaseButton>
        </header>

        <div class="flex-1 space-y-3 p-3">
          <section class="border border-[var(--app-border-soft)] bg-[var(--app-subtle)] p-3">
            <p class="mb-2 font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">type</p>
            <div class="grid grid-cols-3 gap-px bg-[var(--app-border-soft)] p-px">
              <button
                v-for="option in typeOptions"
                :key="option.value"
                type="button"
                class="h-10 cursor-pointer bg-[var(--app-surface)] px-2 text-xs font-extrabold text-[var(--app-muted)] transition hover:bg-[var(--app-subtle-strong)]"
                :class="{ '!bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]': form.type === option.value }"
                @click="form.type = option.value as TransactionType"
              >
                {{ option.label }}
              </button>
            </div>
          </section>

          <section class="space-y-3 border border-[var(--app-border-soft)] p-3">
            <label class="block space-y-2">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">amount</span>
              <BaseInput v-model="form.amount" class="h-14 font-mono text-2xl font-extrabold" inputmode="decimal" placeholder="0.00" />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block space-y-2">
                <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">time</span>
                <span class="flex h-10 items-center gap-2 border border-[var(--app-border)] px-3">
                  <CalendarDays class="h-4 w-4 text-[var(--app-muted)]" />
                  <input v-model="form.date" type="datetime-local" class="min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--app-text)] outline-none" />
                </span>
              </label>
              <label class="block space-y-2">
                <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">merchant</span>
                <BaseInput v-model="form.merchantName" placeholder="商户" />
              </label>
            </div>
          </section>

          <section class="grid gap-3 border border-[var(--app-border-soft)] p-3 sm:grid-cols-2">
            <label class="block space-y-2">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">account</span>
              <BaseSelect v-model="form.accountId" :options="accountOptions" />
            </label>
            <label class="block space-y-2">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">{{ form.type === 'transfer' ? 'target' : 'category' }}</span>
              <BaseSelect v-if="form.type === 'transfer'" v-model="form.transferAccountId" :options="accountOptions" />
              <BaseSelect v-else v-model="form.categoryId" :options="categoryOptions" />
            </label>
          </section>

          <section class="space-y-3 border border-[var(--app-border-soft)] p-3">
            <label class="block space-y-2">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">note</span>
              <textarea
                v-model="form.note"
                class="min-h-24 w-full resize-none border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-bold leading-6 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:shadow-[0_0_0_1px_var(--app-border)]"
                placeholder="备注"
              />
            </label>
          </section>
        </div>

        <footer class="sticky bottom-0 space-y-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] p-3">
          <BaseButton type="submit" class="w-full" :disabled="saving">
            <WalletCards class="h-4 w-4" />
            {{ saving ? '保存中' : editingId ? '保存修改' : '保存账单' }}
          </BaseButton>
          <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
          <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>
        </footer>
        </form>

        <section v-if="selectedTransaction && !editingId">
            <header class="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-3 py-3">
              <div class="min-w-0">
                <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">selected</p>
                <h2 class="mt-1 truncate text-sm font-extrabold">{{ transactionTitle(selectedTransaction) }}</h2>
              </div>
              <div class="flex shrink-0 items-start gap-2">
                <p
                  class="max-w-32 truncate text-right font-mono text-base font-extrabold"
                  :class="{ 'text-expense': selectedTransaction.type === 'expense', 'text-income': selectedTransaction.type === 'income' }"
                >
                  {{ amountPrefix(selectedTransaction.type) }}{{ formatMoney(selectedTransaction.amount, selectedTransaction.currency) }}
                </p>
                <BaseButton variant="ghost" size="sm" title="取消选中" @click="clearSelection">
                  <X class="h-4 w-4" />
                </BaseButton>
              </div>
            </header>

            <div class="grid grid-cols-2 border-b border-[var(--app-border-soft)]">
              <div class="border-r border-[var(--app-border-soft)] p-3">
                <p class="text-[10px] font-bold text-[var(--app-muted)]">时间</p>
                <p class="mt-1 font-mono text-sm font-extrabold">{{ formatOccurrenceMinute(selectedTransaction.occurredAt) }}</p>
              </div>
              <div class="p-3">
                <p class="text-[10px] font-bold text-[var(--app-muted)]">类型</p>
                <p class="mt-1 text-sm font-extrabold">{{ typeLabel(selectedTransaction.type) }}</p>
              </div>
              <div class="border-r border-t border-[var(--app-border-soft)] p-3">
                <p class="text-[10px] font-bold text-[var(--app-muted)]">账户</p>
                <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.accountName || '-' }}</p>
              </div>
              <div class="border-t border-[var(--app-border-soft)] p-3">
                <p class="text-[10px] font-bold text-[var(--app-muted)]">分类</p>
                <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.categoryName || selectedTransaction.transferAccountName || '-' }}</p>
              </div>
            </div>

            <div class="space-y-3 p-3">
              <div class="border border-[var(--app-border-soft)] p-3">
                <p class="text-[10px] font-bold text-[var(--app-muted)]">备注</p>
                <p class="mt-2 min-h-24 whitespace-pre-wrap break-words text-sm font-bold leading-6">{{ selectedTransaction.note || '未填写备注' }}</p>
              </div>
              <div class="grid grid-cols-2 gap-px bg-[var(--app-border-soft)] p-px">
                <div class="bg-[var(--app-surface)] p-3">
                  <p class="text-[10px] font-bold text-[var(--app-muted)]">商户</p>
                  <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.merchantName || '-' }}</p>
                </div>
                <div class="bg-[var(--app-surface)] p-3">
                  <p class="text-[10px] font-bold text-[var(--app-muted)]">标签</p>
                  <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.tagIds.length }} 个</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <BaseButton variant="secondary" @click="edit(selectedTransaction)">
                  <Edit3 class="h-4 w-4" />
                  编辑
                </BaseButton>
                <BaseButton v-if="selectedTransaction.deletedAt" variant="secondary" :disabled="saving" @click="restore(selectedTransaction.id)">
                  <ArchiveRestore class="h-4 w-4" />
                  恢复
                </BaseButton>
                <BaseButton v-else variant="ghost" :disabled="saving" @click="remove(selectedTransaction.id)">
                  <Trash2 class="h-4 w-4" />
                  删除
                </BaseButton>
              </div>
            </div>
        </section>
      </div>
    </aside>
  </div>
</template>
