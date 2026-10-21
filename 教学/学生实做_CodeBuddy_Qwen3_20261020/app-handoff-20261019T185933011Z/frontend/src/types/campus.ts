export type CampusRole = 'ADMIN' | 'CAMPUS_MANAGER' | 'CAMPUS_VIEWER'
export interface SessionUser {
  uid: string
  username: string
  displayName: string
  roles: CampusRole[]
  source: 'TEACHING_MOCK'
}
export interface Capabilities {
  roles: CampusRole[]
  canRead: boolean
  canControl: boolean
  canAdmin: boolean
  canAudit: boolean
  canHandleAlarms: boolean
  canAssignAlarms: boolean
  canRunDemoScenarios: boolean
}
export interface Device {
  id: string
  tableId: string
  name: string
  category: 'environment' | 'energy' | 'facility' | 'lighting'
  spaceId: string | null
  spaceName: string | null
  online: boolean | null
  communicationTime: number | null
  simulated: true
  switchOn: boolean | null
  tags: { id: string; name: string; unit: string | null }[]
}
export interface Space {
  id: string
  name: string
  type: string | null
  campusId: string | null
  buildingId: string | null
  floor: string | null
}
export interface ReadResult<T> { items: T[]; observedAt: number }
export interface CsrfToken { token: string; headerName: string }
