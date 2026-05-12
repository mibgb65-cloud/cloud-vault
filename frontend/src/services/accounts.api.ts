import { http } from './http'
import type { Account } from '@/types/domain'

export interface CreateAccountInput {
  name: string
  type: string
  currency: string
  openingBalance: number
  icon?: string | null
  color?: string | null
  includeInAssets: boolean
  creditLimit?: number | null
  statementDay?: number | null
  repaymentDay?: number | null
}

export type UpdateAccountInput = Partial<CreateAccountInput>

export function listAccounts(bookId: string) {
  return http.get<{ items: Account[] }>(`/books/${bookId}/accounts`)
}

export function createAccount(bookId: string, input: CreateAccountInput) {
  return http.post<{ account: { id: string } }>(`/books/${bookId}/accounts`, input)
}

export function updateAccount(bookId: string, accountId: string, input: UpdateAccountInput) {
  return http.patch<{ updated: boolean }>(`/books/${bookId}/accounts/${accountId}`, input)
}

export function archiveAccount(bookId: string, accountId: string) {
  return http.delete<{ archived: boolean }>(`/books/${bookId}/accounts/${accountId}`)
}

export function recalculateAccountBalances(bookId: string) {
  return http.post<{ repaired: number; items: Array<{ id: string; calculated_balance: number }> }>(
    `/books/${bookId}/accounts/recalculate-balances`
  )
}
