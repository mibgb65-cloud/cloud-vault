import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { balanceStatements } from '../services/account-balance.service'
import { assertAccountInBook, assertCategoryInBook, assertTagsInBook } from '../services/permission.service'
import { createTransactionSchema } from '../schemas/transaction.schema'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso, toDateKey } from '../utils/date'
import { toTransaction } from '../utils/mapper'
import { ok } from '../utils/response'

export const transactionsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

type TransactionRow = Record<string, unknown> & {
  id: string
  type: 'expense' | 'income' | 'transfer'
  account_id: string
  transfer_account_id: string | null
  amount: number
}

async function loadTransaction(db: D1Database, bookId: string, transactionId: string) {
  const row = await db
    .prepare(
      `SELECT t.*, a.name AS account_name, ta.name AS transfer_account_name, c.name AS category_name, c.icon AS category_icon
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ? AND t.book_id = ?
       LIMIT 1`
    )
    .bind(transactionId, bookId)
    .first<TransactionRow>()

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', '账单不存在')
  }

  const tags = await db
    .prepare(`SELECT tag_id FROM transaction_tags WHERE transaction_id = ?`)
    .bind(transactionId)
    .all<{ tag_id: string }>()

  return toTransaction(row, (tags.results ?? []).map((tag) => tag.tag_id))
}

async function validateTransactionInput(db: D1Database, bookId: string, input: ReturnType<typeof createTransactionSchema.parse>) {
  await assertAccountInBook(db, bookId, input.accountId)
  if (input.type === 'transfer') {
    await assertAccountInBook(db, bookId, input.transferAccountId)
  } else {
    await assertCategoryInBook(db, bookId, input.categoryId, input.type)
  }
  await assertTagsInBook(db, bookId, input.tagIds)
}

transactionsRoutes.get('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])

  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const conditions = [`t.book_id = ?`]
  const params: unknown[] = [bookId]
  const pageSize = Math.min(Math.max(Number(c.req.query('pageSize') || 30), 1), 100)
  const page = Math.max(Number(c.req.query('page') || 1), 1)

  const dateFrom = c.req.query('dateFrom')
  const dateTo = c.req.query('dateTo')
  const type = c.req.query('type')
  const accountId = c.req.query('accountId')
  const categoryId = c.req.query('categoryId')
  const tagId = c.req.query('tagId')
  const keyword = c.req.query('keyword')
  const minAmount = c.req.query('minAmount')
  const maxAmount = c.req.query('maxAmount')

  if (!includeDeleted) {
    conditions.push(`t.deleted_at IS NULL`)
  }

  if (dateFrom) {
    conditions.push(`t.date_key >= ?`)
    params.push(dateFrom)
  }
  if (dateTo) {
    conditions.push(`t.date_key <= ?`)
    params.push(dateTo)
  }
  if (type === 'income' || type === 'expense' || type === 'transfer') {
    conditions.push(`t.type = ?`)
    params.push(type)
  }
  if (accountId) {
    conditions.push(`(t.account_id = ? OR t.transfer_account_id = ?)`)
    params.push(accountId, accountId)
  }
  if (categoryId) {
    conditions.push(`t.category_id = ?`)
    params.push(categoryId)
  }
  if (tagId) {
    conditions.push(`EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = ?)`)
    params.push(tagId)
  }
  if (keyword) {
    conditions.push(`(t.note LIKE ? OR t.merchant_name LIKE ?)`)
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  if (minAmount) {
    conditions.push(`t.amount >= ?`)
    params.push(Number(minAmount))
  }
  if (maxAmount) {
    conditions.push(`t.amount <= ?`)
    params.push(Number(maxAmount))
  }

  const rows = await c.env.DB.prepare(
    `SELECT t.*, a.name AS account_name, ta.name AS transfer_account_name, c.name AS category_name, c.icon AS category_icon
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.occurred_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize + 1, (page - 1) * pageSize)
    .all<TransactionRow>()

  const pageRows = (rows.results ?? []).slice(0, pageSize)
  const tagMap = new Map<string, string[]>()
  if (pageRows.length > 0) {
    const placeholders = pageRows.map(() => '?').join(', ')
    const tagRows = await c.env.DB.prepare(`SELECT transaction_id, tag_id FROM transaction_tags WHERE transaction_id IN (${placeholders})`)
      .bind(...pageRows.map((row) => row.id))
      .all<{ transaction_id: string; tag_id: string }>()
    for (const tag of tagRows.results ?? []) {
      tagMap.set(tag.transaction_id, [...(tagMap.get(tag.transaction_id) ?? []), tag.tag_id])
    }
  }

  return ok(c, {
    items: pageRows.map((row) => toTransaction(row, tagMap.get(row.id) ?? [])),
    pageInfo: {
      page,
      pageSize,
      hasMore: (rows.results ?? []).length > pageSize,
      nextCursor: null
    }
  })
})

transactionsRoutes.post('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createTransactionSchema.parse(await c.req.json())
  await validateTransactionInput(c.env.DB, bookId, input)

  const dateKey = toDateKey(input.occurredAt)
  if (!dateKey) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'occurredAt 不是合法时间')
  }

  const now = nowIso()
  const transactionId = newId('transaction')
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO transactions (
        id, book_id, created_by, account_id, transfer_account_id, category_id, type, amount, currency,
        base_amount, base_currency, occurred_at, date_key, note, merchant_name, source, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'posted', ?, ?)`
    ).bind(
      transactionId,
      bookId,
      c.get('currentUser').id,
      input.accountId,
      input.type === 'transfer' ? input.transferAccountId : null,
      input.type === 'transfer' ? null : input.categoryId,
      input.type,
      input.amount,
      input.currency,
      input.amount,
      input.currency,
      input.occurredAt,
      dateKey,
      input.note ?? null,
      input.merchantName ?? null,
      now,
      now
    ),
    ...input.tagIds.map((tagId) =>
      c.env.DB.prepare(`INSERT INTO transaction_tags (transaction_id, tag_id, book_id) VALUES (?, ?, ?)`).bind(
        transactionId,
        tagId,
        bookId
      )
    ),
    ...balanceStatements(c.env.DB, {
      type: input.type,
      accountId: input.accountId,
      transferAccountId: input.type === 'transfer' ? input.transferAccountId : null,
      amount: input.amount
    })
  ]

  await c.env.DB.batch(statements)

  return ok(c, { transaction: await loadTransaction(c.env.DB, bookId, transactionId) }, 201)
})

