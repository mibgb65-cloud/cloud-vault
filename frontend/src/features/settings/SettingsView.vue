<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Archive, Edit3, LogOut, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { changePassword, logoutOtherDevices } from '@/services/auth.api'
import { archiveCategory, createCategory, listCategories, updateCategory } from '@/services/categories.api'
import { archiveTag, createTag, listTags, updateTag } from '@/services/tags.api'
import { useAuthStore } from '@/stores/auth.store'
import { useBookStore } from '@/stores/book.store'
import { useThemeStore } from '@/stores/theme.store'
import type { Book, Category, Tag } from '@/types/domain'

const theme = useThemeStore()
const bookStore = useBookStore()
const auth = useAuthStore()
const { locale } = useI18n({ useScope: 'global' })
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const loading = ref(false)
const saving = ref(false)
const profileSaving = ref(false)
const passwordSaving = ref(false)
const bookSaving = ref(false)
const sessionSaving = ref(false)
const error = ref('')
const success = ref('')
const editingCategoryId = ref<string | null>(null)
const editingTagId = ref<string | null>(null)
const editingBookId = ref<string | null>(null)
const profileForm = ref({
  nickname: '',
  avatarUrl: '',
  defaultCurrency: 'CNY',
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai'
})
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const bookForm = ref({
  name: '',
  defaultCurrency: 'CNY'
})
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
const defaultCurrencyLabel = computed(() => auth.user?.defaultCurrency || 'CNY')
const timezoneLabel = computed(() => auth.user?.timezone || 'Asia/Shanghai')
const expenseCount = computed(() => categories.value.filter((category) => category.type === 'expense').length)
const incomeCount = computed(() => categories.value.filter((category) => category.type === 'income').length)
const categoryTypeOptions = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' }
]
const localeOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const timezoneOptions = computed(() => {
  const options = [
    { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
    { label: 'UTC', value: 'UTC' },
    { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
    { label: 'America/New_York', value: 'America/New_York' },
    { label: 'Europe/London', value: 'Europe/London' }
  ]
  return options.some((option) => option.value === profileForm.value.timezone)
    ? options
    : [{ label: profileForm.value.timezone, value: profileForm.value.timezone }, ...options]
})

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

function syncProfileForm() {
  if (!auth.user) {
    return
  }
  profileForm.value = {
    nickname: auth.user.nickname,
    avatarUrl: auth.user.avatarUrl || '',
    defaultCurrency: auth.user.defaultCurrency || 'CNY',
    locale: auth.user.locale || locale.value,
    timezone: auth.user.timezone || 'Asia/Shanghai'
  }
}

async function submitProfile() {
  if (!auth.user) {
    return
  }
  const nickname = profileForm.value.nickname.trim()
  if (!nickname) {
    error.value = '请输入昵称'
    return
  }

  profileSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const nextLocale = profileForm.value.locale || 'zh-CN'
    const nextCurrency = profileForm.value.defaultCurrency.trim().toUpperCase()
    await auth.updateProfile({
      nickname,
      avatarUrl: profileForm.value.avatarUrl.trim() || null,
      defaultCurrency: nextCurrency,
      locale: nextLocale,
      timezone: profileForm.value.timezone || 'Asia/Shanghai'
    })
    locale.value = nextLocale
    localStorage.setItem('cloud-vault-locale', nextLocale)
    success.value = '个人资料已保存'
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存个人资料失败'
  } finally {
    profileSaving.value = false
  }
}

function resetPasswordForm() {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
}

async function submitPassword() {
  if (passwordForm.value.newPassword.length < 8) {
    error.value = '新密码至少 8 位'
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    error.value = '两次输入的新密码不一致'
    return
  }

  passwordSaving.value = true
  error.value = ''
  success.value = ''
  try {
    await changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    })
    resetPasswordForm()
    success.value = '密码已更新'
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '修改密码失败'
  } finally {
    passwordSaving.value = false
  }
}

function resetBookForm() {
  editingBookId.value = null
  bookForm.value = {
    name: '',
    defaultCurrency: auth.user?.defaultCurrency || bookStore.currentBook?.defaultCurrency || 'CNY'
  }
  error.value = ''
}

function editBook(book: Book) {
  editingBookId.value = book.id
  bookForm.value = {
    name: book.name,
    defaultCurrency: book.defaultCurrency
  }
  error.value = ''
  success.value = ''
}

