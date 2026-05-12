import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { currentMonthRange } from '../utils/date'
import { ok } from '../utils/response'

export const reportsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

function readRange(query: (key: string) => string | undefined) {
  const fallback = currentMonthRange()
  return {
    dateFrom: query('dateFrom') || fallback.dateFrom,
    dateTo: query('dateTo') || fallback.dateTo
  }
}

reportsRoutes.get('/summary', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const { dateFrom, dateTo } = readRange((key) => c.req.query(key))

  const summaryRows = await c.env.DB.prepare(
    `SELECT type, COALESCE(SUM(base_amount), 0) AS total_amount
     FROM transactions
     WHERE book_id = ?
       AND deleted_at IS NULL
       AND status = 'posted'
       AND type IN ('income', 'expense')
       AND date_key BETWEEN ? AND ?
     GROUP BY type`
  )
    .bind(bookId, dateFrom, dateTo)
    .all<{ type: string; total_amount: number }>()

  const netAssets = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(cached_balance), 0) AS total
     FROM accounts
     WHERE book_id = ? AND archived_at IS NULL AND include_in_assets = 1`
  )
    .bind(bookId)
    .first<{ total: number }>()

  let income = 0
  let expense = 0
  for (const row of summaryRows.results ?? []) {
    if (row.type === 'income') {
      income = Number(row.total_amount)
    }
    if (row.type === 'expense') {
      expense = Number(row.total_amount)
    }
  }

  return ok(c, {
    dateFrom,
    dateTo,
    income,
    expense,
    balance: income - expense,
    netAssets: Number(netAssets?.total ?? 0)
  })
})

reportsRoutes.get('/trends', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const { dateFrom, dateTo } = readRange((key) => c.req.query(key))

  const rows = await c.env.DB.prepare(
    `SELECT date_key, type, COALESCE(SUM(base_amount), 0) AS total_amount
     FROM transactions
     WHERE book_id = ?
       AND deleted_at IS NULL
       AND status = 'posted'
       AND type IN ('income', 'expense')
       AND date_key BETWEEN ? AND ?
     GROUP BY date_key, type
     ORDER BY date_key ASC`
  )
    .bind(bookId, dateFrom, dateTo)
    .all<{ date_key: string; type: string; total_amount: number }>()

  return ok(c, {
    items: (rows.results ?? []).map((row) => ({
      dateKey: row.date_key,
      type: row.type,
      amount: Number(row.total_amount)
    }))
  })
})

reportsRoutes.get('/category-breakdown', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const { dateFrom, dateTo } = readRange((key) => c.req.query(key))

  const rows = await c.env.DB.prepare(
    `SELECT c.id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            COALESCE(SUM(t.base_amount), 0) AS total_amount
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.book_id = ?
       AND t.deleted_at IS NULL
       AND t.status = 'posted'
       AND t.type = 'expense'
       AND t.date_key BETWEEN ? AND ?
     GROUP BY c.id
     ORDER BY total_amount DESC`
  )
    .bind(bookId, dateFrom, dateTo)
    .all<Record<string, unknown>>()

  return ok(c, {
    items: (rows.results ?? []).map((row) => ({
      categoryId: String(row.category_id),
      categoryName: String(row.category_name),
      categoryIcon: String(row.category_icon),
      categoryColor: row.category_color ? String(row.category_color) : null,
      amount: Number(row.total_amount)
    }))
  })
})
