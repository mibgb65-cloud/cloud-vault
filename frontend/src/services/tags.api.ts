import { http } from './http'
import type { Tag } from '@/types/domain'

export interface CreateTagInput {
  name: string
  color?: string | null
}

export type UpdateTagInput = Partial<CreateTagInput>

export function listTags(bookId: string) {
  return http.get<{ items: Tag[] }>(`/books/${bookId}/tags`)
}

export function createTag(bookId: string, input: CreateTagInput) {
  return http.post<{ tag: { id: string } }>(`/books/${bookId}/tags`, input)
}

export function updateTag(bookId: string, tagId: string, input: UpdateTagInput) {
  return http.patch<{ updated: boolean }>(`/books/${bookId}/tags/${tagId}`, input)
}

export function archiveTag(bookId: string, tagId: string) {
  return http.delete<{ archived: boolean }>(`/books/${bookId}/tags/${tagId}`)
}
