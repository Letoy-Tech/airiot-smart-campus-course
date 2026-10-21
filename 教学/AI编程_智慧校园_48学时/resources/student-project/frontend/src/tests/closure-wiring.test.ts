import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CasesView from '../views/CasesView.vue'
import { useCampusStore } from '../stores/campus'
import * as api from '../api/full'
import type { AlarmDetail } from '../types/full'
vi.mock('../api/full')
beforeEach(() => { vi.resetAllMocks(); setActivePinia(createPinia()); history.replaceState(null, '', '#cases') })
it('第09站必须从既有工作台调用恢复/核实/关闭，并独立回读，不只生成检查组件', async () => {
  const store = useCampusStore()
  store.user = { uid: 'a', username: 'a', displayName: '甲', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
  store.csrf = { token: 'test-token', headerName: 'X-CSRF-TOKEN' }
  store.capabilities = { roles: ['ADMIN'], canRead: true, canAdmin: true, canAudit: true, canControl: false, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
  let current: AlarmDetail = { id: 'current-case', sourceId: 'source', scenario: 'patrol', deviceId: 'device', deviceName: '教学设备', message: '本地模拟', sourceType: 'DEMO', sourceScope: 'LOCAL_DEMO', simulated: true, level: 'DEMO_NOTICE', occurredAt: 1, sourceState: 'ACTIVE', sourceRawStatus: 'DEMO_ACTIVE', sourceRecoveredAt: null, sourceObservedAt: 1, sourceVerifiedAt: null, sourceCheckOutcome: 'PENDING', state: 'IN_PROGRESS', assigneeUid: 'a', assigneeName: '甲', createdAt: 1, updatedAt: 1, closedAt: null, disposition: null, version: 4, timeline: [{ id: 'note', caseId: 'current-case', action: 'NOTE', actorUid: 'a', actorName: '甲', note: '已巡查', fromState: 'IN_PROGRESS', toState: 'IN_PROGRESS', previousAssigneeUid: null, assigneeUid: 'a', sourceState: 'ACTIVE', createdAt: 1, caseVersion: 4 }] }
  vi.mocked(api.getCases).mockImplementation(async () => ({ items: [structuredClone(current)], total: 1, observedAt: 2 }))
  vi.mocked(api.getCase).mockImplementation(async () => structuredClone(current))
  vi.mocked(api.getHandlers).mockResolvedValue({ items: [{ uid: 'a', displayName: '甲' }], currentUid: 'a' })
  vi.mocked(api.getDemoStatus).mockResolvedValue({ enabled: true, label: '本地模拟', scenarios: [], limitations: [] })
  vi.mocked(api.actOnCase).mockImplementation(async (_id, action, body) => {
    expect(body.expectedVersion).toBe(current.version)
    current = { ...current, version: current.version + 1 }
    if (action === 'recover') current = { ...current, sourceState: 'RECOVERED', sourceRecoveredAt: 2, sourceRawStatus: 'DEMO_RECOVERED' }
    if (action === 'verify-recovery') current = { ...current, sourceCheckOutcome: 'PASS', sourceVerifiedAt: 3 }
    if (action === 'close') current = { ...current, state: 'CLOSED', closedAt: 4, disposition: String(body.disposition) }
    return structuredClone(current)
  })
  const view = mount(CasesView); await flushPromises()
  await view.get('[data-testid="case-current-case"]').trigger('click'); await flushPromises()
  expect(view.findComponent({ name: 'CloseChecklist' }).exists()).toBe(true)
  await view.get('[data-testid="recover-case"]').trigger('click'); await flushPromises()
  expect(current.state).toBe('IN_PROGRESS'); expect(current.version).toBe(5)
  await view.get('[data-testid="verify-case"]').trigger('click'); await flushPromises()
  expect(current.state).toBe('IN_PROGRESS'); expect(current.sourceCheckOutcome).toBe('PASS')
  await view.get('[data-testid="case-disposition"]').setValue('已完成本地演练巡查及独立核实')
  await view.get('[data-testid="close-case"]').trigger('click'); await flushPromises()
  expect(current.state).toBe('CLOSED'); expect(current.version).toBe(7)
  expect(api.getCase).toHaveBeenCalledTimes(4) // 选择、恢复、核实、关闭各自读取
  expect(view.text()).toContain('已完成本地演练巡查及独立核实')
  view.unmount()
})
