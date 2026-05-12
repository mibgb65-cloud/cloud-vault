import { http } from './http'
import type { Budget, BudgetUsage } from '@/types/domain'

export interface CreateBudgetInput {
  name: string
  categoryId?: string | null
  amount: number
  currency: string
  periodStart: string
  periodEnd: string
  alertThreshold: number
}

export type UpdateBudgetInput = Partial<CreateBudgetInput>

export function listBudgets(bookId: string) {
  return http.get<{ items: Budget[] }>(`/books/${bookId}/budgets`)
}

export function listBudgetUsage(bookId: string) {
  return http.get<{ items: BudgetUsage[] }>(`/books/${bookId}/budgets/usage`)
}

export function createBudget(bookId: string, input: CreateBudgetInput) {
  return http.post<{ budget: { id: string } }>(`/books/${bookId}/budgets`, input)
}

export function updateBudget(bookId: string, budgetId: string, input: UpdateBudgetInput) {
  return http.patch<{ updated: boolean }>(`/books/${bookId}/budgets/${budgetId}`, input)
}

export function archiveBudget(bookId: string, budgetId: string) {
  return http.delete<{ archived: boolean }>(`/books/${bookId}/budgets/${budgetId}`)
}
