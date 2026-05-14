<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import MetricCard from '@/components/ui/MetricCard.vue'
import {
  getCategoryBreakdown,
  getSummary,
  getTrends,
  type CategoryBreakdownItem,
  type SummaryReport,
  type TrendReportItem
} from '@/services/reports.api'
import { useBookStore } from '@/stores/book.store'
import { monthRange } from '@/utils/date'
import { formatMoney } from '@/utils/money'

use([BarChart, CanvasRenderer, GridComponent, LegendComponent, LineChart, PieChart, TooltipComponent])

const bookStore = useBookStore()
const summary = ref<SummaryReport | null>(null)
const trends = ref<TrendReportItem[]>([])
const categories = ref<CategoryBreakdownItem[]>([])
const loading = ref(false)
const range = ref(monthRange())

const currency = computed(() => bookStore.currentBook?.defaultCurrency || 'CNY')
const maxCategoryAmount = computed(() => Math.max(...categories.value.map((item) => item.amount), 1))
const trendRows = computed(() => {
  const rows = new Map<string, { dateKey: string; income: number; expense: number; balance: number }>()
  for (const item of trends.value) {
    const row = rows.get(item.dateKey) ?? { dateKey: item.dateKey, income: 0, expense: 0, balance: 0 }
    if (item.type === 'income') {
      row.income += item.amount
      row.balance += item.amount
    }
    if (item.type === 'expense') {
      row.expense += item.amount
      row.balance -= item.amount
    }
    rows.set(item.dateKey, row)
  }
  return [...rows.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
})
const largestDailyAmount = computed(() => Math.max(...trendRows.value.map((item) => Math.max(item.income, item.expense)), 1))
const trendChartOption = computed(() => ({
  color: ['#15803D', '#DC2626', '#111827'],
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: number) => formatMoney(Number(value), currency.value)
  },
  legend: {
    top: 0,
    textStyle: { color: '#6B7280', fontWeight: 700 }
  },
  grid: {
    top: 44,
    right: 24,
    bottom: 28,
    left: 56
  },
  xAxis: {
    type: 'category',
    data: trendRows.value.map((row) => row.dateKey.slice(5)),
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      formatter: (value: number) => `${Math.round(value / 100)}`
    }
  },
  series: [
    {
      name: '收入',
      type: 'line',
      smooth: true,
      data: trendRows.value.map((row) => row.income)
    },
    {
      name: '支出',
      type: 'line',
      smooth: true,
      data: trendRows.value.map((row) => row.expense)
    },
    {
      name: '结余',
      type: 'bar',
      data: trendRows.value.map((row) => row.balance)
    }
  ]
}))
const categoryChartOption = computed(() => ({
  color: ['#DC2626', '#F59E0B', '#2563EB', '#15803D', '#7C3AED', '#0F766E', '#4B5563'],
  tooltip: {
    trigger: 'item',
    valueFormatter: (value: number) => formatMoney(Number(value), currency.value)
  },
  legend: {
    bottom: 0,
    type: 'scroll',
    textStyle: { color: '#6B7280', fontWeight: 700 }
  },
  series: [
    {
      name: '支出分类',
      type: 'pie',
      radius: ['44%', '70%'],
      center: ['50%', '43%'],
      avoidLabelOverlap: true,
      label: {
        formatter: '{b}'
      },
      data: categories.value.map((item) => ({
        name: item.categoryName,
        value: item.amount
      }))
    }
  ]
}))

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const [summaryResult, trendResult, categoryResult] = await Promise.all([
      getSummary(bookStore.currentBookId, range.value.dateFrom, range.value.dateTo),
      getTrends(bookStore.currentBookId, range.value.dateFrom, range.value.dateTo),
      getCategoryBreakdown(bookStore.currentBookId, range.value.dateFrom, range.value.dateTo)
    ])
    summary.value = summaryResult
    trends.value = trendResult.items
    categories.value = categoryResult.items
  } finally {
    loading.value = false
  }
}

function resetMonth() {
  range.value = monthRange()
  void load()
}

