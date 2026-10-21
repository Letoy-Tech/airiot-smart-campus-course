import service from '@/utils/request'

export interface GroupInfo {
  id: number
  groupId: string
  groupName: string
  groupDescription?: string
  parentGroupId: string | null
  path?: string
  level?: number
  sortOrder?: number
  status?: number
  createTime?: string
  updateTime?: string
  children?: GroupInfo[]
}

export interface GroupPayload {
  groupId: string
  groupName: string
  groupDescription?: string
  parentGroupId?: string | null
}

export function getAllGroups() {
  return service.get<any, GroupInfo[]>('/groups/all')
}

export function getGroupSubtree(groupId: string) {
  return service.get<any, GroupInfo[]>(`/groups/${groupId}/subtree`)
}

export function createRootGroup(data: GroupPayload) {
  return service.post<any, void>('/groups/root', data)
}

export function createChildGroup(data: GroupPayload) {
  return service.post<any, void>('/groups/child', data)
}

export function updateGroup(groupId: string, data: GroupPayload) {
  return service.put<any, void>(`/groups/${groupId}`, data)
}

export function deleteGroup(groupId: string) {
  return service.delete<any, void>(`/groups/${groupId}`)
}
