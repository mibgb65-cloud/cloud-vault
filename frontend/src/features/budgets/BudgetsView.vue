<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Archive, Edit3, X } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import MetricCard from '@/components/ui/MetricCard.vue'
import { listCategories } from '@/services/categories.api'
import { archiveBudget, createBudget, listBudgetUsage, updateBudget } from '@/services/budgets.api'
import { useBookStore } from '@/stores/book.store'
import { monthRange } from '@/utils/date'
import { formatMoney, parseMoneyToMinorUnit } from '@/utils/money'
import type { BudgetUsage, Category } from '@/types/domain'

const bookStore = useBookStore()
const budgets = ref<BudgetUsage[]>([])
const categories = ref<Category[]>([])
const editingId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const defaultRange = monthRange()
const form = ref({
  name: '',
  categoryId: '',
  amount: '',
  periodStart: defaultRange.dateFrom,
  periodEnd: defaultRange.dateTo,
  alertThreshold: '80'
})

const currency = computed(() => bookStore.currentBook?.defaultCurrency || 'CNY')
const totalBudget = computed(() => budgets.value.reduce((sum, budget) => sum + budget.amount, 0))
const totalSpent = computed(() => budgets.value.reduce((sum, budget) => sum + budget.spent, 0))
const overBudgetCount = computed(() => budgets.value.filter((budget) => budget.spent > budget.amount).length)
const warningCount = computed(() => budgets.value.filter((budget) => budget.percent >= budget.alertThreshold).length)
const categoryOptions = computed(() => [
  { label: '总预算', value: '' },
  ...categories.value.map((category) => ({ label: category.name, value: category.id }))
])
const formTitle = computed(() => (editingId.value ? '编辑预算' : '新建预算'))

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const [budgetResult, categoryResult] = await Promise.all([
      listBudgetUsage(bookStore.currentBookId),
      listCategories(bookStore.currentBookId, 'expense')
    ])
    budgets.value = budgetResult.items
    categories.value = categoryResult.items
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  const nextRange = monthRange()
  form.value = {
    name: '',
    categoryId: '',
    amount: '',
    periodStart: nextRange.dateFrom,
    periodEnd: nextRange.dateTo,
    alertThreshold: '80'
  }
  error.value = ''
}

function edit(budget: BudgetUsage) {
  editingId.value = budget.id
  form.value = {
    name: budget.name,
    categoryId: budget.categoryId || '',
    amount: String(budget.amount / 100),
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
    alertThreshold: String(budget.alertThreshold)
  }
  error.value = ''
  success.value = ''
}

async function submit() {
  if (!bookStore.currentBookId) {
    return
  }
  const name = form.value.name.trim()
  if (!name) {
    error.value = '请输入预算名称'
    return
  }
  const amount = parseMoneyToMinorUnit(form.value.amount)
  if (!amount || amount <= 0) {
    error.value = '请输入有效预算金额'
    return
  }
  const alertThreshold = Number(form.value.alertThreshold || 80)
  if (!Number.isFinite(alertThreshold) || alertThreshold < 1 || alertThreshold > 100) {
    error.value = '提醒阈值必须在 1 到 100 之间'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const input = {
      name,
      categoryId: form.value.categoryId || null,
      amount,
      currency: currency.value,
      periodStart: form.value.periodStart,
      periodEnd: form.value.periodEnd,
      alertThreshold
    }
    if (editingId.value) {
      await updateBudget(bookStore.currentBookId, editingId.value, input)
      success.value = '预算已更新'
    } else {
      await createBudget(bookStore.currentBookId, input)
      success.value = '预算已创建'
    }
    resetForm()
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存预算失败'
  } finally {
    saving.value = false
  }
}

async function archive(budget: BudgetUsage) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await archiveBudget(bookStore.currentBookId, budget.id)
    success.value = '预算已归档'
    if (editingId.value === budget.id) {
      resetForm()
    }
    await load()
  } catch (archiveError) {
    error.value = archiveError instanceof Error ? archiveError.message : '归档预算失败'
  } finally {
    saving.value = false
  }
}

function budgetTone(budget: BudgetUsage) {
  if (budget.spent > budget.amount) {
    return 'bg-expense'
  }
  if (budget.percent >= budget.alertThreshold) {
    return 'bg-warning'
  }
  return 'bg-income'
}

onMounted(load)
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">budget</p>
      <h1 class="text-4xl font-bold leading-tight">预算</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">创建预算并跟踪当前流水使用情况</p>
    </div>

    <section class="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="预算总额" :value="formatMoney(totalBudget, currency)" />
      <MetricCard label="已用金额" :value="formatMoney(totalSpent, currency)" tone="expense" />
      <MetricCard label="触发提醒" :value="String(warningCount)" tone="warning" />
      <MetricCard label="超预算" :value="String(overBudgetCount)" tone="expense" />
    </section>

    <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-extrabold">{{ formTitle }}</h2>
        <BaseButton v-if="editingId" variant="ghost" size="sm" @click="resetForm">
          <X class="h-4 w-4" />
          取消编辑
        </BaseButton>
      </div>
      <form class="grid gap-3 md:grid-cols-7" @submit.prevent="submit">
        <BaseInput v-model="form.name" class="md:col-span-2" placeholder="预算名称" />
        <BaseSelect v-model="form.categoryId" :options="categoryOptions" />
        <BaseInput v-model="form.amount" inputmode="decimal" placeholder="预算金额" />
        <BaseInput v-model="form.periodStart" type="date" />
        <BaseInput v-model="form.periodEnd" type="date" />
        <BaseInput v-model="form.alertThreshold" inputmode="numeric" placeholder="提醒阈值 %" />
        <BaseButton type="submit" :disabled="saving">
          {{ saving ? '保存中' : editingId ? '保存预算' : '创建预算' }}
        </BaseButton>
      </form>
      <p v-if="error" class="mt-3 border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
      <p v-else-if="success" class="mt-3 border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>
    </section>

    <section class="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
      <div v-for="budget in budgets" :key="budget.id" class="grid min-h-44 gap-3 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-bold">{{ budget.name }}</p>
            <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ budget.categoryName || '总预算' }}</p>
          </div>
          <span class="border border-[var(--app-border)] px-2 py-1 font-mono text-xs font-extrabold">{{ budget.percent }}%</span>
        </div>
        <div>
          <div class="h-2 bg-[var(--app-track)]">
            <div class="h-2" :class="budgetTone(budget)" :style="{ width: `${Math.min(Math.max(budget.percent, budget.spent > 0 ? 3 : 0), 100)}%` }" />
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2 font-mono text-xs font-extrabold">
            <p>已用 {{ formatMoney(budget.spent, budget.currency) }}</p>
            <p class="text-right">预算 {{ formatMoney(budget.amount, budget.currency) }}</p>
          </div>
        </div>
        <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ budget.periodStart }} / {{ budget.periodEnd }}</p>
        <div class="grid grid-cols-2 gap-2 self-end">
          <BaseButton variant="secondary" size="sm" @click="edit(budget)">
            <Edit3 class="h-4 w-4" />
            编辑
          </BaseButton>
          <BaseButton variant="ghost" size="sm" :disabled="saving" @click="archive(budget)">
            <Archive class="h-4 w-4" />
            归档
          </BaseButton>
        </div>
      </div>
      <p v-if="!loading && budgets.length === 0" class="col-span-full border border-[var(--app-border)] py-10 text-center text-sm font-bold text-[var(--app-muted)]">
        暂无预算，先创建一个月度总预算或分类预算。
      </p>
    </section>
  </div>
</template>
