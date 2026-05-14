import { http } from './http'
import type { User } from '@/types/domain'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  inviteCode?: string
  nickname?: string
}

export interface PublicConfig {
  appName: string
  registrationMode: 'invite_only' | 'open' | 'closed'
  defaultCurrency: string
  defaultLocale: string
}

export interface UpdateMeInput {
  nickname?: string
  avatarUrl?: string | null
  defaultCurrency?: string
  locale?: string
  timezone?: string
}

export function login(input: LoginInput) {
  return http.post<{ token: string; expiresIn: number; user: User }>('/auth/login', input)
}

export function register(input: RegisterInput) {
  return http.post<{ user: User; defaultBookId: string }>('/auth/register', input)
}

export function getPublicConfig() {
  return http.get<PublicConfig>('/public/config')
}

export function logout() {
  return http.post<{ loggedOut: boolean }>('/auth/logout')
}

export function logoutOtherDevices() {
  return http.post<{ loggedOutDevices: number }>('/auth/logout-other-devices')
}

export function getMe() {
  return http.get<{ user: User }>('/me')
}

export function updateMe(input: UpdateMeInput) {
  return http.patch<{ user: User }>('/me', input)
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return http.patch<{ updated: boolean }>('/me/password', input)
}
