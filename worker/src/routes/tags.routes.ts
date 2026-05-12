import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { createTagSchema, updateTagSchema } from '../schemas/tag.schema'
import { HttpError } from '../utils/http-error'
import { newId } from '../utils/id'
import { nowIso } from '../utils/date'
import { toTag } from '../utils/mapper'
import { ok } from '../utils/response'

export const tagsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

tagsRoutes.get('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const includeArchived = c.req.query('includeArchived') === 'true'
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM tags
     WHERE book_id = ? ${includeArchived ? '' : 'AND archived_at IS NULL'}
     ORDER BY created_at ASC`
  )
    .bind(bookId)
    .all<Record<string, unknown>>()

  return ok(c, { items: (rows.results ?? []).map(toTag) })
})

tagsRoutes.post('/', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = createTagSchema.parse(await c.req.json())
  const tagId = newId('tag')

  await c.env.DB.prepare(`INSERT INTO tags (id, book_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(tagId, bookId, input.name, input.color ?? null, nowIso())
    .run()

  return ok(c, { tag: { id: tagId } }, 201)
})

tagsRoutes.patch('/:tagId', async (c) => {
  const bookId = c.req.param('bookId')!
  const tagId = c.req.param('tagId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  const input = updateTagSchema.parse(await c.req.json())
  const existing = await c.env.DB.prepare(`SELECT * FROM tags WHERE id = ? AND book_id = ? AND archived_at IS NULL LIMIT 1`)
    .bind(tagId, bookId)
    .first<Record<string, unknown>>()

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', '标签不存在')
  }

  await c.env.DB.prepare(`UPDATE tags SET name = ?, color = ? WHERE id = ?`)
    .bind(input.name ?? existing.name, input.color === undefined ? existing.color : input.color, tagId)
    .run()

  return ok(c, { updated: true })
})

tagsRoutes.delete('/:tagId', async (c) => {
  const bookId = c.req.param('bookId')!
  const tagId = c.req.param('tagId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor'])
  await c.env.DB.prepare(`UPDATE tags SET archived_at = ? WHERE id = ? AND book_id = ?`).bind(nowIso(), tagId, bookId).run()
  return ok(c, { archived: true })
})
