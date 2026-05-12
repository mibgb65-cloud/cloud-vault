import { http } from '@/services/http'
import type { TransactionType } from '@/types/domain'

export interface ParsedTransactionDraft {
  type: TransactionType
  amount: string
  date: string
  accountId: string
  categoryId: string
  transferAccountId: string
  note: string
  merchantName: string | null
  confidence: number | null
  provider: 'deepseek'
}

export function parseTransactionText(bookId: string, input: { text: string; today: string; currency: string }) {
  return http.post<{ draft: ParsedTransactionDraft }>(`/books/${bookId}/ai/parse-transaction`, input)
}
