import { assertBusinessSuccess, contractError, isRecord, isText, isNullableText, isTimestamp, requestEnvelope } from './http'
import type { RawAlarm, ReadPage, CommandAudit, AuditPage, ReadScenario } from '../types/read-models'
const nullableTime = (v: unknown) => v === null || isTimestamp(v)
const nullableBool = (v: unknown) => v === null || typeof v === 'boolean'
const mock = (v: Record<string, unknown>) => v.source === 'TEACHING_MOCK' && v.simulated === true
function rawAlarm(v: unknown): v is RawAlarm {
  return isRecord(v) && mock(v) && ['id', 'message', 'status', 'level'].every(k => isText(v[k]))
    && ['deviceId', 'deviceName', 'tableId', 'tagId'].every(k => isNullableText(v[k]))
    && ['time', 'recoveryTime', 'occurredAt', 'recoveredAt'].every(k => nullableTime(v[k]))
    && v.time === v.occurredAt && v.recoveryTime === v.recoveredAt
}
function audit(v: unknown): v is CommandAudit {
  return isRecord(v) && mock(v) && v.sampleKind === 'HISTORICAL_TEACHING_SAMPLE'
    && ['id', 'actorId', 'actorName', 'deviceId', 'tableId', 'outcome', 'reason'].every(k => isText(v[k]))
    && nullableBool(v.before) && typeof v.requested === 'boolean' && nullableBool(v.confirmed)
    && isTimestamp(v.createdAt) && isNullableText(v.error)
}
function page<T>(v: unknown, item: (v: unknown) => v is T): v is ReadPage<T> {
  return isRecord(v) && mock(v) && Array.isArray(v.items) && v.items.every(item)
    && isTimestamp(v.total) && isTimestamp(v.observedAt) && isTimestamp(v.queriedAt)
    && Array.isArray(v.issues) && v.issues.every(i => isRecord(i) && ['code', 'message', 'scope'].every(k => isText(i[k])))
}
async function read<T>(path: string, guard: (v: unknown) => boolean, limit: number, skip: number, scenario: ReadScenario, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ limit: String(limit), skip: String(skip), scenario })
  const response = await requestEnvelope(`/campus/${path}?${query}`, { signal })
  assertBusinessSuccess(response)
  if (!guard(response.data)) contractError()
  return response.data as T
}
export const getAlarmPage = (limit: number, skip: number, scenario: ReadScenario, signal?: AbortSignal) =>
  read<ReadPage<RawAlarm>>('alarms', v => page(v, rawAlarm), limit, skip, scenario, signal)
export const getAuditPage = (limit: number, skip: number, scenario: ReadScenario, signal?: AbortSignal) =>
  read<AuditPage>('command-audit', v => page(v, audit) && isRecord(v) && v.sampleKind === 'HISTORICAL_TEACHING_SAMPLE', limit, skip, scenario, signal)
