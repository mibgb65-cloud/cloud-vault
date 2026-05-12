import type { ApiResponse } from '@/types/api'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message)
  }
}

export function getToken() {
  return localStorage.getItem('cloud-vault-token')
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('cloud-vault-token', token)
  } else {
    localStorage.removeItem('cloud-vault-token')
  }
}

async function request<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept-Language', localStorage.getItem('cloud-vault-locale') || 'zh-CN')

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload || payload.code !== 'OK') {
    if (response.status === 401) {
      setToken(null)
    }
    throw new ApiError(payload?.code || 'REQUEST_FAILED', payload?.message || '请求失败', response.status, payload?.details)
  }

  return payload.data
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE'
    })
}
