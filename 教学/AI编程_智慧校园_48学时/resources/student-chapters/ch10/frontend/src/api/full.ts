import { assertBusinessSuccess, contractError, isRecord, requestEnvelope, ApiError } from './http'
import type { CsrfToken } from '../types/campus'
import type {
  Overview,
  Locations,
  HistoryResult,
  Handler,
  AlarmDetail,
  CaseList,
  DemoStatus,
  Owner,
  OwnerDetail,
  IntegrationStatus,
} from '../types/full'

type Guard = (value: unknown) => boolean
const str: Guard = (v) => typeof v === 'string'
const bool: Guard = (v) => typeof v === 'boolean'
const integer: Guard = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const number: Guard = (v) => typeof v === 'number' && Number.isFinite(v)
const nullable =
  (guard: Guard): Guard =>
  (v) =>
    v === null || guard(v)
const list =
  (guard: Guard): Guard =>
  (v) =>
    Array.isArray(v) && v.every(guard)
const choice =
  (...values: unknown[]): Guard =>
  (v) =>
    values.includes(v)
const object =
  (shape: Record<string, Guard>): Guard =>
  (v) =>
    isRecord(v) && Object.entries(shape).every(([key, guard]) => guard(v[key]))
const issue = object({ code: str, message: str, scope: str })
const tag = object({ id: str, name: str, unit: nullable(str) })
const device = object({
  id: str,
  tableId: str,
  name: str,
  category: choice('environment', 'energy', 'facility', 'lighting'),
  spaceId: nullable(str),
  spaceName: nullable(str),
  online: nullable(bool),
  communicationTime: nullable(integer),
  simulated: choice(true),
  switchOn: nullable(bool),
  tags: list(tag),
})
const space = object({
  id: str,
  name: str,
  type: nullable(str),
  campusId: nullable(str),
  buildingId: nullable(str),
  floor: nullable(str),
})
const point = object({
  deviceId: str,
  tableId: str,
  tagId: str,
  value: nullable(number),
  time: nullable(integer),
  quality: choice('fresh', 'stale', 'missing', 'invalid'),
  unit: str,
})
const caseShape = {
  id: str,
  sourceId: str,
  scenario: str,
  deviceId: str,
  deviceName: str,
  message: str,
  sourceType: choice('DEMO'),
  sourceScope: choice('LOCAL_DEMO'),
  simulated: choice(true),
  level: choice('DEMO_NOTICE'),
  occurredAt: integer,
  sourceState: choice('ACTIVE', 'RECOVERED', 'UNKNOWN'),
  sourceRawStatus: str,
  sourceRecoveredAt: nullable(integer),
  sourceObservedAt: integer,
  sourceVerifiedAt: nullable(integer),
  sourceCheckOutcome: choice('PENDING', 'PASS', 'UNKNOWN'),
  state: choice('NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'),
  assigneeUid: nullable(str),
  assigneeName: nullable(str),
  createdAt: integer,
  updatedAt: integer,
  closedAt: nullable(integer),
  disposition: nullable(str),
  version: integer,
}
const timeline = object({
  id: str,
  caseId: str,
  action: choice(
    'DEMO_TRIGGER',
    'ASSIGN',
    'START',
    'NOTE',
    'DEMO_RECOVER',
    'VERIFY_RECOVERY',
    'CLOSE',
  ),
  actorUid: str,
  actorName: str,
  note: str,
  fromState: nullable(str),
  toState: str,
  previousAssigneeUid: nullable(str),
  assigneeUid: nullable(str),
  sourceState: str,
  createdAt: integer,
  caseVersion: integer,
})
const caseDetail = object({ ...caseShape, timeline: list(timeline) })
const ownerShape = {
  deviceId: str,
  ownerUid: nullable(str),
  ownerName: nullable(str),
  version: integer,
  updatedAt: nullable(integer),
}
const ownerDetail = object({
  ...ownerShape,
  timeline: list(
    object({
      id: str,
      deviceId: str,
      actorUid: str,
      actorName: str,
      note: str,
      previousOwnerUid: nullable(str),
      ownerUid: str,
      createdAt: integer,
      version: integer,
    }),
  ),
})
const handler = object({ uid: str, displayName: str })
export const historyGuard = object({
  source: choice('TEACHING_MOCK'),
  deviceId: str,
  tagId: str,
  unit: str,
  from: integer,
  to: integer,
  observedAt: integer,
  samples: list(object({ time: integer, value: nullable(number) })),
  truncated: bool,
  issues: list(issue),
})
async function read<T>(path: string, guard: Guard, signal?: AbortSignal): Promise<T> {
  const response = await requestEnvelope(`/campus/${path}`, { signal })
  assertBusinessSuccess(response)
  if (!guard(response.data)) contractError()
  return response.data as T
}
async function write<T>(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
  csrf: CsrfToken | null,
  guard: Guard,
  signal?: AbortSignal,
): Promise<T> {
  if (!csrf) throw new ApiError('登录保护尚未准备好，请重新登录。', 401)
  const response = await requestEnvelope(`/campus/${path}`, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(body),
  })
  assertBusinessSuccess(response)
  if (!guard(response.data)) contractError()
  return response.data as T
}
const id = encodeURIComponent
export const getOverview = (signal?: AbortSignal) =>
  read<Overview>(
    'overview',
    object({
      source: choice('TEACHING_MOCK'),
      projectId: str,
      observedAt: integer,
      simulated: choice(true),
      spaces: list(space),
      devices: list(device),
      points: list(point),
      issues: list(issue),
      completeness: object({
        expectedSpaces: integer,
        expectedDevices: integer,
        expectedPoints: integer,
        actualSpaces: integer,
        actualDevices: integer,
        actualPoints: integer,
      }),
    }),
    signal,
  )