onMounted(load)
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">reports</p>
        <h1 class="text-4xl font-bold leading-tight">统计</h1>
        <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">收入、支出、分类和每日趋势</p>
      </div>
      <form class="grid gap-2 sm:grid-cols-[150px_150px_auto_auto]" @submit.prevent="load">
        <BaseInput v-model="range.dateFrom" type="date" />
        <BaseInput v-model="range.dateTo" type="date" />
        <BaseButton type="submit" :disabled="loading">应用</BaseButton>
        <BaseButton variant="ghost" @click="resetMonth">本月</BaseButton>
      </form>
    </div>

    <div class="grid gap-0 md:grid-cols-4">
      <MetricCard label="收入" :value="formatMoney(summary?.income || 0, currency)" tone="income" />
      <MetricCard label="支出" :value="formatMoney(summary?.expense || 0, currency)" tone="expense" />
      <MetricCard label="结余" :value="formatMoney(summary?.balance || 0, currency)" />
      <MetricCard label="净资产" :value="formatMoney(summary?.netAssets || 0, currency)" tone="warning" />
    </div>

    <section class="grid gap-3 xl:grid-cols-[1fr_420px]">
      <div class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-extrabold">收支趋势图</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ trendRows.length }} 天</p>
        </div>
        <VChart v-if="trendRows.length > 0" class="h-72 w-full" :option="trendChartOption" autoresize />
        <p v-else class="py-20 text-center text-sm font-bold text-[var(--app-muted)]">暂无趋势数据</p>
      </div>

      <div class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-extrabold">分类占比图</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ categories.length }} 类</p>
        </div>
        <VChart v-if="categories.length > 0" class="h-72 w-full" :option="categoryChartOption" autoresize />
        <p v-else class="py-20 text-center text-sm font-bold text-[var(--app-muted)]">暂无分类支出</p>
      </div>
    </section>

    <section class="grid gap-3 xl:grid-cols-[1fr_420px]">
      <div class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-11 items-center justify-between border-b border-[var(--app-border)] px-3">
          <h2 class="text-sm font-extrabold">每日趋势</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ trendRows.length }} 天</p>
        </div>
        <div class="divide-y divide-[var(--app-border-soft)]">
          <div v-for="row in trendRows" :key="row.dateKey" class="grid gap-3 px-3 py-2 md:grid-cols-[100px_1fr_1fr_120px]">
            <p class="font-mono text-xs font-extrabold">{{ row.dateKey }}</p>
            <div>
              <div class="h-2 bg-[var(--app-track)]">
                <div class="h-2 bg-income" :style="{ width: `${Math.max((row.income / largestDailyAmount) * 100, row.income > 0 ? 3 : 0)}%` }" />
              </div>
              <p class="mt-1 font-mono text-xs font-bold text-income">{{ formatMoney(row.income, currency) }}</p>
            </div>
            <div>
              <div class="h-2 bg-[var(--app-track)]">
                <div class="h-2 bg-expense" :style="{ width: `${Math.max((row.expense / largestDailyAmount) * 100, row.expense > 0 ? 3 : 0)}%` }" />
              </div>
              <p class="mt-1 font-mono text-xs font-bold text-expense">{{ formatMoney(row.expense, currency) }}</p>
            </div>
            <p class="text-right font-mono text-xs font-extrabold">{{ formatMoney(row.balance, currency) }}</p>
          </div>
          <p v-if="!loading && trendRows.length === 0" class="py-10 text-center text-sm font-bold text-[var(--app-muted)]">暂无趋势数据</p>
        </div>
      </div>

      <div class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-11 items-center justify-between border-b border-[var(--app-border)] px-3">
          <h2 class="text-sm font-extrabold">支出分类排行</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ categories.length }} 类</p>
        </div>
        <div class="divide-y divide-[var(--app-border-soft)]">
          <div v-for="item in categories" :key="item.categoryId" class="px-3 py-3">
            <div class="mb-2 flex items-center justify-between gap-3">
              <p class="truncate text-sm font-extrabold">{{ item.categoryName }}</p>
              <p class="font-mono text-sm font-extrabold text-expense">{{ formatMoney(item.amount, currency) }}</p>
            </div>
            <div class="h-2 bg-[var(--app-track)]">
              <div class="h-2 bg-expense" :style="{ width: `${Math.max((item.amount / maxCategoryAmount) * 100, 3)}%` }" />
            </div>
          </div>
          <p v-if="!loading && categories.length === 0" class="py-10 text-center text-sm font-bold text-[var(--app-muted)]">暂无分类支出</p>
        </div>
      </div>
    </section>
  </div>
</template>
