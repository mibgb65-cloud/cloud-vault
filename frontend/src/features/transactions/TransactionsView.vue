<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArchiveRestore, CalendarDays, Download, Edit3, Filter, Search, Tags, Trash2, Upload, WalletCards, X } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { listAccounts } from '@/services/accounts.api'
import { listCategories } from '@/services/categories.api'
import { listTags } from '@/services/tags.api'
import {
  batchDeleteTransactions,
  batchUpdateTransactionCategory,
  createTransaction,
  deleteTransaction,
  importTransactions,
  listTransactions,
  restoreTransaction,
  updateTransaction
} from '@/services/transactions.api'
import { useBookStore } from '@/stores/book.store'
import { dateTimeInputToIso, dateTimeInputValue, dateTimeInputValueFromIso } from '@/utils/date'
import { formatMoney, parseMoneyToMinorUnit } from '@/utils/money'
import { parseStatementFile, type StatementImportDraft } from '@/utils/statementImport'
import type { Account, Category, Tag, Transaction, TransactionType } from '@/types/domain'

const bookStore = useBookStore()
const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const transactions = ref<Transaction[]>([])
const selectedTransactionId = ref<string | null>(null)
const selectedIds = ref<string[]>([])
const editingId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const importSaving = ref(false)
const hasMore = ref(false)
const currentPage = ref(1)
const error = ref('')
const success = ref('')
const importDrafts = ref<StatementImportDraft[]>([])
const importFileName = ref('')
const importAccountId = ref('')
const importExpenseCategoryId = ref('')
const importIncomeCategoryId = ref('')
const filters = ref({
  keyword: '',
  type: '',
  accountId: '',
  categoryId: '',
  tagId: '',
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
  merchantName: '',
  tagIds: [] as string[]
})
const batchCategoryId = ref('')
const pageSize = 50

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
const importExpenseCategoryOptions = computed(() =>
  categories.value.filter((category) => category.type === 'expense').map((category) => ({ label: category.name, value: category.id }))
)
const importIncomeCategoryOptions = computed(() =>
  categories.value.filter((category) => category.type === 'income').map((category) => ({ label: category.name, value: category.id }))
)
const filterCategoryOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...categories.value.map((category) => ({ label: `${category.type === 'expense' ? '支出' : '收入'} / ${category.name}`, value: category.id }))
])
const tagOptions = computed(() => tags.value.map((tag) => ({ label: tag.name, value: tag.id })))
const filterTagOptions = computed(() => [{ label: '全部标签', value: '' }, ...tagOptions.value])
const tagMap = computed(() => new Map(tags.value.map((tag) => [tag.id, tag])))
const batchCategoryOptions = computed(() => [
  { label: '选择目标分类', value: '' },
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
const selectedCount = computed(() => selectedIds.value.length)
const selectedTransactions = computed(() => transactions.value.filter((item) => selectedIds.value.includes(item.id)))
const selectedNonTransferCount = computed(() => selectedTransactions.value.filter((item) => item.type !== 'transfer' && !item.deletedAt).length)
const canBatchDelete = computed(() => selectedTransactions.value.some((item) => !item.deletedAt))
const importableDrafts = computed(() => importDrafts.value.filter((draft) => draft.valid))
const skippedImportCount = computed(() => importDrafts.value.length - importableDrafts.value.length)

function buildTransactionParams(page = 1, size = pageSize) {
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
  if (filters.value.tagId) {
    params.set('tagId', filters.value.tagId)
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
  params.set('page', String(page))
  params.set('pageSize', String(size))
  return params
}

async function load(page = 1, append = false) {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const previousSelection = selectedTransactionId.value
    const [accountResult, expenseCategories, incomeCategories, tagResult, transactionResult] = await Promise.all([
      listAccounts(bookStore.currentBookId),
      listCategories(bookStore.currentBookId, 'expense'),
      listCategories(bookStore.currentBookId, 'income'),
      listTags(bookStore.currentBookId),
      listTransactions(bookStore.currentBookId, buildTransactionParams(page))
    ])
    accounts.value = accountResult.items
    categories.value = [...expenseCategories.items, ...incomeCategories.items]
    tags.value = tagResult.items
    transactions.value = append ? [...transactions.value, ...transactionResult.items] : transactionResult.items
    currentPage.value = page
    hasMore.value = transactionResult.pageInfo.hasMore
    selectedTransactionId.value = transactions.value.some((item) => item.id === previousSelection) ? previousSelection : null
    if (!append) {
      selectedIds.value = []
    }
    ensureImportDefaults()
    ensureFormDefaults()
  } finally {
    loading.value = false
  }
}

function ensureImportDefaults() {
  if (!accounts.value.some((account) => account.id === importAccountId.value)) {
    importAccountId.value = accounts.value[0]?.id || ''
  }
  if (!importExpenseCategoryOptions.value.some((option) => option.value === importExpenseCategoryId.value)) {
    importExpenseCategoryId.value = importExpenseCategoryOptions.value[0]?.value || ''
  }
  if (!importIncomeCategoryOptions.value.some((option) => option.value === importIncomeCategoryId.value)) {
    importIncomeCategoryId.value = importIncomeCategoryOptions.value[0]?.value || ''
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
    merchantName: '',
    tagIds: []
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
    merchantName: item.merchantName || '',
    tagIds: [...item.tagIds]
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

function toggleFormTag(tagId: string) {
  form.value.tagIds = form.value.tagIds.includes(tagId)
    ? form.value.tagIds.filter((id) => id !== tagId)
    : [...form.value.tagIds, tagId]
}

function transactionTagNames(item: Transaction) {
  return item.tagIds.map((tagId) => tagMap.value.get(tagId)?.name).filter(Boolean) as string[]
}

function isSelected(transactionId: string) {
  return selectedIds.value.includes(transactionId)
}

function toggleSelected(transactionId: string) {
  selectedIds.value = isSelected(transactionId)
    ? selectedIds.value.filter((id) => id !== transactionId)
    : [...selectedIds.value, transactionId]
}

function toggleSelectLoaded() {
  const selectableIds = transactions.value.filter((item) => !item.deletedAt).map((item) => item.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.value.includes(id))
  selectedIds.value = allSelected ? [] : selectableIds
}

function applyFilters() {
  void load(1)
}

async function loadMore() {
  if (loading.value || !hasMore.value) {
    return
  }
  await load(currentPage.value + 1, true)
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: Transaction[]) {
  const headers = ['日期', '类型', '金额', '币种', '账户', '转入账户', '分类', '标签', '商户', '备注']
  const body = rows.map((item) =>
    [
      item.occurredAt,
      typeLabel(item.type),
      (item.amount / 100).toFixed(2),
      item.currency,
      item.accountName || '',
      item.transferAccountName || '',
      item.categoryName || '',
      transactionTagNames(item).join('; '),
      item.merchantName || '',
      item.note || ''
    ].map(csvEscape)
  )
  const csv = [headers.map(csvEscape), ...body].map((row) => row.join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cloud-vault-transactions-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function exportCsv() {
  if (!bookStore.currentBookId || exporting.value) {
    return
  }

  exporting.value = true
  error.value = ''
  success.value = ''
  try {
    const rows: Transaction[] = []
    let page = 1
    let more = true
    while (more) {
      const result = await listTransactions(bookStore.currentBookId, buildTransactionParams(page, 100))
      rows.push(...result.items)
      more = result.pageInfo.hasMore
      page += 1
    }
    downloadCsv(rows)
    success.value = `已导出 ${rows.length} 条账单`
  } catch (exportError) {
    error.value = exportError instanceof Error ? exportError.message : '导出失败'
  } finally {
    exporting.value = false
  }
}

function buildImportContext() {
  return {
    accounts: accounts.value,
    categories: categories.value,
    defaultAccountId: importAccountId.value,
    defaultExpenseCategoryId: importExpenseCategoryId.value,
    defaultIncomeCategoryId: importIncomeCategoryId.value
  }
}

function clearImportPreview() {
  importDrafts.value = []
  importFileName.value = ''
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  ensureImportDefaults()
  if (!importAccountId.value || !importExpenseCategoryId.value || !importIncomeCategoryId.value) {
    error.value = '请先创建账户和收入/支出分类'
    return
  }

  importSaving.value = true
  error.value = ''
  success.value = ''
  importFileName.value = file.name
  importDrafts.value = []
  try {
    importDrafts.value = await parseStatementFile(file, buildImportContext())
    success.value = `已解析 ${importDrafts.value.length} 行，可导入 ${importableDrafts.value.length} 行`
  } catch (importError) {
    clearImportPreview()
    error.value = importError instanceof Error ? importError.message : '解析账单失败'
  } finally {
    importSaving.value = false
  }
}

async function submitImport() {
  if (!bookStore.currentBookId || importSaving.value) {
    return
  }
  const drafts = importableDrafts.value
  if (drafts.length === 0) {
    error.value = '没有可导入的账单'
    return
  }

  importSaving.value = true
  error.value = ''
  success.value = ''
  try {
    let imported = 0
    let skippedDuplicates = 0
    for (let index = 0; index < drafts.length; index += 50) {
      const result = await importTransactions(
        bookStore.currentBookId,
        drafts.slice(index, index + 50).map((draft) => ({
          type: draft.type,
          amount: draft.amount,
          accountId: draft.accountId,
          transferAccountId: null,
          categoryId: draft.categoryId,
          currency: currency.value,
          occurredAt: draft.occurredAt,
          note: draft.note,
          merchantName: draft.merchantName,
          sourceRef: draft.sourceRef,
          tagIds: []
        }))
      )
      imported += result.imported
      skippedDuplicates += result.skippedDuplicates
    }
    success.value = `已导入 ${imported} 条账单${skippedDuplicates ? `，重复跳过 ${skippedDuplicates} 条` : ''}${skippedImportCount.value ? `，无效跳过 ${skippedImportCount.value} 条` : ''}`
    clearImportPreview()
    await load(1)
  } catch (importError) {
    error.value = importError instanceof Error ? importError.message : '导入账单失败'
  } finally {
    importSaving.value = false
  }
}

async function submitBatchDelete() {
  if (!bookStore.currentBookId || !canBatchDelete.value || !window.confirm(`确认删除选中的 ${selectedCount.value} 条账单？`)) {
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await batchDeleteTransactions(bookStore.currentBookId, selectedIds.value)
    selectedIds.value = []
    success.value = `已删除 ${result.deleted} 条账单`
    await load(1)
  } catch (batchError) {
    error.value = batchError instanceof Error ? batchError.message : '批量删除失败'
  } finally {
    saving.value = false
  }
}

async function submitBatchCategory() {
  if (!bookStore.currentBookId || !batchCategoryId.value || selectedNonTransferCount.value === 0) {
    error.value = '请选择非转账账单和目标分类'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await batchUpdateTransactionCategory(bookStore.currentBookId, selectedIds.value, batchCategoryId.value)
    selectedIds.value = []
    batchCategoryId.value = ''
    success.value = `已更新 ${result.updated} 条账单分类`
    await load(1)
  } catch (batchError) {
    error.value = batchError instanceof Error ? batchError.message : '批量修改分类失败'
  } finally {
    saving.value = false
  }
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
      tagIds: form.value.tagIds
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
    tagId: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false
  }
  void load(1)
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
watch(() => bookStore.currentBookId, () => load(1))
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
        <form class="space-y-2 overflow-y-auto p-3 xl:max-h-[calc(100vh-20rem)]" @submit.prevent="applyFilters">
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
          <BaseSelect v-model="filters.tagId" :options="filterTagOptions" />
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
          <BaseButton variant="secondary" class="w-full" :disabled="exporting" @click="exportCsv">
            <Download class="h-4 w-4" />
            {{ exporting ? '导出中' : '导出 CSV' }}
          </BaseButton>
        </form>
      </section>

      <section class="border-t border-[var(--app-border)] p-3">
        <div class="mb-2 flex items-center gap-2">
          <Upload class="h-4 w-4 text-[var(--app-muted)]" />
          <h2 class="text-sm font-extrabold">导入账单</h2>
        </div>
        <div class="grid gap-2">
          <label class="grid gap-1">
            <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">default account</span>
            <BaseSelect v-model="importAccountId" :options="accountOptions" placement="top" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="grid gap-1">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">expense</span>
              <BaseSelect v-model="importExpenseCategoryId" :options="importExpenseCategoryOptions" placement="top" />
            </label>
            <label class="grid gap-1">
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">income</span>
              <BaseSelect v-model="importIncomeCategoryId" :options="importIncomeCategoryOptions" placement="top" />
            </label>
          </div>
          <label
            class="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-bold transition hover:-translate-y-px hover:bg-[var(--app-subtle)]"
            :class="{ 'pointer-events-none opacity-50': importSaving }"
          >
            <Upload class="h-4 w-4" />
            {{ importSaving ? '处理中' : '选择支付宝 CSV / 微信 XLSX' }}
            <input class="sr-only" type="file" accept=".csv,.xlsx" :disabled="importSaving" @change="handleImportFile" />
          </label>

          <div v-if="importDrafts.length > 0" class="border border-[var(--app-border-soft)] bg-[var(--app-subtle)]">
            <div class="grid grid-cols-3 border-b border-[var(--app-border-soft)] text-center">
              <div class="p-2">
                <p class="font-mono text-[10px] font-bold text-[var(--app-muted)]">文件</p>
                <p class="mt-1 truncate text-xs font-extrabold">{{ importFileName }}</p>
              </div>
              <div class="border-l border-[var(--app-border-soft)] p-2">
                <p class="font-mono text-[10px] font-bold text-[var(--app-muted)]">可导入</p>
                <p class="mt-1 font-mono text-sm font-extrabold text-income">{{ importableDrafts.length }}</p>
              </div>
              <div class="border-l border-[var(--app-border-soft)] p-2">
                <p class="font-mono text-[10px] font-bold text-[var(--app-muted)]">跳过</p>
                <p class="mt-1 font-mono text-sm font-extrabold text-[var(--app-muted)]">{{ skippedImportCount }}</p>
              </div>
            </div>
            <div class="max-h-56 overflow-y-auto">
              <div
                v-for="draft in importDrafts.slice(0, 8)"
                :key="draft.id"
                class="grid grid-cols-[1fr_5.5rem] gap-2 border-b border-[var(--app-border-soft)] px-2 py-2 last:border-b-0"
              >
                <div class="min-w-0">
                  <p class="truncate text-xs font-extrabold">{{ draft.merchantName || draft.rawCategory || '账单' }}</p>
                  <p class="mt-1 truncate font-mono text-[10px] font-bold text-[var(--app-muted)]">
                    {{ typeLabel(draft.type) }} / {{ draft.reason || draft.rawStatus || '可导入' }}
                  </p>
                </div>
                <p
                  class="truncate text-right font-mono text-xs font-extrabold"
                  :class="{ 'text-expense': draft.type === 'expense', 'text-income': draft.type === 'income', 'text-[var(--app-muted)]': !draft.valid }"
                >
                  {{ amountPrefix(draft.type) }}{{ formatMoney(draft.amount, currency) }}
                </p>
              </div>
              <p v-if="importDrafts.length > 8" class="px-2 py-2 text-center text-[11px] font-bold text-[var(--app-muted)]">
                另有 {{ importDrafts.length - 8 }} 行
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2 border-t border-[var(--app-border-soft)] p-2">
              <BaseButton variant="secondary" :disabled="importSaving || importableDrafts.length === 0" @click="submitImport">
                导入 {{ importableDrafts.length }}
              </BaseButton>
              <BaseButton variant="ghost" :disabled="importSaving" @click="clearImportPreview">清除</BaseButton>
            </div>
          </div>
        </div>
      </section>

      <section class="border-t border-[var(--app-border)] p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-extrabold">批量操作</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">已选 {{ selectedCount }}</p>
        </div>
        <div class="grid gap-2">
          <BaseButton variant="secondary" :disabled="transactions.length === 0" @click="toggleSelectLoaded">
            {{ selectedCount > 0 ? '取消选择' : '选择当前页' }}
          </BaseButton>
          <BaseSelect v-model="batchCategoryId" :options="batchCategoryOptions" />
          <BaseButton variant="secondary" :disabled="saving || selectedNonTransferCount === 0 || !batchCategoryId" @click="submitBatchCategory">
            批量改分类
          </BaseButton>
          <BaseButton variant="ghost" :disabled="saving || !canBatchDelete" @click="submitBatchDelete">
            <Trash2 class="h-4 w-4" />
            批量删除
          </BaseButton>
        </div>
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
          class="grid w-full cursor-pointer grid-cols-[2rem_5.75rem_minmax(0,1fr)_8rem] items-center gap-3 border-b border-[var(--app-border-soft)] px-3 py-2 text-left transition hover:bg-[var(--app-subtle)]"
          :class="{ 'bg-[var(--app-subtle)]': selectedTransaction?.id === item.id, 'opacity-60': item.deletedAt }"
          @click="selectTransaction(item)"
        >
          <span
            class="flex h-6 w-6 items-center justify-center border border-[var(--app-border)] bg-[var(--app-surface)] font-mono text-[10px] font-extrabold"
            :class="{ 'bg-[var(--app-inverse)] text-[var(--app-inverse-text)]': isSelected(item.id) }"
            @click.stop="toggleSelected(item.id)"
          >
            {{ isSelected(item.id) ? '✓' : '' }}
          </span>
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
              <span v-if="transactionTagNames(item).length"> / #{{ transactionTagNames(item).join(' #') }}</span>
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
        <div v-if="transactions.length > 0" class="border-t border-[var(--app-border-soft)] p-3">
          <BaseButton variant="secondary" class="w-full" :disabled="loading || !hasMore" @click="loadMore">
            {{ hasMore ? loading ? '加载中' : '加载更多' : '已加载全部' }}
          </BaseButton>
        </div>
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

          <section class="space-y-2 border border-[var(--app-border-soft)] p-3">
            <div class="flex items-center gap-2">
              <Tags class="h-4 w-4 text-[var(--app-muted)]" />
              <span class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">tags</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in tags"
                :key="tag.id"
                type="button"
                class="h-8 cursor-pointer border border-[var(--app-border-soft)] px-2 text-xs font-extrabold transition hover:border-[var(--app-border)]"
                :class="{ 'border-[var(--app-border)] bg-[var(--app-inverse)] text-[var(--app-inverse-text)]': form.tagIds.includes(tag.id) }"
                @click="toggleFormTag(tag.id)"
              >
                {{ tag.name }}
              </button>
              <p v-if="tags.length === 0" class="text-xs font-bold text-[var(--app-muted)]">暂无标签，可在设置页创建。</p>
            </div>
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
                  <p class="mt-1 truncate text-sm font-extrabold">
                    {{ transactionTagNames(selectedTransaction).length ? transactionTagNames(selectedTransaction).join(' / ') : '-' }}
                  </p>
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
