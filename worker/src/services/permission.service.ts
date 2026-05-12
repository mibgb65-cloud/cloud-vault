import { HttpError } from '../utils/http-error'

export async function assertAccountInBook(db: D1Database, bookId: string, accountId: string) {
  const row = await db
    .prepare(`SELECT id, cached_balance FROM accounts WHERE id = ? AND book_id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(accountId, bookId)
    .first<{ id: string; cached_balance: number }>()

  if (!row) {
    throw new HttpError(422, 'ACCOUNT_ARCHIVED', '账户不存在或已归档')
  }

  return row
}

export async function assertCategoryInBook(db: D1Database, bookId: string, categoryId: string, type: string) {
  const row = await db
    .prepare(`SELECT id FROM categories WHERE id = ? AND book_id = ? AND type = ? AND archived_at IS NULL LIMIT 1`)
    .bind(categoryId, bookId, type)
    .first<{ id: string }>()

  if (!row) {
    throw new HttpError(422, 'CATEGORY_ARCHIVED', '分类不存在、类型不匹配或已归档')
  }

  return row
}

export async function assertTagsInBook(db: D1Database, bookId: string, tagIds: string[]) {
  if (tagIds.length === 0) {
    return
  }

  const placeholders = tagIds.map(() => '?').join(', ')
  const rows = await db
    .prepare(`SELECT id FROM tags WHERE book_id = ? AND archived_at IS NULL AND id IN (${placeholders})`)
    .bind(bookId, ...tagIds)
    .all<{ id: string }>()

  if ((rows.results ?? []).length !== new Set(tagIds).size) {
    throw new HttpError(422, 'VALIDATION_ERROR', '标签不存在或已归档')
  }
}
