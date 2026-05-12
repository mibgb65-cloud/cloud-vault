import { http } from './http'
import type { PageResult } from '@/types/api'
import type { User } from '@/types/domain'

export interface Invite {
  id: string
  code?: string
  inviteRole: string
  allowedEmail: string | null
  maxUses: number
  usedCount: number
  expiresAt: string | null
  status: string
  note: string | null
}

export function listUsers() {
  return http.get<PageResult<User>>('/admin/users')
}

export function listInvites() {
  return http.get<{ items: Invite[] }>('/admin/registration-invites')
}

export function createInvite(input: {
  maxUses: number
  expiresAt?: string | null
  allowedEmail?: string | null
  inviteRole: 'admin' | 'user'
  note?: string | null
}) {
  return http.post<{ invite: Invite }>('/admin/registration-invites', input)
}

export function updateUserStatus(userId: string, disabled: boolean) {
  return http.patch<{ updated: boolean }>(`/admin/users/${userId}/status`, { disabled })
}

export function updateInvite(
  inviteId: string,
  input: {
    status?: 'active' | 'disabled'
    expiresAt?: string | null
    note?: string | null
  }
) {
  return http.patch<{ updated: boolean }>(`/admin/registration-invites/${inviteId}`, input)
}

export function deleteInvite(inviteId: string) {
  return http.delete<{ deleted: boolean }>(`/admin/registration-invites/${inviteId}`)
}

export interface SystemSetting {
  key: string
  value: string
  valueType: string
  description: string | null
  updatedAt: string
}

export function listSystemSettings() {
  return http.get<{ items: SystemSetting[] }>('/admin/settings')
}

export function updateSystemSettings(input: Record<string, string>) {
  return http.patch<{ updated: number }>('/admin/settings', input)
}
