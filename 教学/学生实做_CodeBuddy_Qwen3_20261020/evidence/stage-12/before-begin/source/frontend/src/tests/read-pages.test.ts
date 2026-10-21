import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import * as api from '../api/read-models'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import RawAlarmsView from '../views/RawAlarmsView.vue'
import AuditView from '../views/AuditView.vue'
import type { RawAlarm, ReadPage, AuditPage } from '../types/read-models'
vi.mock('../api/read-models')
const data: ReadPage<RawAlarm> = { items: [{ id: 'raw-1', deviceId: 'd', deviceName: '教学设备', tableId: 't', tagId: 'power', message: '模拟报警', time: 10, occurredAt: 10, recoveryTime: null, recoveredAt: null, status: 'ACTIVE', level: 'NOTICE', simulated: true, source: 'TEACHING_MOCK' }], total: 6, observedAt: 100, queriedAt: 100, source: 'TEACHING_MOCK', simulated: true, issues: [] }
beforeEach(() => {
  vi.resetAllMocks(); setActivePinia(createPinia())
  const store = useCampusStore()
  store.user = { uid: 'a', username: 'a', displayName: '甲', source: 'TEACHING_MOCK', roles: ['ADMIN'] }
  store.capabilities = { roles: ['ADMIN'], canRead: true, canAdmin: true, canAudit: true, canControl: false, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
  vi.mocked(api.getAlarmPage).mockResolvedValue(data)
  vi.mocked(api.getAuditPage).mockResolvedValue({ ...data, items: [], sampleKind: 'HISTORICAL_TEACHING_SAMPLE' } as AuditPage)
})
afterEach(() => vi.useRealTimers())
describe('只读报警与命令审计', () => {
  it('分页失败保留带原页码快照，成功空结果不伪装失败', async () => {
    const wrapper = mount(RawAlarmsView); await flushPromises()
    vi.mocked(api.getAlarmPage).mockRejectedValueOnce(new ApiError('读取失败', 503))
    await wrapper.findAll('.pagination button')[1]!.trigger('click'); await flushPromises()
    expect(api.getAlarmPage).toHaveBeenLastCalledWith(5, 5, 'normal', expect.any(AbortSignal))
    expect(wrapper.text()).toContain('当前快照第 1 页'); expect(wrapper.text()).toContain('查询第 2 页')
    expect(wrapper.text()).toContain('模拟报警')
    vi.mocked(api.getAlarmPage).mockResolvedValue({ ...data, items: [], total: 0 })
    await wrapper.get('[data-testid="raw-scenario"]').setValue('empty'); await flushPromises()
    expect(wrapper.text()).toContain('查询已成功，当前页没有原始报警')
    expect(wrapper.text()).not.toContain('模拟报警')
    wrapper.unmount()
  })
  it('请求结束后30秒才再读，pending不重叠，离页停止', async () => {
    vi.useFakeTimers()
    let resolve!: (value: ReadPage<RawAlarm>) => void
    vi.mocked(api.getAlarmPage).mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
    const wrapper = mount(RawAlarmsView)
    await vi.advanceTimersByTimeAsync(90000); expect(api.getAlarmPage).toHaveBeenCalledTimes(1)
    resolve(data); await flushPromises(); await vi.advanceTimersByTimeAsync(29999); expect(api.getAlarmPage).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1); expect(api.getAlarmPage).toHaveBeenCalledTimes(2)
    wrapper.unmount(); await vi.advanceTimersByTimeAsync(90000); expect(api.getAlarmPage).toHaveBeenCalledTimes(2)
  })
  it('审计仅Boolean管理员能力可读取，权限变更清除数据', async () => {
    const store = useCampusStore(); store.capabilities!.canAdmin = 'true' as unknown as boolean
    const wrapper = mount(AuditView); await flushPromises()
    expect(api.getAuditPage).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('只有管理员')
    wrapper.unmount()
    store.capabilities!.canAdmin = true
    const admin = mount(AuditView); await flushPromises()
    expect(admin.text()).toContain('HISTORICAL_TEACHING_SAMPLE')
    expect(admin.text()).toContain('本页不能发送命令')
    store.capabilities!.canAudit = false; await flushPromises()
    expect(admin.find('.data-table').exists()).toBe(false)
    admin.unmount()
  })
})
