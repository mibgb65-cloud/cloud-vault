import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { createBudgetSchema, updateBudgetSchema } from '../schemas/budget.schema'
import { assertCategoryInBook } from '../services/permission.service'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { ok } from '../utils/response'

export const budgetsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

function toBudget(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    name: String(row.name),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
    amount: Number(row.amount),
    currency: String(row.currency),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    alertThreshold: Number(row.alert_threshold),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }
}

async function assertBudget(db: D1Database, bookId: string, budgetId: string) {
  const row = await db
    .prepare(`SELECT id FROM budgets WHERE id = ? AND book_id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(budgetId, bookId)
    .first<{ id: string }>()

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', '预算不存在')
  }
}

budgetsRoutes.get('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const includeArchived = c.req.query('includeArchived') === 'true'
  const rows = await c.env.DB.prepare(
    `SELECT b.*, c.name AS category_name
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.book_id = ? ${includeArchived ? '' : 'AND b.archived_at IS NULL'}
     ORDER BY b.period_start DESC, b.created_at DESC`
  )
    .bind(bookId)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toBudget) })
})

budgetsRoutes.get('/usage', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const rows = await c.env.DB.prepare(
    `SELECT b.*, c.name AS category_name
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.book_id = ? AND b.archived_at IS NULL
     ORDER BY b.period_start DESC, b.created_at DESC`
  )
    .bind(bookId)
    .all<Record<string, unknown>>()

  const items = []
  for (const row of rows.results ?? []) {
    const budget = toBudget(row)
    const spent = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(base_amount), 0) AS total
       FROM transactions
       WHERE book_id = ?
         AND deleted_at IS NULL
         AND status = 'posted'
         AND type = 'expense'
         AND date_key BETWEEN ? AND ?
         AND (? IS NULL OR category_id = ?)`
    )
      .bind(bookId, budget.periodStart, budget.periodEnd, budget.categoryId, budget.categoryId)
      .first<{ total: number }>()

    items.push({
      ...budget,
      spent: Number(spent?.total ?? 0),
      remaining: budget.amount - Number(spent?.total ?? 0),
      percent: Math.round((Number(spent?.total ?? 0) / budget.amount) * 100)
    })
  }

  return ok(c, { items })
})

budgetsRoutes.post('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createBudgetSchema.parse(await c.req.json())
  if (input.categoryId) {
    await assertCategoryInBook(c.env.DB, bookId, input.categoryId, 'expense')
  }

  const budgetId = newId('budget')
  const now = nowIso()
  await c.env.DB.prepare(
    `INSERT INTO budgets (
      id, book_id, created_by, name, category_id, amount, currency, period_start, period_end, alert_threshold, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      budgetId,
      bookId,
      c.get('currentUser').id,
      input.name,
      input.categoryId ?? null,
      input.amount,
      input.currency,
      input.periodStart,
      input.periodEnd,
      input.alertThreshold,
      now,
      now
    )
    .run()

  return ok(c, { budget: { id: budgetId } }, 201)
})

budgetsRoutes.patch('/:budgetId', async (c) => {
  const bookId = c.req.param('bookId')!
  const budgetId = c.req.param('budgetId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  await assertBudget(c.env.DB, bookId, budgetId)
  const input = updateBudgetSchema.parse(await c.req.json())
  if (input.categoryId) {
    await assertCategoryInBook(c.env.DB, bookId, input.categoryId, 'expense')
  }

  const existing = await c.env.DB.prepare(`SELECT * FROM budgets WHERE id = ? AND book_id = ? LIMIT 1`)
    .bind(budgetId, bookId)
    .first<Record<string, unknown>>()

  await c.env.DB.prepare(
    `UPDATE budgets
     SET name = ?, category_id = ?, amount = ?, currency = ?, period_start = ?, period_end = ?, alert_threshold = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      input.name ?? existing?.name,
      input.categoryId === undefined ? existing?.category_id ?? null : input.categoryId,
      input.amount ?? existing?.amount,
      input.currency ?? existing?.currency,
      input.periodStart ?? existing?.period_start,
      input.periodEnd ?? existing?.period_end,
      input.alertThreshold ?? existing?.alert_threshold,
      nowIso(),
      budgetId
    )
    .run()

  return ok(c, { updated: true })
})

budgetsRoutes.delete('/:budgetId', async (c) => {
  const bookId = c.req.param('bookId')!
  const budgetId = c.req.param('budgetId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  await assertBudget(c.env.DB, bookId, budgetId)
  await c.env.DB.prepare(`UPDATE budgets SET archived_at = ?, updated_at = ? WHERE id = ? AND book_id = ?`)
    .bind(nowIso(), nowIso(), budgetId, bookId)
    .run()
  return ok(c, { archived: true })
})
