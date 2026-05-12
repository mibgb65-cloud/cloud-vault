<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import {
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Calculator,
  CalendarDays,
  CircleHelp,
  ClipboardPenLine,
  Coffee,
  CreditCard,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Plane,
  Plus,
  Receipt,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tags,
  Trophy,
  UtensilsCrossed,
  Wallet,
  WalletCards
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { createAccount, listAccounts } from '@/services/accounts.api'
import { createCategory, listCategories } from '@/services/categories.api'
import { createTransaction, listTransactions } from '@/services/transactions.api'
import { getSummary, type SummaryReport } from '@/services/reports.api'
import { parseTransactionText, type ParsedTransactionDraft } from '@/services/ai.api'
import { useBookStore } from '@/stores/book.store'
import { dateInputValue, dateTimeInputToIso, dateTimeInputValue, dateTimeInputValueFromIso, monthRange } from '@/utils/date'
import { formatMoney, parseMoneyToMinorUnit } from '@/utils/money'
import { parseNaturalTransaction } from '@/utils/naturalLanguageTransaction'
import type { Account, Category, Transaction, TransactionType } from '@/types/domain'

interface TransactionGroup {
  dateKey: string
  income: number
  expense: number
  balance: number
  items: Transaction[]
}

interface QuickChip {
  id: string
  name: string
  available: boolean
  kind?: 'category' | 'account'
  type?: string
  icon?: string | null
}

const bookStore = useBookStore()
const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const transactions = ref<Transaction[]>([])
const summary = ref<SummaryReport | null>(null)
const selectedTransactionId = ref<string | null>(null)
const loading = ref(false)
const quickSaving = ref(false)
const aiParsing = ref(false)
const quickError = ref('')
const quickSuccess = ref('')
const naturalInput = ref('')
const naturalHint = ref('')
const quickForm = ref({
  type: 'expense' as TransactionType,
  amount: '',
  accountId: '',
  transferAccountId: '',
  categoryId: '',
  date: dateTimeInputValue(),
  note: ''
})

const currency = computed(() => bookStore.currentBook?.defaultCurrency || 'CNY')
const typeTabs: Array<{ label: string; value: TransactionType }> = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' },
  { label: '转账', value: 'transfer' }
]
const quickFieldButtons: Array<{ label: string; icon: Component }> = [
  { label: '分类', icon: Tags },
  { label: '金额', icon: Calculator },
  { label: '账户', icon: WalletCards },
  { label: '时间', icon: CalendarDays },
  { label: '账本', icon: BookOpen }
]
const fallbackExpenseCategories = ['餐饮', '交通', '购物', '住房', '医疗', '娱乐', '教育', '人情', '通讯', '办公', '旅行', '其他']
const fallbackIncomeCategories = ['工资', '奖金', '报销', '理财', '红包', '退款', '其他']
const keypadKeys = ['1', '2', '3', '退格', '4', '5', '6', '清空', '7', '8', '9', '今天', '再记', '0', '.', '完成']

const accountIconMap: Record<string, Component> = {
  cash: Banknote,
  debit_card: CreditCard,
  credit_card: CreditCard,
  ewallet: Wallet,
  savings: PiggyBank,
  investment: Landmark,
  other: WalletCards
}
const categoryIconMap: Array<[string, Component]> = [
  ['餐', UtensilsCrossed],
  ['饭', UtensilsCrossed],
  ['吃', UtensilsCrossed],
  ['奶茶', Coffee],
  ['咖啡', Coffee],
  ['饮', Coffee],
  ['交通', Bus],
  ['地铁', Bus],
  ['公交', Bus],
  ['购物', ShoppingBag],
  ['买', ShoppingBag],
  ['住房', Home],
  ['房', Home],
  ['医疗', HeartPulse],
  ['健康', HeartPulse],
  ['娱乐', Gamepad2],
  ['游戏', Gamepad2],
  ['教育', GraduationCap],
  ['学习', GraduationCap],
  ['人情', Gift],
  ['礼', Gift],
  ['通讯', Smartphone],
  ['手机', Smartphone],
  ['办公', BriefcaseBusiness],
  ['旅行', Plane],
  ['工资', Banknote],
  ['奖金', Trophy],
  ['报销', Receipt],
  ['理财', PiggyBank],
  ['红包', Gift],
  ['退款', RotateCcw]
]

