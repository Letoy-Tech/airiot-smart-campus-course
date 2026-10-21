import service from '@/utils/request'

export interface DashboardOverview {
  totalUsers: number
  activeUsers: number
  lockedUsers: number
  newUsers7d: number
  onlineUsers: number
  enabledApiRules: number
  groupsCount: number
  enabledGroups: number
  rolesCount: number
  enabledRoles: number
  passwordChanged24h: number
}

export interface DashboardTrendPoint {
  date: string
  value: number
}

export interface DashboardTrends {
  days: number
  userGrowth: DashboardTrendPoint[]
  onlineUserTrends: DashboardTrendPoint[]
}

export interface DashboardDistributionItem {
  name: string
  value: number
}

export interface DashboardDistribution {
  usersByRole: DashboardDistributionItem[]
  usersByGroup: DashboardDistributionItem[]
}

export type DashboardHealthStatus = 'UP' | 'DOWN' | 'UNKNOWN'

export interface DashboardHealthItem {
  name: string
  status: DashboardHealthStatus
  detail: string
}

export interface DashboardHealth {
  items: DashboardHealthItem[]
}

export function getDashboardOverview() {
  return service.get<any, DashboardOverview>('/dashboard/overview')
}

export function getDashboardTrends(days = 7) {
  return service.get<any, DashboardTrends>('/dashboard/trends', {
    params: { days }
  })
}

export function getDashboardDistribution() {
  return service.get<any, DashboardDistribution>('/dashboard/distribution')
}

export function getDashboardHealth() {
  return service.get<any, DashboardHealth>('/dashboard/health')
}
