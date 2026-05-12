import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { createAccountSchema, updateAccountSchema } from '../schemas/account.schema'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { toAccount } from '../utils/mapper'
import { ok } from '../utils/response'

export const accountsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

accountsRoutes.get('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const includeArchived = c.req.query('includeArchived') === 'true'
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM accounts
     WHERE book_id = ? ${includeArchived ? '' : 'AND archived_at IS NULL'}
     ORDER BY sort_order ASC, created_at ASC`
  )
    .bind(bookId)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toAccount) })
})

accountsRoutes.post('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createAccountSchema.parse(await c.req.json())
  const user = c.get('currentUser')
  const now = nowIso()
  const accountId = newId('account')

  await c.env.DB.prepare(
    `INSERT INTO accounts (
      id, book_id, created_by, name, type, currency, opening_balance, cached_balance, icon, color,
      include_in_assets, credit_limit, statement_day, repayment_day, sort_order, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(
      accountId,
      bookId,
      user.id,
      input.name,
      input.type,
      input.currency,
      input.openingBalance,
      input.openingBalance,
      input.icon ?? 'wallet',
      input.color ?? '#2563EB',
      input.includeInAssets ? 1 : 0,
      input.creditLimit ?? null,
      input.statementDay ?? null,
      input.repaymentDay ?? null,
      now,
      now
    )
    .run()

  return ok(c, { account: { id: accountId } }, 201)
})

accountsRoutes.get('/:accountId', async (c) => {
  const bookId = c.req.param('bookId')!
  const accountId = c.req.param('accountId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const row = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ? AND book_id = ? LIMIT 1`)
    .bind(accountId, bookId)
    .first<Record<string, unknown>>()

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', '账户不存在')
  }

  return ok(c, { account: toAccount(row) })
})

accountsRoutes.patch('/:accountId', async (c) => {
  const bookId = c.req.param('bookId')!
  const accountId = c.req.param('accountId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = updateAccountSchema.parse(await c.req.json())
  const existing = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ? AND book_id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(accountId, bookId)
    .first<Record<string, unknown>>()

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '账户不存在')
  }

  const oldOpening = Number(existing.opening_balance)
  const newOpening = input.openingBalance ?? oldOpening
  const balanceDelta = newOpening - oldOpening

  await c.env.DB.prepare(
    `UPDATE accounts
     SET name = ?, type = ?, currency = ?, opening_balance = ?, cached_balance = cached_balance + ?,
         icon = ?, color = ?, include_in_assets = ?, credit_limit = ?, statement_day = ?, repayment_day = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      input.name ?? existing.name,
      input.type ?? existing.type,
      input.currency ?? existing.currency,
      newOpening,
      balanceDelta,
      input.icon === undefined ? existing.icon : input.icon,
      input.color === undefined ? existing.color : input.color,
      input.includeInAssets === undefined ? existing.include_in_assets : input.includeInAssets ? 1 : 0,
      input.creditLimit === undefined ? existing.credit_limit : input.creditLimit,
      input.statementDay === undefined ? existing.statement_day : input.statementDay,
      input.repaymentDay === undefined ? existing.repayment_day : input.repaymentDay,
      nowIso(),
      accountId
    )
    .run()

  return ok(c, { updated: true })
})

accountsRoutes.delete('/:accountId', async (c) => {
  const bookId = c.req.param('bookId')!
  const accountId = c.req.param('accountId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  await c.env.DB.prepare(`UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ? AND book_id = ?`)
    .bind(nowIso(), nowIso(), accountId, bookId)
    .run()
  return ok(c, { archived: true })
})

accountsRoutes.post('/recalculate-balances', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin'])
  const rows = await c.env.DB.prepare(
    `SELECT
       a.id,
       a.opening_balance
       + COALESCE(SUM(
           CASE
             WHEN t.type = 'income' AND t.account_id = a.id THEN t.amount
             WHEN t.type = 'expense' AND t.account_id = a.id THEN -t.amount
             WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
             WHEN t.type = 'transfer' AND t.transfer_account_id = a.id THEN t.amount
             ELSE 0
           END
         ), 0) AS calculated_balance
     FROM accounts a
     LEFT JOIN transactions t
       ON (t.account_id = a.id OR t.transfer_account_id = a.id)
       AND t.deleted_at IS NULL
       AND t.status = 'posted'
     WHERE a.book_id = ?
     GROUP BY a.id`
  )
    .bind(bookId)
    .all<{ id: string; calculated_balance: number }>()

  const statements = (rows.results ?? []).map((row) =>
    c.env.DB.prepare(`UPDATE accounts SET cached_balance = ?, updated_at = ? WHERE id = ?`).bind(
      row.calculated_balance,
      nowIso(),
      row.id
    )
  )
  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }

  return ok(c, { repaired: statements.length, items: rows.results ?? [] })
})
