import type { Issue } from './full'
export type ReadScenario = 'normal' | 'empty' | 'failure'
export interface ReadPage<T> {
  items: T[]
  total: number
  observedAt: number
  queriedAt: number
  source: 'TEACHING_MOCK'
  simulated: true
  issues: Issue[]
}
export interface RawAlarm {
  id: string
  deviceId: string | null
  deviceName: string | null
  tableId: string | null
  tagId: string | null
  message: string
  time: number | null
  recoveryTime: number | null
  occurredAt: number | null
  recoveredAt: number | null
  status: string
  level: string
  simulated: true
  source: 'TEACHING_MOCK'
}
export interface CommandAudit {
  id: string
  actorId: string
  actorName: string
  deviceId: string
  tableId: string
  before: boolean | null
  requested: boolean
  confirmed: boolean | null
  outcome: string
  reason: string
  createdAt: number
  error: string | null
  simulated: true
  source: 'TEACHING_MOCK'
  sampleKind: 'HISTORICAL_TEACHING_SAMPLE'
}
export interface AuditPage extends ReadPage<CommandAudit> {
  sampleKind: 'HISTORICAL_TEACHING_SAMPLE'
}
