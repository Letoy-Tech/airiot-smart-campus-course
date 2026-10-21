export type Capability = 'canRead' | 'canControl' | 'canAdmin' | 'canAudit' | 'canHandleAlarms' | 'canAssignAlarms' | 'canRunDemoScenarios'
export interface CampusCapabilities { roles: string[]; canRead: boolean; canControl: boolean; canAdmin: boolean; canAudit: boolean; canHandleAlarms?: boolean; canAssignAlarms?: boolean; canRunDemoScenarios?: boolean }
export interface Issue { code: string; message: string; scope: string }
export interface Space { id: string; name: string; type: string | null; campusId: string | null; buildingId: string | null; floor: string | null }
export type DeviceCategory = 'environment' | 'energy' | 'facility' | 'lighting'
export interface Tag { id: string; name: string; unit: string }
export interface Device { id: string; tableId: string; name: string; category: DeviceCategory; spaceId: string | null; spaceName: string | null; online: boolean | null; communicationTime: number | null; simulated: true; switchOn: boolean | null; tags: Tag[] }
export type PointQuality = 'fresh' | 'stale' | 'missing' | 'invalid'
export interface Point { deviceId: string; tableId: string; tagId: string; value: number | null; time: number | null; quality: PointQuality; unit: string }
export interface CampusOverview { source: 'AIRIOT'; projectId: string; observedAt: number; simulated: true; spaces: Space[]; devices: Device[]; points: Point[]; issues: Issue[]; completeness: { expectedSpaces: number; expectedDevices: number; expectedPoints: number; actualSpaces: number; actualDevices: number; actualPoints: number } }
export interface Locations { campuses: { id: string; name: string }[]; buildings: { id: string; campusId: string; name: string }[]; bindings: { spaceId: string; buildingId: string; floor: string }[] }
export interface HistoryResult { source: 'AIRIOT'; deviceId: string; tagId: string; unit: string; from: number; to: number; observedAt: number; samples: { time: number; value: number }[]; truncated: boolean; issues: Issue[] }
export interface Alarm { id: string; deviceId: string | null; deviceName: string | null; tableId: string | null; tagId: string | null; message: string; time: number | null; recoveryTime: number | null; status: string; level: string; simulated: true }
export interface AlarmResult { items: Alarm[]; total: number | null; observedAt: number; issues: Issue[] }
export interface ControlResult { auditId: string; deviceId: string; before: boolean; requested: boolean; confirmed: boolean; observedAt: number }
export interface Audit { id: string; actorId: string; actorName: string; deviceId: string; tableId: string; before: boolean | null; requested: boolean; confirmed: boolean | null; outcome: string; reason: string; createdAt: number; error: string | null }
export interface AuditResult { items: Audit[]; total: number }
export interface IntegrationStatus { configured: boolean; connected: boolean; projectId: string; baseUrl: string; identityId: string | null; isSuper: boolean | null; checkedAt: number; controlEnabled: boolean; capabilities: { name: string; status: 'PASS' | 'FAIL' | 'PENDING'; detail: string }[]; message: string }
export type AlarmCaseState = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED'
export type AlarmSourceState = 'ACTIVE' | 'RECOVERED' | 'UNKNOWN'
export interface AlarmCase {
  id: string; sourceType: 'DEMO'; sourceScope: 'LOCAL_DEMO'; sourceId: string; scenario: string; simulated: true
  deviceId: string; deviceName: string; message: string; level: string; occurredAt: number
  sourceState: AlarmSourceState; sourceRawStatus: string; sourceRecoveredAt: number | null
  sourceObservedAt: number; sourceVerifiedAt: number | null; sourceCheckOutcome: 'PENDING' | 'PASS' | 'UNKNOWN'
  state: AlarmCaseState; assigneeUid: string | null; assigneeName: string | null
  createdAt: number; updatedAt: number; closedAt: number | null; disposition: string | null; version: number
}
export interface AlarmCaseTimeline { id: string; action: string; actorUid: string; actorName: string; note: string | null; fromState: string | null; toState: string | null; previousAssigneeUid: string | null; assigneeUid: string | null; sourceState: string; createdAt: number; caseVersion: number }
export interface AlarmCaseDetail extends AlarmCase { timeline: AlarmCaseTimeline[] }
export interface AlarmCaseList { items: AlarmCase[]; total: number; observedAt: number }
export interface AlarmHandlers { items: { uid: string; displayName: string }[]; currentUid: string }
export interface DemoStatus { enabled: boolean; label: string; scenarios: { id: string; name: string; deviceId: string; description: string }[]; limitations: string[] }
export interface DeviceOwnerEvent { id: string; deviceId: string; actorUid: string; actorName: string; note: string; previousOwnerUid: string | null; ownerUid: string; createdAt: number; version: number }
export interface DeviceOwner { deviceId: string; ownerUid: string | null; ownerName: string | null; version: number; updatedAt: number | null; timeline?: DeviceOwnerEvent[] }
export interface DeviceOwnerList { items: DeviceOwner[]; observedAt: number }
export interface AlarmCaseFilters { sourceType?: string; state?: string; assigneeUid?: string; limit?: number; skip?: number }
