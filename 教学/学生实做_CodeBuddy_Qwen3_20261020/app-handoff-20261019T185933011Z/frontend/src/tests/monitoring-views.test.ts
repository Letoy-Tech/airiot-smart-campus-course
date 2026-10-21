import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import * as api from '../api/full'
import { useCampusStore } from '../stores/campus'
import DeviceCatalog from '../views/DeviceCatalog.vue'
import EnergyView from '../views/EnergyView.vue'
import OverviewView from '../views/OverviewView.vue'
import HistoryView from '../views/HistoryView.vue'
import type { Overview } from '../types/full'
vi.mock('../api/full')
const overview: Overview = {
  source: 'TEACHING_MOCK', projectId: 'teaching', observedAt: 4000000, simulated: true,
  spaces: [1, 2, 3, 4].map(n => ({ id: `s${n}`, name: `空间${n}`, type: null, campusId: null, buildingId: null, floor: null })),
  devices: [1, 2].map(n => ({ id: `d${n}`, tableId: 't', name: `能源${n}`, category: 'energy', spaceId: `s${n}`, spaceName: `空间${n}`, online: null, communicationTime: null, switchOn: null, simulated: true, tags: [{ id: 'power', name: '功率', unit: 'kW' }, { id: 'voltage', name: '电压', unit: 'V' }] })),
  points: [{ deviceId: 'd1', tableId: 't', tagId: 'power', value: 0, time: 3999999, quality: 'fresh', unit: 'kW' }, { deviceId: 'd1', tableId: 't', tagId: 'voltage', value: null, time: null, quality: 'missing', unit: 'V' }],
  issues: [], completeness: { actualSpaces: 4, actualDevices: 2, actualPoints: 2, expectedSpaces: 4, expectedDevices: 2, expectedPoints: 2 },
}
beforeEach(() => {
  vi.resetAllMocks(); setActivePinia(createPinia()); history.replaceState(null, '', '#devices')
  const store = useCampusStore()
  store.user = { uid: 'a', username: 'a', displayName: '甲', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
  store.capabilities = { roles: ['ADMIN'], canRead: true, canAdmin: true, canAudit: true, canControl: false, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
  store.devices = structuredClone(overview.devices); store.spaces = structuredClone(overview.spaces); store.observedAt = overview.observedAt; store.hasSucceeded = true
  vi.spyOn(store, 'refreshDevices').mockResolvedValue()
  vi.mocked(api.getOverview).mockResolvedValue(overview)
  vi.mocked(api.getHistory).mockImplementation(async query => ({ source: 'TEACHING_MOCK', deviceId: query.get('deviceId')!, tagId: query.get('tagId')!, unit: 'kW', from: Number(query.get('from')), to: Number(query.get('to')), observedAt: 4000000, samples: [], issues: [], truncated: false }))
})
afterEach(() => vi.useRealTimers())
describe('监测、台账和点位历史连续导航', () => {
  it('概览空间与类型统计有真实筛选链接；能源四空间区分0与未知并切单位', async () => {
    const overviewView = mount(OverviewView, { global: { stubs: { CompareHistory: true } } }); await flushPromises()
    expect(overviewView.find('a[href="#devices?spaceId=s1"]').exists()).toBe(true)
    expect(overviewView.find('a[href="#devices?category=energy"]').exists()).toBe(true)
    expect(overviewView.findAll('[data-testid="quality-matrix"] tbody tr')).toHaveLength(4)
    overviewView.unmount()
    const energy = mount(EnergyView, { global: { stubs: { CompareHistory: true } } }); await flushPromises()
    expect(energy.findAll('.space-cards > section')).toHaveLength(4)
    expect(energy.get('[data-testid="energy-s1"]').text()).toContain('0 kW')
    await energy.get('[data-testid="energy-metric"]').setValue('voltage')
    expect(energy.get('[data-testid="energy-s1"]').text()).toContain('— V')
    expect(energy.get('[data-testid="energy-s1"]').text()).toContain('缺失')
    energy.unmount()
  })
  it('台账读hash联合筛选，可切卡片，点位链接带稳定deviceId/tagId', async () => {
    history.replaceState(null, '', '#devices?spaceId=s1&category=energy&deviceId=d1')
    const wrapper = mount(DeviceCatalog); await flushPromises()
    expect(wrapper.findAll('tr[data-testid^="device-d"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="device-detail"]').text()).toContain('新鲜')
    expect(wrapper.get('[data-testid="device-detail"]').find('a[href="#history?deviceId=d1&tagId=power"]').exists()).toBe(true)
    await wrapper.get('[data-testid="catalog-cards"]').trigger('click')
    expect(wrapper.findAll('.device-cards article')).toHaveLength(1)
    wrapper.unmount()
  })
  it('历史恢复直达点位，未知ID明确错误而不查询第一台', async () => {
    history.replaceState(null, '', '#history?deviceId=d2&tagId=power')
    const wrapper = mount(HistoryView, { global: { stubs: { HistoryChart: true } } }); await flushPromises()
    expect(vi.mocked(api.getHistory).mock.calls[0]![0].get('deviceId')).toBe('d2')
    wrapper.unmount(); vi.mocked(api.getHistory).mockClear()
    history.replaceState(null, '', '#history?deviceId=missing&tagId=power')
    const missing = mount(HistoryView); await flushPromises()
    expect(missing.text()).toContain('链接中的设备或采样点不存在')
    expect(api.getHistory).not.toHaveBeenCalled()
    missing.unmount()
  })
  it('台账两类读取均完成后15秒轮询，离页停止', async () => {
    vi.useFakeTimers()
    let resolve!: (v: Overview) => void
    vi.mocked(api.getOverview).mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
    const wrapper = mount(DeviceCatalog)
    await vi.advanceTimersByTimeAsync(45000); expect(api.getOverview).toHaveBeenCalledTimes(1)
    resolve(overview); await flushPromises(); await vi.advanceTimersByTimeAsync(15000)
    expect(api.getOverview).toHaveBeenCalledTimes(2)
    expect(useCampusStore().refreshDevices).toHaveBeenCalledTimes(2)
    wrapper.unmount(); await vi.advanceTimersByTimeAsync(45000)
    expect(api.getOverview).toHaveBeenCalledTimes(2)
  })
})
