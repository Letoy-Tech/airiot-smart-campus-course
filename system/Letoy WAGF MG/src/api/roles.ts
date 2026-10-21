import service from '@/utils/request'

export interface Role {
  roleCode: string
  roleName: string
  description?: string
  createdAt?: string
}

/**
 * 获取所有角色列表
 */
export function getAllRoles() {
  return service.get<any, Role[]>('/roles')
}

/**
 * 获取特定用户的角色编码列表 (返回 CSV 格式字符串)
 */
export function getUserRoles(uid: string) {
  return service.get<any, string>(`/roles/user/${uid}`)
}

/**
 * 为用户分配角色
 * @param uid 用户 ID
 * @param roleCodes 角色编码数组
 */
export function updateUserRoles(uid: string, roleCodes: string[]) {
  // 后端接收 CSV 格式
  return service.put<any, void>(`/roles/user/${uid}`, {
    roleCodes: roleCodes.join(',')
  })
}

export function createRole(data: Role) {
  return service.post<any, void>('/roles', data)
}

export function updateRole(roleCode: string, data: Role) {
  return service.put<any, void>(`/roles/${roleCode}`, data)
}

export function deleteRole(roleCode: string) {
  return service.delete<any, void>(`/roles/${roleCode}`)
}