function canEditBook(book: Book) {
  return book.role === 'owner' || book.role === 'admin'
}

function canArchiveBook(book: Book) {
  return book.role === 'owner' && bookStore.books.length > 1
}

async function submitBook() {
  const name = bookForm.value.name.trim()
  if (!name) {
    error.value = '请输入账本名称'
    return
  }

  bookSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const input = {
      name,
      defaultCurrency: bookForm.value.defaultCurrency.trim().toUpperCase(),
      icon: 'book-open'
    }
    if (editingBookId.value) {
      await bookStore.updateCurrentBook(editingBookId.value, input)
      success.value = '账本已更新'
    } else {
      await bookStore.createNewBook(input)
      success.value = '账本已创建'
    }
    resetBookForm()
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : '保存账本失败'
  } finally {
    bookSaving.value = false
  }
}

async function archiveBookItem(book: Book) {
  if (!canArchiveBook(book) || !window.confirm(`确认归档账本「${book.name}」？`)) {
    return
  }

  bookSaving.value = true
  error.value = ''
  success.value = ''
  try {
    await bookStore.archiveExistingBook(book.id)
    if (editingBookId.value === book.id) {
      resetBookForm()
    }
    success.value = '账本已归档'
  } catch (archiveError) {
    error.value = archiveError instanceof Error ? archiveError.message : '归档账本失败'
  } finally {
    bookSaving.value = false
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

async function handleLogoutOtherDevices() {
  if (!window.confirm('确认退出其他设备？当前设备会保持登录。')) {
    return
  }

  sessionSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await logoutOtherDevices()
    success.value = result.loggedOutDevices > 0 ? `已退出 ${result.loggedOutDevices} 个其他设备` : '没有其他已登录设备'
  } catch (logoutError) {
    error.value = logoutError instanceof Error ? logoutError.message : '退出其他设备失败'
  } finally {
    sessionSaving.value = false
  }
}

onMounted(() => {
  resetBookForm()
  void load()
})
watch(() => auth.user, syncProfileForm, { immediate: true })
watch(() => bookStore.currentBookId, load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="mb-2 font-mono text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--app-muted)]">settings</p>
      <h1 class="text-4xl font-bold leading-tight">设置</h1>
      <p class="mt-2 text-sm font-medium text-[var(--app-muted)]">个人资料、账本、分类和标签管理</p>
    </div>

    <section class="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">主题</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ themeLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">顶部导航栏右侧切换。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">默认货币</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ defaultCurrencyLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">用于新账本和个人偏好。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">语言</p>
        <p class="mt-3 font-mono text-lg font-extrabold">{{ languageLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">顶部导航栏右侧切换。</p>
      </div>
      <div class="min-h-32 border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p class="text-sm font-bold">时区</p>
        <p class="mt-3 truncate font-mono text-lg font-extrabold">{{ timezoneLabel }}</p>
        <p class="mt-4 text-sm font-medium text-[var(--app-muted)]">用于日期和本月统计。</p>
      </div>
    </section>

    <p v-if="error" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-expense">{{ error }}</p>
    <p v-else-if="success" class="border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm font-bold text-income">{{ success }}</p>

    <section class="grid gap-3 xl:grid-cols-[1fr_360px]">
      <form class="border border-[var(--app-border)] bg-[var(--app-surface)] p-4" @submit.prevent="submitProfile">
        <div class="mb-3">
          <h2 class="text-sm font-extrabold">个人资料</h2>
          <p class="mt-1 text-sm font-medium text-[var(--app-muted)]">{{ auth.user?.email }}</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="grid gap-2">
            <span class="text-sm font-bold">昵称</span>
            <BaseInput v-model="profileForm.nickname" placeholder="昵称" />
          </label>
          <label class="grid gap-2">
            <span class="text-sm font-bold">头像 URL</span>
            <BaseInput v-model="profileForm.avatarUrl" placeholder="https://..." />
          </label>
          <label class="grid gap-2">
            <span class="text-sm font-bold">默认货币</span>
            <BaseInput v-model="profileForm.defaultCurrency" maxlength="3" placeholder="CNY" />
          </label>
          <label class="grid gap-2">
            <span class="text-sm font-bold">语言</span>
            <BaseSelect v-model="profileForm.locale" :options="localeOptions" />
          </label>
          <label class="grid gap-2 md:col-span-2">
            <span class="text-sm font-bold">时区</span>
            <BaseSelect v-model="profileForm.timezone" :options="timezoneOptions" />
          </label>
        </div>
        <BaseButton type="submit" class="mt-3" :disabled="profileSaving">
          {{ profileSaving ? '保存中' : '保存个人资料' }}
        </BaseButton>
      </form>

      <form class="border border-[var(--app-border)] bg-[var(--app-surface)] p-4" @submit.prevent="submitPassword">
        <div class="mb-3">
          <h2 class="text-sm font-extrabold">修改密码</h2>
          <p class="mt-1 text-sm font-medium text-[var(--app-muted)]">更新后当前登录状态保持不变。</p>
        </div>
        <div class="grid gap-3">
          <BaseInput v-model="passwordForm.currentPassword" type="password" placeholder="当前密码" />
          <BaseInput v-model="passwordForm.newPassword" type="password" placeholder="新密码，至少 8 位" />
          <BaseInput v-model="passwordForm.confirmPassword" type="password" placeholder="再次输入新密码" />
          <BaseButton type="submit" :disabled="passwordSaving">
            {{ passwordSaving ? '更新中' : '更新密码' }}
          </BaseButton>
        </div>
      </form>
    </section>

    <section class="grid gap-3 xl:grid-cols-[360px_1fr]">
      <form class="border border-[var(--app-border)] bg-[var(--app-surface)] p-3" @submit.prevent="submitBook">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-extrabold">{{ editingBookId ? '编辑账本' : '新增账本' }}</h2>
          <BaseButton v-if="editingBookId" variant="ghost" size="sm" @click="resetBookForm">
            <X class="h-4 w-4" />
            取消
          </BaseButton>
        </div>
        <div class="grid gap-3">
          <BaseInput v-model="bookForm.name" placeholder="账本名称" />
          <BaseInput v-model="bookForm.defaultCurrency" maxlength="3" placeholder="默认货币，如 CNY" />
          <BaseButton type="submit" :disabled="bookSaving">
            {{ bookSaving ? '保存中' : editingBookId ? '保存账本' : '创建账本' }}
          </BaseButton>
        </div>
      </form>

      <div class="border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div class="flex h-11 items-center justify-between border-b border-[var(--app-border)] px-3">
          <h2 class="text-sm font-extrabold">账本</h2>
          <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ bookStore.books.length }} 个</p>
        </div>
        <div class="grid gap-px bg-[var(--app-border-soft)] p-px md:grid-cols-2 xl:grid-cols-3">
          <div v-for="book in bookStore.books" :key="book.id" class="bg-[var(--app-surface)] p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-extrabold">{{ book.name }}</p>
                <p class="font-mono text-xs font-bold text-[var(--app-muted)]">{{ book.defaultCurrency }} / {{ book.role || 'member' }}</p>
              </div>
              <span v-if="book.id === bookStore.currentBookId" class="border border-[var(--app-border)] px-2 py-1 font-mono text-[10px] font-extrabold">当前</span>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2">
              <BaseButton variant="secondary" size="sm" @click="bookStore.setCurrentBook(book.id)">切换</BaseButton>
              <BaseButton variant="secondary" size="sm" :disabled="bookSaving || !canEditBook(book)" @click="editBook(book)">
                <Edit3 class="h-4 w-4" />
                编辑
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="bookSaving || !canArchiveBook(book)" @click="archiveBookItem(book)">
                <Archive class="h-4 w-4" />
                归档
              </BaseButton>
            </div>
          </div>
          <p v-if="bookStore.books.length === 0" class="col-span-full bg-[var(--app-surface)] py-10 text-center text-sm font-bold text-[var(--app-muted)]">
            暂无账本。
          </p>
        </div>
      </div>
    </section>

    <section class="border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-sm font-extrabold">登录设备</h2>
          <p class="mt-1 text-sm font-medium text-[var(--app-muted)]">最多 5 个活跃设备，当前设备保持登录。</p>
        </div>
        <BaseButton variant="secondary" :disabled="sessionSaving" @click="handleLogoutOtherDevices">
          <LogOut class="h-4 w-4" />
          {{ sessionSaving ? '处理中' : '退出其他设备' }}
        </BaseButton>
      </div>
    </section>

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