export const getLocations = (signal?: AbortSignal) =>
  read<Locations>(
    'locations',
    object({
      campuses: list(object({ id: str, name: str })),
      buildings: list(object({ id: str, campusId: str, name: str })),
      bindings: list(object({ spaceId: str, buildingId: str, floor: nullable(str) })),
    }),
    signal,
  )
export const createCampus = (name: string, csrf: CsrfToken | null, signal?: AbortSignal) =>
  write('locations/campuses', 'POST', { name }, csrf, object({ id: str, name: str }), signal)
export const createBuilding = (
  campusId: string,
  name: string,
  csrf: CsrfToken | null,
  signal?: AbortSignal,
) =>
  write(
    'locations/buildings',
    'POST',
    { campusId, name },
    csrf,
    object({ id: str, campusId: str, name: str }),
    signal,
  )
export const bindSpace = (
  spaceId: string,
  buildingId: string,
  floor: string | null,
  csrf: CsrfToken | null,
  signal?: AbortSignal,
) =>
  write(
    `locations/spaces/${id(spaceId)}`,
    'PUT',
    { buildingId, floor },
    csrf,
    object({ spaceId: str, buildingId: str, floor: nullable(str) }),
    signal,
  )
export const getHistory = (query: URLSearchParams, signal?: AbortSignal) =>
  read<HistoryResult>(`history?${query}`, historyGuard, signal)
export const getCases = (query: string, signal?: AbortSignal) =>
  read<CaseList>(
    `alarm-cases?${query}`,
    object({ items: list(object(caseShape)), total: integer, observedAt: integer }),
    signal,
  )
export const getCase = (caseId: string, signal?: AbortSignal) =>
  read<AlarmDetail>(`alarm-cases/${id(caseId)}`, caseDetail, signal)
export const getHandlers = (signal?: AbortSignal) =>
  read<{ items: Handler[]; currentUid: string }>(
    'alarm-cases/handlers',
    object({ items: list(handler), currentUid: str }),
    signal,
  )
export const getDemoStatus = (signal?: AbortSignal) =>
  read<DemoStatus>(
    'demo/status',
    object({
      enabled: bool,
      label: str,
      scenarios: list(object({ id: str, name: str, deviceId: str, description: str })),
      limitations: list(str),
    }),
    signal,
  )
export const triggerDemo = (scenario: string, csrf: CsrfToken | null, signal?: AbortSignal) =>
  write<AlarmDetail>(
    `demo-alarm-scenarios/${id(scenario)}/trigger`,
    'POST',
    {},
    csrf,
    caseDetail,
    signal,
  )
export type CaseAction = 'assign' | 'start' | 'notes' | 'verify-recovery' | 'close' | 'recover'
export function actOnCase(
  caseId: string,
  action: CaseAction,
  body: Record<string, unknown>,
  csrf: CsrfToken | null,
  signal?: AbortSignal,
) {
  const path =
    action === 'recover'
      ? `demo-alarm-events/${id(caseId)}/recover`
      : `alarm-cases/${id(caseId)}/${action}`
  return write<AlarmDetail>(path, 'POST', body, csrf, caseDetail, signal)
}
export const getOwners = (signal?: AbortSignal) =>
  read<{ items: Owner[]; observedAt: number }>(
    'device-owners',
    object({ items: list(object(ownerShape)), observedAt: integer }),
    signal,
  )
export const getOwner = (deviceId: string, signal?: AbortSignal) =>
  read<OwnerDetail>(`device-owners/${id(deviceId)}`, ownerDetail, signal)
export const saveOwner = (
  deviceId: string,
  ownerUid: string,
  note: string,
  expectedVersion: number,
  csrf: CsrfToken | null,
  signal?: AbortSignal,
) =>
  write<OwnerDetail>(
    `device-owners/${id(deviceId)}`,
    'PUT',
    { ownerUid, note, expectedVersion },
    csrf,
    ownerDetail,
    signal,
  )
export const getIntegration = (signal?: AbortSignal) =>
  read<IntegrationStatus>(
    'integrations/airiot/status',
    object({
      configured: bool,
      connected: bool,
      controlEnabled: choice(false),
      message: str,
      capabilities: list(object({ name: str, status: str, detail: str })),
    }),
    signal,
  )
export const getRawAlarms = (signal?: AbortSignal) =>
  read<{ items: unknown[]; total: number; observedAt: number; issues: unknown[] }>(
    'alarms?limit=50&skip=0',
    object({ items: list(isRecord), total: integer, observedAt: integer, issues: list(issue) }),
    signal,
  )
