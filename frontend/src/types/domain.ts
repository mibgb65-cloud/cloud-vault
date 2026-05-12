export type SystemRole = 'admin' | 'user'
export type TransactionType = 'expense' | 'income' | 'transfer'

export interface User {
  id: string
  email: string
  nickname: string
  avatarUrl?: string | null
  defaultCurrency: string
  locale: string
  timezone: string
  systemRole: SystemRole
  deletedAt?: string | null
}

export interface Book {
  id: string
  name: string
  type: string
  defaultCurrency: string
  icon?: string | null
  role?: string
}

export interface Account {
  id: string
  bookId: string
  name: string
  type: string
  currency: string
  openingBalance: number
  cachedBalance: number
  icon?: string | null
  color?: string | null
  includeInAssets: boolean
  creditLimit?: number | null
  statementDay?: number | null
  repaymentDay?: number | null
  archivedAt?: string | null
}

export interface Category {
  id: string
  bookId: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color?: string | null
  isSystem: boolean
  archivedAt?: string | null
}

export interface Tag {
  id: string
  bookId: string
  name: string
  color?: string | null
  archivedAt?: string | null
}

export interface Transaction {
  id: string
  bookId: string
  type: TransactionType
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  amount: number
  currency: string
  occurredAt: string
  dateKey: string
  note: string | null
  merchantName: string | null
  accountName?: string
  transferAccountName?: string
  categoryName?: string
  categoryIcon?: string
  tagIds: string[]
  deletedAt?: string | null
}

export interface Budget {
  id: string
  bookId: string
  name: string
  categoryId: string | null
  categoryName?: string | null
  amount: number
  currency: string
  periodStart: string
  periodEnd: string
  alertThreshold: number
  createdAt?: string
  updatedAt?: string
  archivedAt?: string | null
}

export interface BudgetUsage extends Budget {
  spent: number
  remaining: number
  percent: number
}
