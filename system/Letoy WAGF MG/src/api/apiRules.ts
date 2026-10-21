import service from '@/utils/request'
import type { PageResponse } from '@/types/api'

export interface ApiRule {
  id: number
  name: string
  pattern: string
  methods: string
  groupPolicy: 'ANY' | 'ALLOWLIST' | 'DIRECT_PATH' | 'BY_USER_GROUP'
  allowedGroupIds?: string
  priority: number
  enabled: boolean
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ApiRuleQueryParams {
  pageNum: number
  pageSize: number
  pathPattern?: string // 搜索参数名可能也需要确认，暂时保留或根据 pattern 搜索
  groupPolicy?: string
  enabled?: boolean
}

export function queryApiRules(params: ApiRuleQueryParams) {
  return service.post<any, PageResponse<ApiRule>>('/security/api-rules/query', params)
}

export function updateRuleStatus(id: number, enabled: boolean) {
  return service.patch(`/security/api-rules/${id}/enabled`, { enabled })
}

export function rebuildApiCache() {
  return service.post('/security/api-rules/rebuild-cache')
}

export function deleteRule(id: number) {
  return service.delete(`/security/api-rules/${id}`)
}

export function saveRule(data: any) {
  if (data.id) {
    return service.put(`/security/api-rules/${data.id}`, data)
  }
  return service.post('/security/api-rules', data)
}
