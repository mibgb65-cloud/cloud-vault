import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { listBooks } from '@/services/books.api'
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

  return {
    books,
    currentBookId,
    currentBook,
    loadBooks,
    setCurrentBook
  }
})