transactionsRoutes.get('/:transactionId', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  return ok(c, { transaction: await loadTransaction(c.env.DB, bookId, c.req.param('transactionId')!) })
})

transactionsRoutes.patch('/:transactionId', async (c) => {
  const bookId = c.req.param('bookId')!
  const transactionId = c.req.param('transactionId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createTransactionSchema.parse(await c.req.json())
  await validateTransactionInput(c.env.DB, bookId, input)

  const old = await c.env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND book_id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(transactionId, bookId)
    .first<TransactionRow>()
  if (!old) {
    throw new HttpError(404, 'NOT_FOUND', '账单不存在')
  }

  const dateKey = toDateKey(input.occurredAt)
  if (!dateKey) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'occurredAt 不是合法时间')
  }

  await c.env.DB.batch([
    ...balanceStatements(
      c.env.DB,
      {
        type: old.type,
        accountId: old.account_id,
        transferAccountId: old.transfer_account_id,
        amount: Number(old.amount)
      },
      true
    ),
    c.env.DB.prepare(
      `UPDATE transactions
       SET account_id = ?, transfer_account_id = ?, category_id = ?, type = ?, amount = ?, currency = ?,
           base_amount = ?, base_currency = ?, occurred_at = ?, date_key = ?, note = ?, merchant_name = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      input.accountId,
      input.type === 'transfer' ? input.transferAccountId : null,
      input.type === 'transfer' ? null : input.categoryId,
      input.type,
      input.amount,
      input.currency,
      input.amount,
      input.currency,
      input.occurredAt,
      dateKey,
      input.note ?? null,
      input.merchantName ?? null,
      nowIso(),
      transactionId
    ),
    c.env.DB.prepare(`DELETE FROM transaction_tags WHERE transaction_id = ?`).bind(transactionId),
    ...input.tagIds.map((tagId) =>
      c.env.DB.prepare(`INSERT INTO transaction_tags (transaction_id, tag_id, book_id) VALUES (?, ?, ?)`).bind(
        transactionId,
        tagId,
        bookId
      )
    ),
    ...balanceStatements(c.env.DB, {
      type: input.type,
      accountId: input.accountId,
      transferAccountId: input.type === 'transfer' ? input.transferAccountId : null,
      amount: input.amount
    })
  ])

  return ok(c, { transaction: await loadTransaction(c.env.DB, bookId, transactionId) })
})

transactionsRoutes.delete('/:transactionId', async (c) => {
  const bookId = c.req.param('bookId')!
  const transactionId = c.req.param('transactionId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const old = await c.env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND book_id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(transactionId, bookId)
    .first<TransactionRow>()

  if (!old) {
    throw new HttpError(404, 'NOT_FOUND', '账单不存在')
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), transactionId),
    ...balanceStatements(
      c.env.DB,
      {
        type: old.type,
        accountId: old.account_id,
        transferAccountId: old.transfer_account_id,
        amount: Number(old.amount)
      },
      true
    )
  ])

  return ok(c, { deleted: true })
})

transactionsRoutes.post('/:transactionId/restore', async (c) => {
  const bookId = c.req.param('bookId')!
  const transactionId = c.req.param('transactionId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const old = await c.env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND book_id = ? AND deleted_at IS NOT NULL LIMIT 1`)
    .bind(transactionId, bookId)
    .first<TransactionRow>()

  if (!old) {
    throw new HttpError(404, 'NOT_FOUND', '账单不存在或无需恢复')
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ?`).bind(nowIso(), transactionId),
    ...balanceStatements(c.env.DB, {
      type: old.type,
      accountId: old.account_id,
      transferAccountId: old.transfer_account_id,
      amount: Number(old.amount)
    })
  ])

  return ok(c, { transaction: await loadTransaction(c.env.DB, bookId, transactionId) })
})
