import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CurrentUser, CurrentUserViewModel, LoginResponse } from '@/types/auth'
import { getAllGroups } from '@/api/groups'
import { getAllRoles } from '@/api/roles'
import service, { AuthExpiredError } from '@/utils/request'
import { setAccessToken, setRefreshToken, clearTokens, getAccessToken } from '@/utils/token'
import { resolveLabels, UNKNOWN_GROUP, UNKNOWN_ROLE } from '@/utils/label'
import { useCampusStore } from '@/store/campus'

let fetchMePromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUserViewModel | null>(null)
  const isInitialized = ref(false)
  const roleNameMap = ref<Record<string, string>>({})
  const groupNameMap = ref<Record<string, string>>({})
  const roleDefinitionsLoaded = ref(false)
  const roleDefinitionsLoading = ref(false)
  const groupDefinitionsLoaded = ref(false)
  const groupDefinitionsLoading = ref(false)

  const isLoggedIn = computed(() => !!user.value || !!getAccessToken())
  // 字典未就绪时返回空、查不到时显示占位名，不再把角色编码 / 组织 ID 直接展示给管理员
  const currentUserRoleNames = computed(() =>
    resolveLabels(user.value?.roles || [], roleNameMap.value, roleDefinitionsLoaded.value, UNKNOWN_ROLE),
  )
  const currentUserGroupNames = computed(() =>
    resolveLabels(user.value?.groupIds || [], groupNameMap.value, groupDefinitionsLoaded.value, UNKNOWN_GROUP),
  )

  const ensureRoleDefinitions = async () => {
    if (user.value && !user.value.roles.some(role => role === 'SUPER_ADMIN' || role === 'ADMIN')) return
    if (roleDefinitionsLoaded.value || roleDefinitionsLoading.value) return

    roleDefinitionsLoading.value = true
    try {
      const roles = await getAllRoles()
      roleNameMap.value = roles.reduce<Record<string, string>>((map, role) => {
        if (role.roleName) map[role.roleCode] = role.roleName
        return map
      }, {})
      roleDefinitionsLoaded.value = true
    } catch (e) {
      console.error('Fetch role definitions failed:', e)
    } finally {
      roleDefinitionsLoading.value = false
    }
  }

  const ensureGroupDefinitions = async () => {
    if (user.value && !user.value.roles.some(role => role === 'SUPER_ADMIN' || role === 'ADMIN')) return
    if (groupDefinitionsLoaded.value || groupDefinitionsLoading.value) return

    groupDefinitionsLoading.value = true
    try {
      const groups = await getAllGroups()
      groupNameMap.value = groups.reduce<Record<string, string>>((map, group) => {
        if (group.groupName) map[group.groupId] = group.groupName
        return map
      }, {})
      groupDefinitionsLoaded.value = true
    } catch (e) {
      console.error('Fetch group definitions failed:', e)
    } finally {
      groupDefinitionsLoading.value = false
    }
  }

  const setUser = (userData: CurrentUser) => {
    // 按照文档建议，将 CSV 字符串转换为数组
    const roles = userData.roles ? userData.roles.split(',').filter(Boolean) : []
    const groupIds = userData.groupIds ? userData.groupIds.split(',').filter(Boolean) : []

    user.value = {
      ...userData,
      rolesRaw: userData.roles,
      groupIdsRaw: userData.groupIds,
      roles,
      groupIds
    }
    isInitialized.value = true
    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
      void ensureRoleDefinitions()
      void ensureGroupDefinitions()
    } else {
      roleNameMap.value = { CAMPUS_MANAGER: '校园管理人员', CAMPUS_VIEWER: '只读查看者' }
      groupNameMap.value = {}
      roleDefinitionsLoaded.value = true
      groupDefinitionsLoaded.value = true
    }
  }

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    const res = await service.post<LoginResponse, LoginResponse>('/auth/login', { username, password })
    // 后端接口 login 成功后返回的 data 里直接包含 token 和用户信息
    setAccessToken(res.token)
    setRefreshToken(res.refreshToken)
    useCampusStore().reset()
    setUser(res)
    return res
  }

  const fetchMe = () => {
    if (fetchMePromise) return fetchMePromise

    fetchMePromise = service.get<CurrentUser, CurrentUser>('/auth/me')
      .then((res) => {
        setUser(res)
      })
      .catch((e) => {
        if (e instanceof AuthExpiredError) {
          clearTokens()
          user.value = null
        }
        throw e
      })
      .finally(() => {
        fetchMePromise = null
      })

    return fetchMePromise
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try {
        await service.post('/auth/revoke', { refreshToken })
      } catch (e) {
        console.error('Logout failed:', e)
      }
    }
    clearTokens()
    useCampusStore().reset()
    user.value = null
    window.location.href = `${import.meta.env.BASE_URL}login`
  }

  return {
    user,
    isLoggedIn,
    isInitialized,
    roleNameMap,
    groupNameMap,
    roleDefinitionsLoaded,
    groupDefinitionsLoaded,
    currentUserRoleNames,
    currentUserGroupNames,
    setUser,
    ensureRoleDefinitions,
    ensureGroupDefinitions,
    login,
    fetchMe,
    logout
  }
})
