import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { archiveBook, createBook, listBooks, updateBook, type CreateBookInput, type UpdateBookInput } from '@/services/books.api'
import type { Book } from '@/types/domain'

export const useBookStore = defineStore('book', () => {
  const books = ref<Book[]>([])
  const currentBookId = ref<string | null>(localStorage.getItem('cloud-vault-book-id'))
  const currentBook = computed(() => books.value.find((book) => book.id === currentBookId.value) ?? books.value[0] ?? null)

  async function loadBooks() {
    const result = await listBooks()
    books.value = result.items
    if (!currentBookId.value || !books.value.some((book) => book.id === currentBookId.value)) {
      currentBookId.value = books.value[0]?.id ?? null
    }
    if (currentBookId.value) {
      localStorage.setItem('cloud-vault-book-id', currentBookId.value)
    }
  }

  function setCurrentBook(bookId: string) {
    currentBookId.value = bookId
    localStorage.setItem('cloud-vault-book-id', bookId)
  }

  async function createNewBook(input: CreateBookInput) {
    const result = await createBook(input)
    currentBookId.value = result.book.id
    localStorage.setItem('cloud-vault-book-id', result.book.id)
    await loadBooks()
    return result.book.id
  }

  async function updateCurrentBook(bookId: string, input: UpdateBookInput) {
    await updateBook(bookId, input)
    await loadBooks()
  }

  async function archiveExistingBook(bookId: string) {
    await archiveBook(bookId)
    if (currentBookId.value === bookId) {
      currentBookId.value = null
      localStorage.removeItem('cloud-vault-book-id')
    }
    await loadBooks()
  }

  return {
    books,
    currentBookId,
    currentBook,
    loadBooks,
    setCurrentBook,
    createNewBook,
    updateCurrentBook,
    archiveExistingBook
  }
})
