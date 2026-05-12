<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Archive, Edit3, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { archiveCategory, createCategory, listCategories, updateCategory } from '@/services/categories.api'
import { archiveTag, createTag, listTags, updateTag } from '@/services/tags.api'
import { useBookStore } from '@/stores/book.store'
import { useThemeStore } from '@/stores/theme.store'
import type { Category, Tag } from '@/types/domain'

const theme = useThemeStore()
const bookStore = useBookStore()
const { locale } = useI18n({ useScope: 'global' })
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const editingCategoryId = ref<string | null>(null)
const editingTagId = ref<string | null>(null)
const categoryForm = ref({
  name: '',
  type: 'expense' as 'income' | 'expense',
  color: '#111111'
})
const tagForm = ref({
  name: '',
  color: '#111111'
})

const themeLabel = computed(() => (theme.mode === 'dark' ? '深色' : theme.mode === 'light' ? '浅色' : '跟随系统'))
const languageLabel = computed(() => (locale.value === 'en-US' ? 'English' : '简体中文'))
const expenseCount = computed(() => categories.value.filter((category) => category.type === 'expense').length)
const incomeCount = computed(() => categories.value.filter((category) => category.type === 'income').length)
const categoryTypeOptions = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' }
]

async function load() {
  if (!bookStore.currentBookId) {
    return
  }
  loading.value = true
  try {
    const [categoryResult, tagResult] = await Promise.all([listCategories(bookStore.currentBookId), listTags(bookStore.currentBookId)])
    categories.value = categoryResult.items
    tags.value = tagResult.items
  } finally {
    loading.value = false
  }
}

function resetCategoryForm() {
  editingCategoryId.value = null
  categoryForm.value = {
    name: '',
    type: 'expense',
    color: '#111111'
  }
  error.value = ''
}

function resetTagForm() {
  editingTagId.value = null
  tagForm.value = {
    name: '',
    color: '#111111'
  }
  error.value = ''
}

function editCategory(category: Category) {
  editingCategoryId.value = category.id
  categoryForm.value = {
    name: category.name,
    type: category.type,
    color: category.color || '#111111'
  }
  error.value = ''
  success.value = ''
}

function editTag(tag: Tag) {
  editingTagId.value = tag.id
  tagForm.value = {
    name: tag.name,
    color: tag.color || '#111111'
  }
  error.value = ''
  success.value = ''
}

async function submitCategory() {
  if (!bookStore.currentBookId) {
    return
  }
  const name = categoryForm.value.name.trim()
  if (!name) {
    error.value = '请输入分类名称'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const input = {
      name,
      type: categoryForm.value.type,
      icon: 'tag',
      color: categoryForm.value.color || null
    }
    if (editingCategoryId.value) {
      await updateCategory(bookStore.currentBookId, editingCategoryId.value, input)
      success.value = '分类已更新'
    } else {
      await createCategory(bookStore.currentBookId, input)
      success.value = '分类已创建'
    }
    resetCategoryForm()
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存分类失败'
  } finally {
    saving.value = false
  }
}

async function submitTag() {
  if (!bookStore.currentBookId) {
    return
  }
  const name = tagForm.value.name.trim()
  if (!name) {
    error.value = '请输入标签名称'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const input = {
      name,
      color: tagForm.value.color || null
    }
    if (editingTagId.value) {
      await updateTag(bookStore.currentBookId, editingTagId.value, input)
      success.value = '标签已更新'
    } else {
      await createTag(bookStore.currentBookId, input)
      success.value = '标签已创建'
    }
    resetTagForm()
    await load()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存标签失败'
  } finally {
    saving.value = false
  }
}

async function removeCategory(category: Category) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await archiveCategory(bookStore.currentBookId, category.id)
    success.value = '分类已归档'
    if (editingCategoryId.value === category.id) {
      resetCategoryForm()
    }
    await load()
  } catch (removeError) {
    error.value = removeError instanceof Error ? removeError.message : '归档分类失败'
  } finally {
    saving.value = false
  }
}

