import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import Operations from '@/views/campus/Operations.vue'
import CaseDetail from '@/views/campus/CaseDetail.vue'
import DeviceOwners from '@/views/campus/DeviceOwners.vue'
import { useCampusStore } from '@/store/campus'
import type { AlarmCaseDetail, CampusCapabilities } from '@/types/campus'
import { addAlarmCaseNote, getAlarmCase, getAlarmCases, getAlarmHandlers, getDemoStatus, getDeviceOwner, getDeviceOwners, getOverview, saveDeviceOwner, triggerDemoScenario } from '@/api/campus'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'TEST_CASE' } }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/campus', () => ({ getCapabilities: vi.fn(), getAlarmCases: vi.fn(), getAlarmCase: vi.fn(), getAlarmHandlers: vi.fn(), getDemoStatus: vi.fn(), triggerDemoScenario: vi.fn(), assignAlarmCase: vi.fn(), startAlarmCase: vi.fn(), addAlarmCaseNote: vi.fn(), recoverDemoEvent: vi.fn(), verifyAlarmCaseRecovery: vi.fn(), closeAlarmCase: vi.fn(), getOverview: vi.fn(), getDeviceOwners: vi.fn(), getDeviceOwner: vi.fn(), saveDeviceOwner: vi.fn() }))
const viewer: CampusCapabilities = { roles: ['CAMPUS_VIEWER'], canRead: true, canControl: false, canAdmin: false, canAudit: false, canHandleAlarms: false, canAssignAlarms: false, canRunDemoScenarios: false }
const admin: CampusCapabilities = { ...viewer, canAdmin: true, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
const fixture: AlarmCaseDetail = { id: 'TEST_CASE', sourceType: 'DEMO', sourceScope: 'LOCAL_DEMO', sourceId: 'TEST_SOURCE', scenario: 'TEST_SCENARIO', simulated: true, deviceId: 'env_demo_01', deviceName: 'TEST 模拟设备', message: 'TEST 本地演练', level: 'TEST', occurredAt: 1700000000000, sourceState: 'RECOVERED', sourceRawStatus: 'TEST_RECOVERED', sourceRecoveredAt: 1700000001000, sourceObservedAt: 1700000001000, sourceVerifiedAt: 1700000002000, sourceCheckOutcome: 'PASS', state: 'IN_PROGRESS', assigneeUid: 'TEST_OTHER', assigneeName: 'TEST 负责人', createdAt: 1700000000000, updatedAt: 1700000002000, closedAt: null, disposition: null, version: 3, timeline: [{ id: 'TEST_NOTE_1', action: 'NOTE', actorUid: 'TEST_OTHER', actorName: 'TEST 负责人', note: 'TEST 旧记录', fromState: 'IN_PROGRESS', toState: 'IN_PROGRESS', previousAssigneeUid: null, assigneeUid: 'TEST_OTHER', sourceState: 'RECOVERED', createdAt: 1700000000000, caseVersion: 2 }] }
const wrappers: VueWrapper[] = []
const render = (component: typeof Operations | typeof CaseDetail | typeof DeviceOwners, capabilities: CampusCapabilities) => {
  const pinia = createPinia(); setActivePinia(pinia)
  useCampusStore().capabilities = capabilities
  const wrapper = mount(component, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' }, CampusChart: { props: ['label'], template: '<div>{{ label }}</div>' } } } })
  wrappers.push(wrapper); return wrapper
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAlarmCase).mockResolvedValue(fixture)
  vi.mocked(getAlarmCases).mockResolvedValue({ items: [fixture], total: 1, observedAt: 1700000003000 })
  vi.mocked(getAlarmHandlers).mockResolvedValue({ currentUid: 'TEST_ME', items: [{ uid: 'TEST_ME', displayName: 'TEST 我' }, { uid: 'TEST_OTHER', displayName: 'TEST 他人' }] })
  vi.mocked(getDemoStatus).mockResolvedValue({ enabled: true, label: 'TEST 演练', scenarios: [{ id: 'TEST_SCENARIO', name: 'TEST 场景', deviceId: 'env_demo_01', description: 'TEST 描述' }], limitations: ['TEST 本地演练'] })
  vi.stubGlobal('HTMLElement', window.HTMLElement)
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount(); vi.unstubAllGlobals() })