const visibleTransactions = computed(() => transactions.value.slice(0, 28))
const visibleAccounts = computed(() => accounts.value.slice(0, 8))
const netAssets = computed(() => summary.value?.netAssets ?? accounts.value.reduce((total, account) => total + account.cachedBalance, 0))
const liability = computed(() =>
  accounts.value.reduce((total, account) => (account.cachedBalance < 0 ? total + Math.abs(account.cachedBalance) : total), 0)
)
const selectedTypeCategories = computed(() => categories.value.filter((category) => category.type === quickForm.value.type))
const commonCategories = computed<QuickChip[]>(() => {
  const expenseCategories = categories.value.filter((category) => category.type === 'expense').slice(0, 9)
  if (expenseCategories.length > 0) {
    return expenseCategories.map((category) => ({ id: category.id, name: category.name, available: true, kind: 'category', type: category.type, icon: category.icon }))
  }
  return fallbackExpenseCategories.slice(0, 9).map((name) => ({ id: `fallback-${name}`, name, available: false, kind: 'category' }))
})
const accountOptions = computed(() => accounts.value.map((account) => ({ label: account.name, value: account.id })))
const transferAccountOptions = computed(() =>
  accounts.value.filter((account) => account.id !== quickForm.value.accountId).map((account) => ({ label: account.name, value: account.id }))
)
const quickChips = computed<QuickChip[]>(() => {
  if (quickForm.value.type === 'transfer') {
    return accounts.value
      .filter((account) => account.id !== quickForm.value.accountId)
      .slice(0, 12)
      .map((account) => ({ id: account.id, name: account.name, available: true, kind: 'account', type: account.type, icon: account.icon }))
  }

  if (selectedTypeCategories.value.length > 0) {
    return selectedTypeCategories.value
      .slice(0, 18)
      .map((category) => ({ id: category.id, name: category.name, available: true, kind: 'category', type: category.type, icon: category.icon }))
  }

  const fallback = quickForm.value.type === 'income' ? fallbackIncomeCategories : fallbackExpenseCategories
  return fallback.map((name) => ({ id: `fallback-${name}`, name, available: false, kind: 'category' }))
})
const amountPreview = computed(() => {
  const amount = parseMoneyToMinorUnit(quickForm.value.amount)
  return formatMoney(amount && amount > 0 ? amount : 0, currency.value)
})
const selectedQuickAccountName = computed(() => accounts.value.find((account) => account.id === quickForm.value.accountId)?.name || '账户')
const selectedQuickTargetName = computed(() => {
  if (quickForm.value.type === 'transfer') {
    return accounts.value.find((account) => account.id === quickForm.value.transferAccountId)?.name || '转入账户'
  }
  return categories.value.find((category) => category.id === quickForm.value.categoryId)?.name || '分类'
})
const needsQuickDefaults = computed(
  () =>
    accounts.value.length === 0 ||
    categories.value.filter((category) => category.type === 'expense').length === 0 ||
    categories.value.filter((category) => category.type === 'income').length === 0
)

const selectedTransaction = computed(() => {
  if (visibleTransactions.value.length === 0) {
    return null
  }
  return visibleTransactions.value.find((item) => item.id === selectedTransactionId.value) ?? visibleTransactions.value[0]
})

const groupedTransactions = computed<TransactionGroup[]>(() => {
  const groups = new Map<string, TransactionGroup>()
  for (const item of visibleTransactions.value) {
    const group = groups.get(item.dateKey) ?? {
      dateKey: item.dateKey,
      income: 0,
      expense: 0,
      balance: 0,
      items: []
    }
    if (item.type === 'income') {
      group.income += item.amount
      group.balance += item.amount
    } else if (item.type === 'expense') {
      group.expense += item.amount
      group.balance -= item.amount
    }
    group.items.push(item)
    groups.set(item.dateKey, group)
  }
  return [...groups.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey))
})

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const range = monthRange()
    const previousSelection = selectedTransactionId.value
    const [accountResult, transactionResult, summaryResult, categoryResult] = await Promise.all([
      listAccounts(bookStore.currentBookId),
      listTransactions(bookStore.currentBookId),
      getSummary(bookStore.currentBookId, range.dateFrom, range.dateTo),
      listCategories(bookStore.currentBookId)
    ])
    accounts.value = accountResult.items
    transactions.value = transactionResult.items
    summary.value = summaryResult
    categories.value = categoryResult.items
    ensureQuickDefaults()
    selectedTransactionId.value = transactionResult.items.some((item) => item.id === previousSelection)
      ? previousSelection
      : transactionResult.items[0]?.id ?? null
  } finally {
    loading.value = false
  }
}

