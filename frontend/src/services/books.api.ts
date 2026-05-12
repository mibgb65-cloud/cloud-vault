import { http } from './http'
import type { Book } from '@/types/domain'

export function listBooks() {
  return http.get<{ items: Book[] }>('/books')
}
