import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import * as api from '../api/full'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import CompareHistory from '../components/CompareHistory.vue'
import type { Device } from '../types/campus'
import type { HistoryResult } from '../types/full'
vi.mock('../api/full')
const devices: Device[] = ['a', 'b'].map(id => ({ id, name: `设备${id}`, tableId: 't', category: 'energy', spaceId: 's', spaceName: '空间', online: null, communicationTime: null, simulated: true, switchOn: null, tags: [{ id: 'power', name: '功率', unit: 'kW' }, { id: 'voltage', name: '电压', unit: 'V' }] }))
const result = (query: URLSearchParams): HistoryResult => ({ source: 'TEACHING_MOCK', deviceId: query.get('deviceId')!, tagId: query.get('tagId')!, unit: query.get('tagId') === 'voltage' ? 'V' : 'kW', from: Number(query.get('from')), to: Number(query.get('to')), observedAt: 4000000, queriedAt: 1792303200000, samples: [{ time: 1, value: null }, { time: 2, value: 0 }], truncated: false, issues: [] })
const mountView = () => mount(CompareHistory, { props: { devices, tagId: 'power', unit: 'kW', observedAt: 4000000 }, global: { stubs: { HistoryChart: true } } })
beforeEach(() => {
  vi.resetAllMocks(); setActivePinia(createPinia())
  useCampusStore().user = { uid: 'admin', username: 'admin', displayName: '管理员', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
  vi.mocked(api.getHistory).mockImplementation(async query => result(query))
})
describe('同单位逐设备历史比较', () => {
  it('正常与局部失败并存，失败设备保留原查询快照及null/0，成功设备更新', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="compare-query"]').trigger('submit'); await flushPromises()
    expect(api.getHistory).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="compare-a"]').text()).toContain('null（缺失）')
    expect(wrapper.get('[data-testid="compare-a"]').text()).toContain('成功查询')
    await wrapper.get('[data-testid="compare-failure-device"]').setValue('a')
    vi.mocked(api.getHistory).mockImplementation(async query => { if (query.get('scenario') === 'failure') throw new ApiError('读取失败', 503); return { ...result(query), queriedAt: 1792303260000 } })
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[data-testid="compare-a"]').text()).toContain('保留上次成功快照')
    expect(wrapper.get('[data-testid="compare-b"]').text()).not.toContain('保留上次成功快照')
    expect(wrapper.get('[data-testid="compare-a"]').text()).toContain('2026/10/18 14:00:00')
    expect(wrapper.get('[data-testid="compare-b"]').text()).toContain('2026/10/18 14:01:00')
    wrapper.unmount()
  })
  it('切换单位不混合旧功率曲线，空结果清除旧样本而失败不清除', async () => {
    const wrapper = mountView(); await wrapper.get('form').trigger('submit'); await flushPromises()
    await wrapper.setProps({ tagId: 'voltage', unit: 'V' })
    expect(wrapper.findAll('history-chart-stub')).toHaveLength(0)
    vi.mocked(api.getHistory).mockImplementation(async query => ({ ...result(query), samples: [] }))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('该设备在此范围无样本；查询已成功')
    expect(wrapper.text()).not.toContain('null（缺失）')
    wrapper.unmount()
  })
  it('拒绝跨单位响应，403清除全部快照并停止继续查询', async () => {
    const wrapper = mountView(); await wrapper.get('form').trigger('submit'); await flushPromises()
    vi.mocked(api.getHistory).mockImplementation(async query => ({ ...result(query), unit: 'V' }))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('响应点位、单位或时间范围不匹配')
    vi.mocked(api.getHistory).mockRejectedValue(new ApiError('权限拒绝', 403))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('比较数据已清除')
    expect(wrapper.findAll('history-chart-stub')).toHaveLength(0)
    expect(wrapper.get('[data-testid="compare-query"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
