export interface ApiResponse<T> {
  code: string
  message: string
  data: T
  details?: unknown
  requestId: string
  timestamp: string
}

export interface PageInfo {
  page?: number
  pageSize: number
  total?: number
  hasMore: boolean
  nextCursor?: string | null
}

export interface PageResult<T> {
  items: T[]
  pageInfo: PageInfo
}
