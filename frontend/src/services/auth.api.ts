import { http } from './http'
import type { User } from '@/types/domain'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  inviteCode: string
  nickname?: string
}

export function login(input: LoginInput) {
  return http.post<{ token: string; expiresIn: number; user: User }>('/auth/login', input)
}

export function register(input: RegisterInput) {
  return http.post<{ user: User; defaultBookId: string }>('/auth/register', input)
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