async function removeTag(tag: Tag) {
  if (!bookStore.currentBookId) {
    return
  }
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await archiveTag(bookStore.currentBookId, tag.id)
    success.value = '标签已归档'
    if (editingTagId.value === tag.id) {
      resetTagForm()
    }
    await load()
  } catch (removeError) {
    error.value = removeError instanceof Error ? removeError.message : '归档标签失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">settings</p>
      <h1 class="text-4xl font-bold leading-tight">设置</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">个人偏好、分类和标签管理</p>
    </div>

    <section class="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">主题</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ themeLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">顶部导航栏右侧切换。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">默认货币</p>
        <p class="mt-3 font-mono text-lg font-extrabold">CNY</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">后续同步个人设置。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">语言</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ languageLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">顶部导航栏右侧切换。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">数据规模</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ categories.length }} / {{ tags.length }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">分类 / 标签。</p>
      </div>
    </section>

    <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
    <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>

    <section class="grid gap-3 xl:grid-cols-[360px_1fr]">
      <div class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-extrabold">{{ editingCategoryId ? '编辑分类' : '新增分类' }}</h2>
          <BaseButton v-if="editingCategoryId" variant="ghost" size="sm" @click="resetCategoryForm">
            <X class="h-4 w-4" />
            取消
          </BaseButton>
        </div>
        <form class="grid gap-3" @submit.prevent="submitCategory">
          <BaseInput v-model="categoryForm.name" placeholder="分类名称" />
          <BaseSelect v-model="categoryForm.type" :options="categoryTypeOptions" />
          <BaseInput v-model="categoryForm.color" placeholder="颜色，如 #111111" />
          <BaseButton type="submit" :disabled="saving">
            {{ saving ? '保存中' : editingCategoryId ? '保存分类' : '创建分类' }}
          </BaseButton>
        </form>
      </div>

      <div class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-11 items-center justify-between border-b border-[var(--app-border)] px-3">
          <h2 class="text-sm font-extrabold">分类</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">支出 {{ expenseCount }} / 收入 {{ incomeCount }}</p>
        </div>
        <div class="grid gap-px bg-[var(--app-border-soft)] p-px md:grid-cols-2 2xl:grid-cols-3">
          <div v-for="category in categories" :key="category.id" class="bg-[var(--app-surface)] p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-extrabold">{{ category.name }}</p>
                <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ category.type }}</p>
              </div>
              <span class="h-5 w-5 shrink-0 border border-[var(--app-border)]" :style="{ backgroundColor: category.color || 'transparent' }" />
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <BaseButton variant="secondary" size="sm" @click="editCategory(category)">
                <Edit3 class="h-4 w-4" />
                编辑
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="saving || category.isSystem" @click="removeCategory(category)">
                <Archive class="h-4 w-4" />
                归档
              </BaseButton>
            </div>
          </div>
          <p v-if="!loading && categories.length === 0" class="col-span-full bg-[var(--app-surface)] py-10 text-center text-sm font-bold text-[var(--app-muted)]">
            暂无分类。
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 xl:grid-cols-[360px_1fr]">
      <div class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-extrabold">{{ editingTagId ? '编辑标签' : '新增标签' }}</h2>
          <BaseButton v-if="editingTagId" variant="ghost" size="sm" @click="resetTagForm">
            <X class="h-4 w-4" />
            取消
          </BaseButton>
        </div>
        <form class="grid gap-3" @submit.prevent="submitTag">
          <BaseInput v-model="tagForm.name" placeholder="标签名称" />
          <BaseInput v-model="tagForm.color" placeholder="颜色，如 #111111" />
          <BaseButton type="submit" :disabled="saving">
            {{ saving ? '保存中' : editingTagId ? '保存标签' : '创建标签' }}
          </BaseButton>
        </form>
      </div>

      <div class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-11 items-center justify-between border-b border-[var(--app-border)] px-3">
          <h2 class="text-sm font-extrabold">标签</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ tags.length }} 个</p>
        </div>
        <div class="grid gap-px bg-[var(--app-border-soft)] p-px md:grid-cols-3 2xl:grid-cols-4">
          <div v-for="tag in tags" :key="tag.id" class="bg-[var(--app-surface)] p-3">
            <div class="flex items-center justify-between gap-3">
              <p class="truncate text-sm font-extrabold">{{ tag.name }}</p>
              <span class="h-5 w-5 shrink-0 border border-[var(--app-border)]" :style="{ backgroundColor: tag.color || 'transparent' }" />
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <BaseButton variant="secondary" size="sm" @click="editTag(tag)">
                <Edit3 class="h-4 w-4" />
                编辑
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="saving" @click="removeTag(tag)">
                <Archive class="h-4 w-4" />
                归档
              </BaseButton>
            </div>
          </div>
          <p v-if="!loading && tags.length === 0" class="col-span-full bg-[var(--app-surface)] py-10 text-center text-sm font-bold text-[var(--app-muted)]">
            暂无标签。
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
