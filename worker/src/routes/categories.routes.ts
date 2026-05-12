import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { toCategory } from '../utils/mapper'
import { ok } from '../utils/response'

export const categoriesRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

categoriesRoutes.get('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const type = c.req.query('type')
  const includeArchived = c.req.query('includeArchived') === 'true'
  const conditions = [`book_id = ?`]
  const params: unknown[] = [bookId]

  if (type === 'income' || type === 'expense') {
    conditions.push(`type = ?`)
    params.push(type)
  }
  if (!includeArchived) {
    conditions.push(`archived_at IS NULL`)
  }

  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM categories
     WHERE ${conditions.join(' AND ')}
     ORDER BY type ASC, sort_order ASC, created_at ASC`
  )
    .bind(...params)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toCategory) })
})

categoriesRoutes.post('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createCategorySchema.parse(await c.req.json())
  const now = nowIso()
  const categoryId = newId('category')

  await c.env.DB.prepare(
    `INSERT INTO categories (id, book_id, created_by, parent_id, name, type, icon, color, is_system, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  )
    .bind(
      categoryId,
      bookId,
      c.get('currentUser').id,
      input.parentId ?? null,
      input.name,
      input.type,
      input.icon,
      input.color ?? null,
      input.sortOrder ?? 0,
      now,
      now
    )
    .run()

  return ok(c, { category: { id: categoryId } }, 201)
})

categoriesRoutes.patch('/sort-order', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const body = (await c.req.json()) as { items?: Array<{ id: string; sortOrder: number }> }
  const items = body.items ?? []
  const now = nowIso()
  const statements = items.map((item) =>
    c.env.DB.prepare(`UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND book_id = ?`).bind(
      item.sortOrder,
      now,
      item.id,
      bookId
    )
  )
  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }

  return ok(c, { updated: statements.length })
})

categoriesRoutes.patch('/:categoryId', async (c) => {
  const bookId = c.req.param('bookId')!
  const categoryId = c.req.param('categoryId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = updateCategorySchema.parse(await c.req.json())
  const existing = await c.env.DB.prepare(`SELECT * FROM categories WHERE id = ? AND book_id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(categoryId, bookId)
    .first<Record<string, unknown>>()

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '分类不存在')
  }

  await c.env.DB.prepare(
    `UPDATE categories
     SET parent_id = ?, name = ?, type = ?, icon = ?, color = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      input.parentId === undefined ? existing.parent_id : input.parentId,
      input.name ?? existing.name,
      input.type ?? existing.type,
      input.icon ?? existing.icon,
      input.color === undefined ? existing.color : input.color,
      input.sortOrder ?? existing.sort_order,
      nowIso(),
      categoryId
    )
    .run()

  return ok(c, { updated: true })
})

categoriesRoutes.delete('/:categoryId', async (c) => {
  const bookId = c.req.param('bookId')!
  const categoryId = c.req.param('categoryId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  await c.env.DB.prepare(`UPDATE categories SET archived_at = ?, updated_at = ? WHERE id = ? AND book_id = ?`)
    .bind(nowIso(), nowIso(), categoryId, bookId)
    .run()
  return ok(c, { archived: true })
})