function ensureQuickDefaults() {
  if (!accounts.value.some((account) => account.id === quickForm.value.accountId)) {
    quickForm.value.accountId = accounts.value[0]?.id || ''
  }

  if (quickForm.value.type === 'transfer') {
    const transferTarget = accounts.value.find((account) => account.id !== quickForm.value.accountId)
    if (!accounts.value.some((account) => account.id === quickForm.value.transferAccountId) || quickForm.value.transferAccountId === quickForm.value.accountId) {
      quickForm.value.transferAccountId = transferTarget?.id || ''
    }
    quickForm.value.categoryId = ''
    return
  }

  if (!selectedTypeCategories.value.some((category) => category.id === quickForm.value.categoryId)) {
    quickForm.value.categoryId = selectedTypeCategories.value[0]?.id || ''
  }
  quickForm.value.transferAccountId = ''
}

function transactionTitle(item: Transaction) {
  return item.note || item.merchantName || item.categoryName || transactionTypeLabel(item.type)
}

function transactionTypeLabel(type: Transaction['type']) {
  if (type === 'income') {
    return '收入'
  }
  if (type === 'expense') {
    return '支出'
  }
  return '转账'
}

function amountPrefix(type: Transaction['type']) {
  if (type === 'expense') {
    return '-'
  }
  if (type === 'income') {
    return '+'
  }
  return ''
}

function padTimePart(value: number) {
  return String(value).padStart(2, '0')
}

function dateKeyWithCurrentMinute(dateKey: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return `${dateKey}${dateTimeInputValue().slice(10)}`
  }
  return dateTimeInputValueFromIso(dateKey)
}

