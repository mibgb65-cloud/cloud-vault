import { Hono } from 'hono'
import type { AppVariables, Env } from '../types/env'
import { requireBookRole } from '../middlewares/auth.middleware'
import { aiTransactionDraftSchema, parseTransactionTextSchema } from '../schemas/ai.schema'
import { HttpError } from '../utils/http-error'
import { ok } from '../utils/response'

export const aiRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()

interface LookupItem {
  id: string
  name: string
  type?: string
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function findByName<T extends LookupItem>(items: T[], name: string | null | undefined) {
  const normalized = normalizeName(name)
  if (!normalized) {
    return undefined
  }
  return items.find((item) => normalizeName(item.name) === normalized || normalizeName(item.name).includes(normalized) || normalized.includes(normalizeName(item.name)))
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] ?? content
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI response is not valid JSON')
  }
  return JSON.parse(source.slice(start, end + 1)) as unknown
}

async function loadLookups(db: D1Database, bookId: string) {
  const [accounts, categories] = await Promise.all([
    db
      .prepare(`SELECT id, name, type FROM accounts WHERE book_id = ? AND archived_at IS NULL ORDER BY created_at ASC`)
      .bind(bookId)
      .all<LookupItem>(),
    db
      .prepare(`SELECT id, name, type FROM categories WHERE book_id = ? AND archived_at IS NULL ORDER BY sort_order ASC, created_at ASC`)
      .bind(bookId)
      .all<LookupItem>()
  ])

  return {
    accounts: accounts.results ?? [],
    categories: categories.results ?? []
  }
}

async function callDeepSeek(env: Env, prompt: string) {
  const apiKey = env.deepseek_api_key
  if (!apiKey) {
    throw new HttpError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'DeepSeek API key is not configured')
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.deepseek_model || 'deepseek-chat',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You parse Chinese bookkeeping text. Return one strict JSON object only: type, amount, date, accountName, categoryName, transferAccountName, note, merchantName, confidence. type must be expense, income, or transfer. amount is a yuan decimal string without currency symbols. date is YYYY-MM-DD.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    throw new HttpError(502, 'AI_PROVIDER_ERROR', 'DeepSeek request failed')
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new HttpError(502, 'AI_PROVIDER_ERROR', 'DeepSeek response is empty')
  }

  return aiTransactionDraftSchema.parse(extractJson(content))
}

aiRoutes.post('/parse-transaction', async (c) => {
  const bookId = c.req.param('bookId')!
  await requireBookRole(c, bookId, ['owner', 'admin', 'editor', 'viewer'])
  const input = parseTransactionTextSchema.parse(await c.req.json())
  const { accounts, categories } = await loadLookups(c.env.DB, bookId)
  const today = input.today ?? new Date().toISOString().slice(0, 10)

  const prompt = JSON.stringify({
    today,
    currency: input.currency,
    text: input.text,
    accounts: accounts.map(({ name, type }) => ({ name, type })),
    categories: categories.map(({ name, type }) => ({ name, type }))
  })
  const draft = await callDeepSeek(c.env, prompt)
  const account = findByName(accounts, draft.accountName) ?? accounts[0]
  const transferAccount = draft.type === 'transfer' ? findByName(accounts, draft.transferAccountName) : undefined
  const category =
    draft.type === 'transfer'
      ? undefined
      : findByName(
          categories.filter((categoryItem) => categoryItem.type === draft.type),
          draft.categoryName
        )

  return ok(c, {
    draft: {
      type: draft.type,
      amount: draft.amount,
      date: draft.date,
      accountId: account?.id ?? '',
      categoryId: category?.id ?? '',
      transferAccountId: transferAccount?.id ?? '',
      note: draft.note || input.text,
      merchantName: draft.merchantName ?? null,
      confidence: draft.confidence ?? null,
      provider: 'deepseek'
    }
  })
})
