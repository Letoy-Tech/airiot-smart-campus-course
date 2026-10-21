import type { Device } from '../types/campus'
import { ApiError } from '../api/http'
import type { AlarmDetail, HistoryResult } from '../types/full'

export type OnlineFilter = 'all' | 'online' | 'offline' | 'unknown'
export interface DeviceFilter {
  keyword: string
  online: OnlineFilter
  spaceId: string
  category: string
}
export function filterDevices(devices: Device[], filter: DeviceFilter): Device[] {
  // STUDENT_TODO_C06_BEGIN：关键词、三态、空间、类型共同过滤，不修改原数组。
  void devices; void filter
  return []
  // STUDENT_TODO_C06_END
}
export function strictCapability(value: unknown): boolean {
  // STUDENT_TODO_C08_BEGIN：只有 JSON Boolean true 可以开启能力。
  return value === true
  // STUDENT_TODO_C08_END
}
export const caseStates = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const
export type CaseState = (typeof caseStates)[number]
export function validCaseState(value: string | null): CaseState | '' {
  return caseStates.includes(value as CaseState) ? (value as CaseState) : ''
}
export function changeCaseState(state: string): { state: CaseState | ''; skip: number } {
  // STUDENT_TODO_C12_BEGIN：每次改变 state 都从第一页查询，包括清空筛选。
  return { state: validCaseState(state), skip: 0 }
  // STUDENT_TODO_C12_END
}
export function caseQuery(state: string, skip: number, limit: number, mine: string): string {
  const query = new URLSearchParams({ limit: String(limit), skip: String(skip) })
  if (state) query.set('state', state)
  if (mine) query.set('assigneeUid', mine)
  return query.toString()
}
export const categoryNames: Record<string, string> = {
  environment: '环境',
  energy: '能源',
  facility: '设施',
  lighting: '照明',
}
export const stateNames: Record<string, string> = {
  NEW: '待分派',
  ASSIGNED: '已分派',
  IN_PROGRESS: '处理中',
  CLOSED: '已关闭',
}
export const sourceStateNames: Record<string, string> = {
  ACTIVE: '演练未恢复',
  RECOVERED: '演练已恢复',
  UNKNOWN: '恢复未知',
}
export const qualityNames: Record<string, string> = {
  fresh: '新鲜',
  stale: '陈旧',
  missing: '缺失',
  invalid: '无效',
}
export const actionNames: Record<string, string> = {
  DEMO_TRIGGER: '触发演练',
  ASSIGN: '分派',
  START: '开始处理',
  NOTE: '处理记录',
  DEMO_RECOVER: '恢复演练源',
  VERIFY_RECOVERY: '服务端核实',
  CLOSE: '关闭',
}
export function timeText(time: number | null | undefined): string {
  return time == null
    ? '未知'
    : new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(time)
}
export function closeBlockers(detail: AlarmDetail): string[] {
  const reasons: string[] = []
  if (detail.state !== 'IN_PROGRESS') reasons.push('先进入处理中')
  if (!detail.timeline.some((item) => item.action === 'NOTE')) reasons.push('至少填写一条处理记录')
  if (
    detail.sourceState !== 'RECOVERED' ||
    detail.sourceRecoveredAt === null ||
    detail.sourceRecoveredAt < detail.occurredAt
  )
    reasons.push('演练源必须恢复')
  if (
    detail.sourceCheckOutcome !== 'PASS' ||
    detail.sourceVerifiedAt === null ||
    detail.sourceRecoveredAt === null ||
    detail.sourceVerifiedAt < detail.sourceRecoveredAt
  )
    reasons.push('恢复后须由服务端核实通过')
  return reasons
}
/** 原样保留采样时间和 null；不补点、不插值、不把功率解释成电量。 */
export function historySeries(history: HistoryResult): [number, number | null][] {
  return history.samples.map((sample) => [sample.time, sample.value])
}
export function todoError(marker: string): never {
  throw new ApiError(`待完成 ${marker}，请按课堂任务单实现。`, 0, 'TEACHING_TODO')
}
