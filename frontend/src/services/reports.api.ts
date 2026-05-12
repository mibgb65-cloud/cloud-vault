import { http } from './http'

export interface SummaryReport {
  dateFrom: string
  dateTo: string
  income: number
  expense: number
  balance: number
  netAssets: number
}

export interface TrendReportItem {
  dateKey: string
  type: 'income' | 'expense'
  amount: number
}

export interface CategoryBreakdownItem {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string | null
  amount: number
}

export function getSummary(bookId: string, dateFrom: string, dateTo: string) {
  return http.get<SummaryReport>(`/books/${bookId}/reports/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`)
}

export function getTrends(bookId: string, dateFrom: string, dateTo: string) {
  return http.get<{ items: TrendReportItem[] }>(`/books/${bookId}/reports/trends?dateFrom=${dateFrom}&dateTo=${dateTo}`)
}

export function getCategoryBreakdown(bookId: string, dateFrom: string, dateTo: string) {
  return http.get<{ items: CategoryBreakdownItem[] }>(
    `/books/${bookId}/reports/category-breakdown?dateFrom=${dateFrom}&dateTo=${dateTo}`
  )
}
