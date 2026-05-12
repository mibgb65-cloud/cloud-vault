import { newId } from '../utils/id'
import { nowIso } from '../utils/date'

export const defaultExpenseCategories = [
  ['餐饮', 'utensils', '#F97316'],
  ['交通', 'car', '#0EA5E9'],
  ['购物', 'shopping-bag', '#EC4899'],
  ['居住', 'home', '#6366F1'],
  ['娱乐', 'gamepad-2', '#8B5CF6'],
  ['医疗', 'heart-pulse', '#EF4444'],
  ['教育', 'book-open', '#14B8A6'],
  ['旅行', 'plane', '#06B6D4'],
  ['人情', 'gift', '#F59E0B'],
  ['其他支出', 'more-horizontal', '#64748B']
] as const

export const defaultIncomeCategories = [
  ['工资', 'wallet', '#059669'],
  ['奖金', 'trophy', '#10B981'],
  ['投资', 'trending-up', '#22C55E'],
  ['兼职', 'briefcase', '#84CC16'],
  ['退款', 'rotate-ccw', '#2DD4BF'],
  ['其他收入', 'more-horizontal', '#64748B']
] as const

export interface DefaultBookInput {
  db: D1Database
  userId: string
  currency: string
  now?: string
}

export function buildDefaultBookStatements({ db, userId, currency, now = nowIso() }: DefaultBookInput) {
  const bookId = newId('book')
  const accountId = newId('account')
  const statements = [
    db
      .prepare(
        `INSERT INTO books (id, owner_user_id, name, type, default_currency, icon, created_at, updated_at)
         VALUES (?, ?, ?, 'personal', ?, 'book-open', ?, ?)`
      )
      .bind(bookId, userId, '我的账本', currency, now, now),
    db
      .prepare(
        `INSERT INTO book_members (book_id, user_id, role, status, joined_at)
         VALUES (?, ?, 'owner', 'active', ?)`
      )
      .bind(bookId, userId, now),
    db
      .prepare(
        `INSERT INTO accounts (
          id, book_id, created_by, name, type, currency, opening_balance, cached_balance,
          icon, color, include_in_assets, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, '现金', 'cash', ?, 0, 0, 'wallet', '#2563EB', 1, 0, ?, ?)`
      )
      .bind(accountId, bookId, userId, currency, now, now)
  ]

  let sortOrder = 0
  for (const [name, icon, color] of defaultExpenseCategories) {
    statements.push(
      db
        .prepare(
          `INSERT INTO categories (id, book_id, created_by, name, type, icon, color, is_system, sort_order, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'expense', ?, ?, 1, ?, ?, ?)`
        )
        .bind(newId('category'), bookId, name, icon, color, sortOrder, now, now)
    )
    sortOrder += 1
  }

  sortOrder = 0
  for (const [name, icon, color] of defaultIncomeCategories) {
    statements.push(
      db
        .prepare(
          `INSERT INTO categories (id, book_id, created_by, name, type, icon, color, is_system, sort_order, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'income', ?, ?, 1, ?, ?, ?)`
        )
        .bind(newId('category'), bookId, name, icon, color, sortOrder, now, now)
    )
    sortOrder += 1
  }

  return { bookId, statements }
}
