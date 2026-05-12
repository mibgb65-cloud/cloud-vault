import { http } from './http'
import type { PageResult } from '@/types/api'
import type { Transaction, TransactionType } from '@/types/domain'

export interface CreateTransactionInput {
  type: TransactionType
  accountId: string
  transferAccountId?: string | null
  categoryId?: string | null
  amount: number
  currency: string
  occurredAt: string
  note?: string | null
  merchantName?: string | null
  tagIds: string[]
}

export function listTransactions(bookId: string, params = new URLSearchParams()) {
  const query = params.toString()
  return http.get<PageResult<Transaction>>(`/books/${bookId}/transactions${query ? `?${query}` : ''}`)
}

export function createTransaction(bookId: string, input: CreateTransactionInput) {
  return http.post<{ transaction: Transaction }>(`/books/${bookId}/transactions`, input)
}

export function updateTransaction(bookId: string, transactionId: string, input: CreateTransactionInput) {
  return http.patch<{ transaction: Transaction }>(`/books/${bookId}/transactions/${transactionId}`, input)
}

export function deleteTransaction(bookId: string, transactionId: string) {
  return http.delete<{ deleted: boolean }>(`/books/${bookId}/transactions/${transactionId}`)
}

export function restoreTransaction(bookId: string, transactionId: string) {
  return http.post<{ transaction: Transaction }>(`/books/${bookId}/transactions/${transactionId}/restore`)
}
