import type { AlarmCaseState, AlarmSourceState } from '@/types/campus'

export const caseStates: AlarmCaseState[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']
export const caseStateLabels: Record<AlarmCaseState, string> = { NEW: '待分派', ASSIGNED: '待处理', IN_PROGRESS: '处理中', CLOSED: '已关闭' }
export const sourceStateLabels: Record<AlarmSourceState, string> = { ACTIVE: '演练异常中', RECOVERED: '模拟来源已恢复', UNKNOWN: '来源状态未知' }
export const caseActionLabels: Record<string, string> = { DEMO_TRIGGER: '创建演练事件', ASSIGN: '分派负责人', START: '开始处理', NOTE: '记录处置', DEMO_RECOVER: '模拟来源恢复', VERIFY_RECOVERY: '核实来源恢复', CLOSE: '关闭事件' }
export const isConflict = (error: unknown) => error instanceof Error && 'status' in error && error.status === 409
export const operationError = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请核对后重试'
