import { http } from './http'
import type { Book } from '@/types/domain'

export interface CreateBookInput {
  name: string
  defaultCurrency: string
  icon?: string | null
}

export type UpdateBookInput = Partial<CreateBookInput>

export function listBooks() {
  return http.get<{ items: Book[] }>('/books')
}

export function createBook(input: CreateBookInput) {
  return http.post<{ book: { id: string } }>('/books', input)
}

export function updateBook(bookId: string, input: UpdateBookInput) {
  return http.patch<{ updated: boolean }>(`/books/${bookId}`, input)
}

export function archiveBook(bookId: string) {
  return http.delete<{ archived: boolean }>(`/books/${bookId}`)
}
