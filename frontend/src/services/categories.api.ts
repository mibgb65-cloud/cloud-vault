import { http } from './http'
import type { Category } from '@/types/domain'

export interface CreateCategoryInput {
  parentId?: string | null
  name: string
  type: 'income' | 'expense'
  icon: string
  color?: string | null
  sortOrder?: number
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>

export function listCategories(bookId: string, type?: 'income' | 'expense') {
  const suffix = type ? `?type=${type}` : ''
  return http.get<{ items: Category[] }>(`/books/${bookId}/categories${suffix}`)
}

export function createCategory(bookId: string, input: CreateCategoryInput) {
  return http.post<{ category: { id: string } }>(`/books/${bookId}/categories`, input)
}

export function updateCategory(bookId: string, categoryId: string, input: UpdateCategoryInput) {
  return http.patch<{ updated: boolean }>(`/books/${bookId}/categories/${categoryId}`, input)
}

export function archiveCategory(bookId: string, categoryId: string) {
  return http.delete<{ archived: boolean }>(`/books/${bookId}/categories/${categoryId}`)
}