function formatOccurrenceMinute(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16).replace('T', ' ')
  }
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`
}

function formatOccurrenceTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16)
  }
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateKey
  }
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
}

function categoryIconByName(name: string) {
  return categoryIconMap.find(([keyword]) => name.includes(keyword))?.[1] ?? CircleHelp
}

function quickChipIcon(chip: QuickChip) {
  if (chip.kind === 'account') {
    return accountIconMap[chip.type || ''] ?? WalletCards
  }

  const icon = chip.icon?.toLowerCase()
  if (icon?.includes('wallet')) {
    return Wallet
  }
  if (icon?.includes('card')) {
    return CreditCard
  }
  if (icon?.includes('tag')) {
    return categoryIconByName(chip.name)
  }

  return categoryIconByName(chip.name)
}

function selectTransaction(item: Transaction) {
  selectedTransactionId.value = item.id
}

function setQuickType(type: TransactionType) {
  quickForm.value.type = type
  quickError.value = ''
  quickSuccess.value = ''
  naturalHint.value = ''
  ensureQuickDefaults()
}

function applyDraft(draft: ParsedTransactionDraft | ReturnType<typeof parseNaturalTransaction>) {
  if (!draft) {
    return
  }

  quickForm.value.type = draft.type
  ensureQuickDefaults()
  quickForm.value.amount = draft.amount
  quickForm.value.date = dateKeyWithCurrentMinute(draft.date)
  quickForm.value.note = draft.note

  if (draft.accountId) {
    quickForm.value.accountId = draft.accountId
  }
  ensureQuickDefaults()
  if (draft.type === 'transfer' && draft.transferAccountId) {
    quickForm.value.transferAccountId = draft.transferAccountId
  }
  if (draft.type !== 'transfer' && draft.categoryId) {
    quickForm.value.categoryId = draft.categoryId
  }
}

async function applyNaturalInput() {
  const text = naturalInput.value.trim()
  if (!text) {
    quickError.value = '请输入带金额的内容，例如：午饭35 微信'
    quickSuccess.value = ''
    naturalHint.value = ''
    return
  }

  aiParsing.value = true
  quickError.value = ''
  quickSuccess.value = ''
  naturalHint.value = ''

  try {
    if (bookStore.currentBookId) {
      const result = await parseTransactionText(bookStore.currentBookId, {
        text,
        today: dateInputValue(),
        currency: currency.value
      })
      applyDraft(result.draft)
      naturalHint.value = `DeepSeek / ${result.draft.type} / ${result.draft.amount}`
      return
    }
  } catch {
    // Fall back to deterministic local parsing when the AI provider is not configured or temporarily unavailable.
  } finally {
    aiParsing.value = false
  }

  const draft = parseNaturalTransaction(text, {
    accounts: accounts.value,
    categories: categories.value,
    today: dateInputValue()
  })

  if (!draft) {
    quickError.value = '请输入带金额的内容，例如：午饭35 微信'
    quickSuccess.value = ''
    naturalHint.value = ''
    return
  }

  applyDraft(draft)
  quickError.value = ''
  quickSuccess.value = ''
  naturalHint.value = `本地解析 / ${draft.summary}`
}

function selectQuickChip(chip: QuickChip) {
  if (!chip.available) {
    quickError.value = '当前账本还没有可用分类，请先在设置中创建分类'
    return
  }
  quickError.value = ''
  quickSuccess.value = ''
  if (quickForm.value.type === 'transfer') {
    quickForm.value.transferAccountId = chip.id
  } else {
    quickForm.value.categoryId = chip.id
  }
}

function isQuickChipActive(chip: QuickChip) {
  return quickForm.value.type === 'transfer' ? quickForm.value.transferAccountId === chip.id : quickForm.value.categoryId === chip.id
}

function handleKeypadKey(key: string) {
  quickError.value = ''
  quickSuccess.value = ''
  if (key === '完成') {
    void submitQuickEntry()
    return
  }
  if (key === '再记' || key === '清空') {
    quickForm.value.amount = ''
    if (key === '再记') {
      quickForm.value.note = ''
    }
    return
  }
  if (key === '退格') {
    quickForm.value.amount = quickForm.value.amount.slice(0, -1)
    return
  }
  if (key === '今天') {
    quickForm.value.date = dateTimeInputValue()
    return
  }
  if (key === '.') {
    if (!quickForm.value.amount.includes('.')) {
      quickForm.value.amount = quickForm.value.amount ? `${quickForm.value.amount}.` : '0.'
    }
    return
  }
  if (/^\d$/.test(key) && quickForm.value.amount.length < 10) {
    quickForm.value.amount = quickForm.value.amount === '0' ? key : `${quickForm.value.amount}${key}`
  }
}

async function submitQuickEntry() {
  if (!bookStore.currentBookId || quickSaving.value) {
    return
  }

  ensureQuickDefaults()
  const amount = parseMoneyToMinorUnit(quickForm.value.amount)
  if (!amount || amount <= 0) {
    quickError.value = '请输入有效金额'
    return
  }
  if (!quickForm.value.accountId) {
    quickError.value = '请先创建或选择账户'
    return
  }
  if (quickForm.value.type === 'transfer') {
    if (!quickForm.value.transferAccountId || quickForm.value.transferAccountId === quickForm.value.accountId) {
      quickError.value = '请选择不同的转入账户'
      return
    }
  } else if (!quickForm.value.categoryId) {
    quickError.value = '请选择分类'
    return
  }

  quickSaving.value = true
  quickError.value = ''
  quickSuccess.value = ''
  try {
    const result = await createTransaction(bookStore.currentBookId, {
      type: quickForm.value.type,
      amount,
      accountId: quickForm.value.accountId,
      transferAccountId: quickForm.value.type === 'transfer' ? quickForm.value.transferAccountId : null,
      categoryId: quickForm.value.type === 'transfer' ? null : quickForm.value.categoryId,
      currency: currency.value,
      occurredAt: dateTimeInputToIso(quickForm.value.date),
      note: quickForm.value.note || null,
      merchantName: null,
      tagIds: []
    })
    quickForm.value.amount = ''
    quickForm.value.note = ''
    quickForm.value.date = dateTimeInputValue()
    naturalInput.value = ''
    naturalHint.value = ''
    await load()
    selectedTransactionId.value = result.transaction.id
    quickSuccess.value = '已记录'
  } catch (error) {
    quickError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    quickSaving.value = false
  }
}

async function initializeQuickDefaults() {
  if (!bookStore.currentBookId || quickSaving.value) {
    return
  }

  quickSaving.value = true
  quickError.value = ''
  quickSuccess.value = ''
  try {
    const tasks: Array<Promise<unknown>> = []
    if (accounts.value.length === 0) {
      tasks.push(
        createAccount(bookStore.currentBookId, {
          name: '现金',
          type: 'cash',
          currency: currency.value,
          openingBalance: 0,
          icon: 'wallet',
          color: '#111111',
          includeInAssets: true
        })
      )
    }

    if (categories.value.filter((category) => category.type === 'expense').length === 0) {
      for (const [index, name] of fallbackExpenseCategories.slice(0, 6).entries()) {
        tasks.push(
          createCategory(bookStore.currentBookId, {
            name,
            type: 'expense',
            icon: 'tag',
            color: '#111111',
            sortOrder: index
          })
        )
      }
    }

    if (categories.value.filter((category) => category.type === 'income').length === 0) {
      for (const [index, name] of fallbackIncomeCategories.slice(0, 3).entries()) {
        tasks.push(
          createCategory(bookStore.currentBookId, {
            name,
            type: 'income',
            icon: 'tag',
            color: '#15803D',
            sortOrder: index
          })
        )
      }
    }

    await Promise.all(tasks)
    await load()
    quickSuccess.value = '已初始化默认账户和分类'
  } catch (error) {
    quickError.value = error instanceof Error ? error.message : '初始化失败'
  } finally {
    quickSaving.value = false
  }
}

onMounted(load)
watch(
  () => bookStore.currentBookId,
  () => {
    void load()
  }
)
watch(
  () => quickForm.value.type,
  () => ensureQuickDefaults()
)
watch(
  () => quickForm.value.accountId,
  () => ensureQuickDefaults()
)
</script>

<template>
  <div class="grid gap-3 xl:h-[calc(100vh-4.5rem)] xl:min-h-[720px] xl:grid-cols-[220px_minmax(270px,340px)_minmax(270px,1fr)_360px] 2xl:grid-cols-[232px_minmax(292px,380px)_minmax(292px,1fr)_400px]">
    <aside class="min-h-0 space-y-3 overflow-y-auto">
      <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="flex items-start gap-2">
          <BookOpen class="mt-0.5 h-4 w-4 text-[var(--app-muted)]" />
          <p class="text-xs font-bold leading-5 text-[var(--app-muted)]">
            账单保存后请核对账户余额；如移动端同步滞后，可手动刷新后再继续操作。
          </p>
        </div>
      </section>

      <section class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-10 items-center justify-between border-b border-[var(--app-border)] px-3">
          <div class="flex items-center gap-2">
            <BookOpen class="h-4 w-4" />
            <h2 class="text-sm font-extrabold">账本</h2>
          </div>
          <RouterLink to="/settings" class="font-mono text-xs font-extrabold text-[var(--app-muted)]">设置</RouterLink>
        </div>
        <div class="p-2">
          <div class="flex items-center gap-2 border border-[var(--app-border-soft)] bg-[var(--app-subtle)] p-2">
            <div class="flex h-8 w-8 items-center justify-center border border-[var(--app-border)] bg-[var(--app-surface)]">
              <ReceiptText class="h-4 w-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-extrabold">{{ bookStore.currentBook?.name || '我的账本' }}</p>
              <p class="font-mono text-[11px] font-bold text-[var(--app-muted)]">默认货币 {{ currency }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-10 items-center justify-between border-b border-[var(--app-border)] px-3">
          <div class="flex items-center gap-2">
            <WalletCards class="h-4 w-4" />
            <h2 class="text-sm font-extrabold">资产</h2>
          </div>
          <RouterLink to="/accounts" class="font-mono text-xs font-extrabold text-[var(--app-muted)]">全部</RouterLink>
        </div>
        <div class="grid grid-cols-2 border-b border-[var(--app-border)]">
          <div class="border-r border-[var(--app-border)] p-3">
            <p class="text-[11px] font-bold text-[var(--app-muted)]">净资产</p>
            <p class="mt-1 truncate font-mono text-lg font-extrabold">{{ formatMoney(netAssets, currency) }}</p>
          </div>
          <div class="p-3">
            <p class="text-[11px] font-bold text-[var(--app-muted)]">负债</p>
            <p class="mt-1 truncate font-mono text-lg font-extrabold text-expense">{{ formatMoney(liability, currency) }}</p>
          </div>
        </div>
        <div class="divide-y divide-[var(--app-border-soft)]">
          <div v-for="account in visibleAccounts" :key="account.id" class="flex items-center gap-2 px-3 py-2">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--app-border)] bg-[var(--app-subtle)] font-mono text-[10px] font-extrabold">
              {{ account.name.slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-extrabold">{{ account.name }}</p>
              <p class="font-mono text-[10px] font-bold text-[var(--app-muted)]">{{ account.type }}</p>
            </div>
            <p class="max-w-24 truncate text-right font-mono text-xs font-extrabold">{{ formatMoney(account.cachedBalance, account.currency) }}</p>
          </div>
          <p v-if="!loading && accounts.length === 0" class="px-3 py-6 text-center text-sm font-bold text-[var(--app-muted)]">暂无账户</p>
        </div>
      </section>

      <section class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-10 items-center gap-2 border-b border-[var(--app-border)] px-3">
          <Tags class="h-4 w-4" />
          <h2 class="text-sm font-extrabold">常用分类</h2>
        </div>
        <div class="grid grid-cols-3 gap-px bg-[var(--app-border-soft)] p-px">
          <div v-for="category in commonCategories" :key="category.id" class="bg-[var(--app-surface)] px-2 py-2 text-center">
            <p class="truncate text-xs font-extrabold">{{ category.name }}</p>
          </div>
        </div>
      </section>
    </aside>

    <section class="min-h-0 overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
      <header class="border-b border-[var(--app-border)] p-3">
        <div>
          <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">ledger</p>
          <h1 class="text-lg font-extrabold">本月流水</h1>
        </div>
        <div class="mt-3 grid grid-cols-3 border border-[var(--app-border)]">
          <div class="border-r border-[var(--app-border)] p-2">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">收入</p>
            <p class="truncate font-mono text-sm font-extrabold text-income">{{ formatMoney(summary?.income || 0, currency) }}</p>
          </div>
          <div class="border-r border-[var(--app-border)] p-2">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">支出</p>
            <p class="truncate font-mono text-sm font-extrabold text-expense">{{ formatMoney(summary?.expense || 0, currency) }}</p>
          </div>
          <div class="p-2">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">结余</p>
            <p class="truncate font-mono text-sm font-extrabold">{{ formatMoney(summary?.balance || 0, currency) }}</p>
          </div>
        </div>
      </header>

      <div class="max-h-[520px] overflow-y-auto xl:h-[calc(100%-106px)] xl:max-h-none">
        <div v-for="group in groupedTransactions" :key="group.dateKey" class="border-b border-[var(--app-border)]">
          <div class="sticky top-0 z-[1] flex items-center justify-between border-b border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-2">
            <p class="text-sm font-extrabold text-[var(--app-accent)]">{{ formatDateLabel(group.dateKey) }}</p>
            <p class="font-mono text-[10px] font-bold text-[var(--app-muted)]">
              收入 {{ formatMoney(group.income, currency) }} 支出 {{ formatMoney(group.expense, currency) }} 结余 {{ formatMoney(group.balance, currency) }}
            </p>
          </div>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-2 border-b border-[var(--app-border-soft)] px-3 py-2 text-left transition last:border-b-0 hover:bg-[var(--app-subtle)]"
            :class="{ 'bg-[var(--app-subtle)]': selectedTransaction?.id === item.id }"
            @click="selectTransaction(item)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-extrabold">{{ transactionTitle(item) }}</span>
              <span class="mt-0.5 block truncate font-mono text-[11px] font-bold text-[var(--app-muted)]">
                {{ formatOccurrenceTime(item.occurredAt) }} / {{ item.accountName || '账户' }}
              </span>
            </span>
            <span class="min-w-24 text-right">
              <span
                class="block truncate font-mono text-sm font-extrabold"
                :class="{ 'text-expense': item.type === 'expense', 'text-income': item.type === 'income' }"
              >
                {{ amountPrefix(item.type) }}{{ formatMoney(item.amount, item.currency) }}
              </span>
              <span class="mt-0.5 block truncate text-[11px] font-bold text-[var(--app-muted)]">{{ item.categoryName || transactionTypeLabel(item.type) }}</span>
            </span>
          </button>
        </div>
        <p v-if="!loading && groupedTransactions.length === 0" class="px-3 py-10 text-center text-sm font-bold text-[var(--app-muted)]">暂无账单</p>
      </div>
    </section>

    <section class="min-h-[420px] overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)] xl:min-h-0">
      <template v-if="selectedTransaction">
        <header class="flex h-12 items-center justify-between border-b border-[var(--app-border)] px-3">
          <div>
            <p class="font-mono text-[10px] font-extrabold uppercase text-[var(--app-muted)]">detail</p>
            <h2 class="truncate text-sm font-extrabold">{{ transactionTitle(selectedTransaction) }}</h2>
          </div>
          <p
            class="font-mono text-lg font-extrabold"
            :class="{ 'text-expense': selectedTransaction.type === 'expense', 'text-income': selectedTransaction.type === 'income' }"
          >
            {{ amountPrefix(selectedTransaction.type) }}{{ formatMoney(selectedTransaction.amount, selectedTransaction.currency) }}
          </p>
        </header>

        <div class="grid grid-cols-2 border-b border-[var(--app-border)] md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">类型</p>
            <p class="mt-1 text-sm font-extrabold">{{ transactionTypeLabel(selectedTransaction.type) }}</p>
          </div>
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">分类</p>
            <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.categoryName || '-' }}</p>
          </div>
          <div class="border-b border-r border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">账户</p>
            <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.accountName || '-' }}</p>
          </div>
          <div class="border-b border-[var(--app-border-soft)] p-3">
            <p class="text-[10px] font-bold text-[var(--app-muted)]">时间</p>
            <p class="mt-1 truncate font-mono text-sm font-extrabold">{{ formatOccurrenceMinute(selectedTransaction.occurredAt) }}</p>
          </div>
        </div>

        <div class="space-y-3 p-3">
          <div class="border border-[var(--app-border-soft)] p-3">
            <p class="mb-2 text-[10px] font-bold text-[var(--app-muted)]">备注</p>
            <p class="min-h-16 text-sm font-bold leading-6 text-[var(--app-text)]">{{ selectedTransaction.note || '未填写备注' }}</p>
          </div>
          <div class="grid grid-cols-2 gap-px bg-[var(--app-border-soft)] p-px">
            <div class="bg-[var(--app-surface)] p-3">
              <p class="text-[10px] font-bold text-[var(--app-muted)]">商户</p>
              <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.merchantName || '-' }}</p>
            </div>
            <div class="bg-[var(--app-surface)] p-3">
              <p class="text-[10px] font-bold text-[var(--app-muted)]">标签</p>
              <p class="mt-1 truncate text-sm font-extrabold">{{ selectedTransaction.tagIds?.length || 0 }} 个</p>
            </div>
          </div>
          <RouterLink to="/transactions">
            <BaseButton variant="secondary" class="w-full">
              打开账单管理
            </BaseButton>
          </RouterLink>
        </div>
      </template>
      <div v-else class="flex h-full min-h-[420px] items-center justify-center p-6 text-center">
        <div>
          <ReceiptText class="mx-auto mb-3 h-10 w-10 text-[var(--app-muted)]" />
          <p class="text-sm font-extrabold text-[var(--app-muted)]">选择一条账单查看详情</p>
        </div>
      </div>
    </section>

    <aside class="min-h-[720px] overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)] xl:min-h-0">
      <form class="flex h-full min-h-[720px] flex-col xl:min-h-0" @submit.prevent="submitQuickEntry">
        <div class="shrink-0 border-b border-[var(--app-border)] p-3">
          <div v-if="needsQuickDefaults" class="mb-3 border border-[var(--app-border)] bg-[var(--app-subtle)] p-2">
            <p class="text-xs font-bold leading-5 text-[var(--app-muted)]">当前账本缺少账户或分类，先补齐默认项后即可在右侧直接记账。</p>
            <button
              type="button"
              class="mt-2 h-8 w-full cursor-pointer border border-[var(--app-border)] bg-[var(--app-inverse)] px-2 text-xs font-extrabold text-[var(--app-inverse-text)] disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="quickSaving"
              @click="initializeQuickDefaults"
            >
              {{ quickSaving ? '初始化中' : '初始化默认项' }}
            </button>
          </div>

          <div class="grid grid-cols-[1fr_2.75rem] gap-2">
            <label class="flex h-11 items-center gap-2 border border-[var(--app-border-soft)] bg-[var(--app-subtle)] px-3 text-[var(--app-muted)]">
              <Sparkles class="h-4 w-4" />
              <input
                v-model="naturalInput"
                class="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                placeholder="输入账单，如：午饭35、微信买菜25.5"
                @keydown.enter.prevent="applyNaturalInput"
              />
            </label>
            <button
              type="button"
              class="flex h-11 cursor-pointer items-center justify-center border border-[var(--app-border)] bg-[var(--app-inverse)] text-[var(--app-inverse-text)] disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="aiParsing"
              title="解析账单"
              @click="applyNaturalInput"
            >
              <Plus class="h-5 w-5" />
            </button>
          </div>

          <p v-if="naturalHint" class="mt-2 truncate border border-[var(--app-border-soft)] bg-[var(--app-subtle)] px-2 py-1.5 text-xs font-bold text-[var(--app-muted)]">
            {{ naturalHint }}
          </p>

          <div class="mt-2 grid grid-cols-5 gap-1.5">
            <button
              v-for="item in quickFieldButtons"
              :key="item.label"
              type="button"
              class="flex h-8 min-w-0 items-center justify-center gap-1 border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-1 text-[11px] font-extrabold text-[var(--app-muted)]"
              :title="item.label"
            >
              <component :is="item.icon" class="h-3.5 w-3.5 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </button>
          </div>

          <div class="mt-3 grid grid-cols-3 border-b border-[var(--app-border-soft)]">
            <button
              v-for="tab in typeTabs"
              :key="tab.value"
              type="button"
              class="relative h-10 cursor-pointer text-sm font-extrabold text-[var(--app-muted)] transition hover:bg-[var(--app-subtle)]"
              :class="{ '!text-[var(--app-text)]': quickForm.type === tab.value }"
              @click="setQuickType(tab.value)"
            >
              {{ tab.label }}
              <span v-if="quickForm.type === tab.value" class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[var(--app-border)]" />
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto border-b border-[var(--app-border)] p-3">
          <div class="grid grid-cols-4 gap-x-2 gap-y-3 2xl:grid-cols-5">
            <button
              v-for="chip in quickChips"
              :key="chip.id"
              type="button"
              class="min-w-0 cursor-pointer text-center transition disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!chip.available"
              @click="selectQuickChip(chip)"
            >
              <span
                class="mx-auto flex h-9 w-9 items-center justify-center border border-transparent bg-[var(--app-subtle)] text-sm font-extrabold transition"
                :class="{ '!border-[var(--app-border)] !bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]': isQuickChipActive(chip) }"
              >
                <component :is="quickChipIcon(chip)" class="h-5 w-5" />
              </span>
              <span class="mt-1 block truncate text-xs font-extrabold">{{ chip.name }}</span>
            </button>
          </div>
          <p v-if="quickChips.length === 0" class="py-8 text-center text-xs font-bold text-[var(--app-muted)]">
            {{ quickForm.type === 'transfer' ? '至少需要两个账户才能转账' : '暂无分类' }}
          </p>
        </div>

        <div class="shrink-0 border-b border-[var(--app-border)] p-3">
          <label class="flex min-h-16 items-start gap-2 border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-muted)]">
            <ClipboardPenLine class="mt-0.5 h-4 w-4" />
            <textarea
              v-model="quickForm.note"
              class="min-h-12 min-w-0 flex-1 resize-none bg-transparent text-xs font-bold leading-5 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
              placeholder="添加备注..."
            />
          </label>

          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-extrabold text-[var(--app-muted)]">
            <label class="flex h-7 items-center gap-1 border border-[var(--app-border-soft)] px-2">
              <CalendarDays class="h-3.5 w-3.5" />
              <input v-model="quickForm.date" type="datetime-local" class="w-[11rem] bg-transparent font-bold text-[var(--app-text)] outline-none" />
            </label>
            <BaseSelect v-model="quickForm.accountId" :options="accountOptions" placement="top" class="h-7 max-w-36 text-[11px]" />
            <BaseSelect
              v-if="quickForm.type === 'transfer'"
              v-model="quickForm.transferAccountId"
              :options="transferAccountOptions"
              placement="top"
              class="h-7 max-w-36 text-[11px]"
            />
            <span class="flex h-7 max-w-32 items-center truncate border border-[var(--app-border-soft)] px-2 text-[var(--app-text)]">
              {{ selectedQuickTargetName }}
            </span>
            <span class="flex h-7 max-w-32 items-center truncate border border-[var(--app-border-soft)] px-2 text-[var(--app-text)]">
              {{ selectedQuickAccountName }}
            </span>
          </div>
        </div>

        <div class="shrink-0 p-3">
          <div class="mb-2 grid grid-cols-[auto_1fr] items-center gap-2">
            <div class="flex items-center gap-2">
              <Calculator class="h-4 w-4 text-[var(--app-muted)]" />
              <p class="text-sm font-extrabold">金额</p>
            </div>
            <input
              v-model="quickForm.amount"
              inputmode="decimal"
              class="h-9 min-w-0 border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-right font-mono text-base font-extrabold outline-none focus:border-[var(--app-border)]"
              placeholder="0.00"
            />
          </div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="key in keypadKeys"
              :key="key"
              type="button"
              class="h-12 cursor-pointer border border-[var(--app-border-soft)] bg-[var(--app-subtle)] font-mono text-sm font-extrabold transition hover:border-[var(--app-border)] disabled:cursor-not-allowed disabled:opacity-70"
              :class="{ '!bg-[var(--app-inverse)] !text-[var(--app-inverse-text)]': key === '完成' }"
              :disabled="quickSaving && key === '完成'"
              @click="handleKeypadKey(key)"
            >
              {{ key === '完成' && quickSaving ? '保存中' : key }}
            </button>
          </div>
          <p v-if="quickError" class="mt-2 border border-[var(--app-border)] bg-[var(--app-subtle)] px-2 py-1.5 text-xs font-bold text-expense">{{ quickError }}</p>
          <p v-else-if="quickSuccess" class="mt-2 border border-[var(--app-border)] bg-[var(--app-subtle)] px-2 py-1.5 text-xs font-bold text-income">{{ quickSuccess }}</p>
          <p v-else class="mt-2 truncate text-right font-mono text-xs font-extrabold text-[var(--app-muted)]">{{ amountPreview }}</p>
        </div>
      </form>
    </aside>
  </div>
</template>