describe('演示运营权限与来源', () => {
  it('只读账户可看真实返回的DEMO队列，不能触发演练', async () => {
    const wrapper = render(Operations, viewer); await flushPromises()
    expect(wrapper.text()).toContain('DEMO · 本地场景演示')
    expect(wrapper.text()).toContain('TEST 本地演练')
    expect(wrapper.text()).toContain('本页 1 件')
    expect(wrapper.text()).not.toContain('触发本地演练事件')
    expect(triggerDemoScenario).not.toHaveBeenCalled()
  })
  it('管理员可处理全队列，管理人员不能处理他人事件', async () => {
    const manager = render(CaseDetail, { ...viewer, canHandleAlarms: true }); await flushPromises()
    expect(manager.find('textarea').exists()).toBe(false)
    expect(manager.text()).toContain('校园管理人员处理分派给自己的事件')
    const owned = { ...fixture, assigneeUid: 'TEST_ME' }
    vi.mocked(getAlarmCase).mockResolvedValue(owned)
    const own = render(CaseDetail, { ...viewer, canHandleAlarms: true }); await flushPromises()
    expect(own.find('textarea[placeholder="记录检查过程、原因和处理结果"]').exists()).toBe(true)
    expect(own.text()).not.toContain('模拟演练来源恢复')
  })
  it('关闭条件缺一时不能提交，已关闭事件无写表单', async () => {
    vi.mocked(getAlarmCase).mockResolvedValue({ ...fixture, timeline: [] })
    const open = render(CaseDetail, admin); await flushPromises()
    const button = open.findAll('button').find(item => item.text() === '保存结论并关闭事件')!
    await open.get('textarea[placeholder="说明本次演练的处置结论"]').setValue('TEST 结论')
    expect(button.attributes('disabled')).toBeDefined()
    vi.mocked(getAlarmCase).mockResolvedValue({ ...fixture, state: 'CLOSED', disposition: 'TEST 已关闭', closedAt: 1700000005000 })
    const closed = render(CaseDetail, admin); await flushPromises()
    expect(closed.find('form').exists()).toBe(false)
    expect(closed.text()).toContain('TEST 已关闭')
  })
  it('409后回读新版本并保留输入，再次提交使用新版本且确认后才清空', async () => {
    const fresh = { ...fixture, version: 4 }
    const confirmed = { ...fixture, version: 5, timeline: [...fixture.timeline, { ...fixture.timeline[0]!, id: 'TEST_NOTE_2', note: 'TEST 新处置', caseVersion: 5 }] }
    vi.mocked(getAlarmCase).mockReset().mockResolvedValueOnce(fixture).mockResolvedValueOnce(fresh).mockResolvedValueOnce(confirmed)
    vi.mocked(addAlarmCaseNote).mockRejectedValueOnce(Object.assign(new Error('TEST 冲突'), { status: 409 })).mockResolvedValueOnce(confirmed)
    const wrapper = render(CaseDetail, admin); await flushPromises()
    const input = wrapper.get('textarea[placeholder="记录检查过程、原因和处理结果"]')
    await input.setValue('TEST 新处置')
    await input.element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flushPromises()
    expect((input.element as HTMLTextAreaElement).value).toBe('TEST 新处置')
    expect(wrapper.get('[role="alert"]').text()).toContain('输入已保留')
    expect(addAlarmCaseNote).toHaveBeenLastCalledWith('TEST_CASE', 'TEST 新处置', 3)
    await input.element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flushPromises()
    expect(addAlarmCaseNote).toHaveBeenLastCalledWith('TEST_CASE', 'TEST 新处置', 4)
    expect((input.element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.get('[role="status"]').text()).toContain('已保存并回读')
  })
  it('责任登记只确认同设备、同负责人及新版本，失败保留输入', async () => {
    vi.mocked(getOverview).mockResolvedValue({ source: 'AIRIOT', projectId: 'TEST_PROJECT', observedAt: 1700000000000, simulated: true, spaces: [], devices: [{ id: 'env_demo_01', tableId: 'campus_env', name: 'TEST 设备', category: 'environment', spaceId: null, spaceName: null, online: null, communicationTime: null, simulated: true, switchOn: null, tags: [] }], points: [], issues: [], completeness: { expectedSpaces: 0, expectedDevices: 1, expectedPoints: 0, actualSpaces: 0, actualDevices: 1, actualPoints: 0 } })
    vi.mocked(getDeviceOwners).mockResolvedValue({ items: [{ deviceId: 'env_demo_01', ownerUid: null, ownerName: null, version: 0, updatedAt: null }], observedAt: 1700000000000 })
    vi.mocked(getDeviceOwner).mockResolvedValueOnce({ deviceId: 'env_demo_01', ownerUid: null, ownerName: null, version: 0, updatedAt: null }).mockResolvedValueOnce({ deviceId: 'env_demo_01', ownerUid: 'TEST_OTHER', ownerName: 'TEST 他人', version: 1, updatedAt: 1700000001000 })
    vi.mocked(saveDeviceOwner).mockResolvedValue({ deviceId: 'env_demo_01', ownerUid: 'TEST_ME', ownerName: 'TEST 我', version: 1, updatedAt: 1700000001000 })
    const wrapper = render(DeviceOwners, admin); await flushPromises()
    await wrapper.get('button[aria-label="登记TEST 设备的责任人"]').trigger('click'); await flushPromises()
    await wrapper.get('.owner-form select').setValue('TEST_ME')
    await wrapper.get('.owner-form textarea').setValue('TEST 责任说明')
    await wrapper.get('.owner-form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('回读未确认')
    expect((wrapper.get('.owner-form textarea').element as HTMLTextAreaElement).value).toBe('TEST 责任说明')
    expect(wrapper.find('.campus-notice.success').exists()).toBe(false)
  })
})
