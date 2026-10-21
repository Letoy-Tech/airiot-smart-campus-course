import type { Device, Space } from './campus'
import type { CaseState } from '../domain/course'
export interface Issue {
  code: string
  message: string
  scope: string
}
export interface Point {
  deviceId: string
  tableId: string
  tagId: string
  value: number | null
  time: number | null
  quality: 'fresh' | 'stale' | 'missing' | 'invalid'
  unit: string
}
export interface Overview {
  source: 'TEACHING_MOCK'
  projectId: string
  observedAt: number
  simulated: true
  spaces: Space[]
  devices: Device[]
  points: Point[]
  issues: Issue[]
  completeness: {
    expectedSpaces: number
    expectedDevices: number
    expectedPoints: number
    actualSpaces: number
    actualDevices: number
    actualPoints: number
  }
}
export interface Locations {
  campuses: { id: string; name: string }[]
  buildings: { id: string; campusId: string; name: string }[]
  bindings: { spaceId: string; buildingId: string; floor: string | null }[]
}
export interface HistoryResult {
  queriedAt?: number
  source: 'TEACHING_MOCK'
  deviceId: string
  tagId: string
  unit: string
  from: number
  to: number
  observedAt: number
  samples: { time: number; value: number | null }[]
  truncated: boolean
  issues: Issue[]
}
export interface Handler {
  uid: string
  displayName: string
}
export interface AlarmCase {
  id: string
  sourceId: string
  scenario: string
  deviceId: string
  deviceName: string
  message: string
  sourceType: 'DEMO'
  sourceScope: 'LOCAL_DEMO'
  simulated: true
  level: 'DEMO_NOTICE'
  occurredAt: number
  sourceState: 'ACTIVE' | 'RECOVERED' | 'UNKNOWN'
  sourceRawStatus: string
  sourceRecoveredAt: number | null
  sourceObservedAt: number
  sourceVerifiedAt: number | null
  sourceCheckOutcome: 'PENDING' | 'PASS' | 'UNKNOWN'
  state: CaseState
  assigneeUid: string | null
  assigneeName: string | null
  createdAt: number
  updatedAt: number
  closedAt: number | null
  disposition: string | null
  version: number
}
export interface CaseTimeline {
  id: string
  caseId: string
  action: string
  actorUid: string
  actorName: string
  note: string
  fromState: string | null
  toState: string
  previousAssigneeUid: string | null
  assigneeUid: string | null
  sourceState: string
  createdAt: number
  caseVersion: number
}
export interface AlarmDetail extends AlarmCase {
  timeline: CaseTimeline[]
}
export interface CaseList {
  items: AlarmCase[]
  total: number
  observedAt: number
}
export interface DemoStatus {
  enabled: boolean
  label: string
  scenarios: { id: string; name: string; deviceId: string; description: string }[]
  limitations: string[]
}
export interface Owner {
  deviceId: string
  ownerUid: string | null
  ownerName: string | null
  version: number
  updatedAt: number | null
}
export interface OwnerTimeline {
  id: string
  deviceId: string
  actorUid: string
  actorName: string
  note: string
  previousOwnerUid: string | null
  ownerUid: string
  createdAt: number
  version: number
}
export interface OwnerDetail extends Owner {
  timeline: OwnerTimeline[]
}
export interface IntegrationStatus {
  configured: boolean
  connected: boolean
  controlEnabled: false
  message: string
  capabilities: { name: string; status: string; detail: string }[]
}
