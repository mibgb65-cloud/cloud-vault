import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { createBookSchema, updateBookSchema } from '../schemas/book.schema'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { toBook } from '../utils/mapper'
import { ok } from '../utils/response'

export const booksRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

booksRoutes.get('/', async (c) => {
  const user = c.get('currentUser')
  const rows = await c.env.DB.prepare(
    `SELECT b.*, bm.role
     FROM books b
     JOIN book_members bm ON bm.book_id = b.id
     WHERE bm.user_id = ? AND bm.status = 'active' AND b.archived_at IS NULL
     ORDER BY b.created_at ASC`
  )
    .bind(user.id)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toBook) })
})

booksRoutes.post('/', async (c) => {
  const input = createBookSchema.parse(await c.req.json())
  const user = c.get('currentUser')
  const now = nowIso()
  const bookId = newId('book')

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO books (id, owner_user_id, name, type, default_currency, icon, created_at, updated_at)
       VALUES (?, ?, ?, 'personal', ?, ?, ?, ?)`
    ).bind(bookId, user.id, input.name, input.defaultCurrency, input.icon ?? 'book-open', now, now),
    c.env.DB.prepare(
      `INSERT INTO book_members (book_id, user_id, role, status, joined_at)
       VALUES (?, ?, 'owner', 'active', ?)`
    ).bind(bookId, user.id, now)
  ])

  return ok(c, { book: { id: bookId } }, 201)
})

booksRoutes.get('/:bookId', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const row = await c.env.DB.prepare(
    `SELECT b.*, bm.role
     FROM books b
     JOIN book_members bm ON bm.book_id = b.id
     WHERE b.id = ? AND bm.user_id = ? AND bm.status = 'active'
     LIMIT 1`
  )
    .bind(bookId, c.get('currentUser').id)
    .first<Record<string, unknown>>()

  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', '账本不存在')
  }

  return ok(c, { book: toBook(row) })
})

booksRoutes.patch('/:bookId', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin'])
  const input = updateBookSchema.parse(await c.req.json())
  const existing = await c.env.DB.prepare(`SELECT * FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(bookId)
    .first<Record<string, unknown>>()

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '账本不存在')
  }

  await c.env.DB.prepare(
    `UPDATE books
     SET name = ?, default_currency = ?, icon = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      input.name ?? existing.name,
      input.defaultCurrency ?? existing.default_currency,
      input.icon === undefined ? existing.icon : input.icon,
      nowIso(),
      bookId
    )
    .run()

  return ok(c, { updated: true })
})

booksRoutes.delete('/:bookId', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner'])
  await c.env.DB.prepare(`UPDATE books SET archived_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), bookId).run()
  return ok(c, { archived: true })
})
