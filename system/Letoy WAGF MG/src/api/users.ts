import service from '@/utils/request'
import type { PageResponse } from '@/types/api'
import type { CurrentUser } from '@/types/auth'

export interface UserQueryParams {
  pageNum: number
  pageSize: number
  username?: string
  nickname?: string
  phoneNumber?: string
}

export function queryUsers(params: UserQueryParams) {
  return service.post<any, PageResponse<CurrentUser>>('/users/query', params)
}

export function getUserDetail(uid: string) {
  return service.get<any, CurrentUser>(`/users/${uid}`)
}

export function updateUserStatus(uid: string, active: boolean) {
  return service.patch<any, void>(`/users/${uid}/status`, { active })
}

export function deleteUser(uid: string) {
  return service.delete<any, void>(`/users/${uid}`)
}

export function saveUser(data: any) {
  if (data.uid) {
    return service.put<any, void>(`/users/${data.uid}`, data)
  }
  return service.post<any, void>('/users', data)
}
