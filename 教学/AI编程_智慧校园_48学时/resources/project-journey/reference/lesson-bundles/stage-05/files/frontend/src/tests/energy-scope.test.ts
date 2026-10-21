import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EnergyView from '../views/EnergyView.vue'
import * as api from '../api/full'
import { useCampusStore } from '../stores/campus'
import type { Overview } from '../types/full'
vi.mock('../api/full')
const comparison = { name: 'CompareHistory', props: ['devices', 'tagId', 'unit', 'observedAt'], template: '<section>独立历史比较</section>' }
const fixture: Overview = {
  source: 'TEACHING_MOCK', projectId: 'teaching', simulated: true, observedAt: 4000000,
  spaces: [1, 2, 3, 4].map(n => ({ id: `space-${n}`, name: `空间${n}`, type: null, campusId: null, buildingId: null, floor: null })),
  devices: [
    { id: 'weather-first', tableId: 'weather', name: '环境设备不能进入能源', category: 'environment', spaceId: 'space-1', spaceName: '空间1', online: null, communicationTime: null, switchOn: null, simulated: true, tags: [{ id: 'temperature', name: '温度', unit: '°C' }, { id: 'power', name: '同名异类点', unit: 'kW' }] },
    { id: 'meter-zero', tableId: 'meter', name: '真正能源设备', category: 'energy', spaceId: 'space-1', spaceName: '空间1', online: null, communicationTime: null, switchOn: null, simulated: true, tags: [{ id: 'power', name: '功率', unit: 'kW' }, { id: 'voltage', name: '电压', unit: 'V' }] },
  ],
  points: [
    { deviceId: 'weather-first', tableId: 'weather', tagId: 'power', value: 999, time: 3999999, quality: 'fresh', unit: 'kW' },
    { deviceId: 'meter-zero', tableId: 'meter', tagId: 'power', value: 0, time: 3999999, quality: 'fresh', unit: 'kW' },
    { deviceId: 'meter-zero', tableId: 'meter', tagId: 'voltage', value: null, time: null, quality: 'missing', unit: 'V' },
  ], issues: [], completeness: { actualSpaces: 4, actualDevices: 2, actualPoints: 3, expectedSpaces: 4, expectedDevices: 2, expectedPoints: 3 },
}
beforeEach(() => {
  vi.resetAllMocks(); setActivePinia(createPinia())
  const store = useCampusStore()
  store.user = { uid: 'a', username: 'a', displayName: '甲', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
  store.capabilities = { roles: ['ADMIN'], canRead: true, canAdmin: true, canAudit: true, canControl: false, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
  vi.mocked(api.getOverview).mockResolvedValue(structuredClone(fixture))
})
describe('第05站能源混合目录回归', () => {
  it('环境设备排在前面、有同名power点也不能进入能源选项或历史比较', async () => {
    const view = mount(EnergyView, { global: { stubs: { CompareHistory: comparison } } }); await flushPromises()
    expect(view.get('select').element.value).toBe('power')
    expect(view.findAll('option').map(x => x.element.value)).toEqual(['power', 'voltage'])
    expect(view.text()).not.toContain('环境设备不能进入能源'); expect(view.text()).not.toContain('999')
    expect(view.get('[data-testid="energy-space-1"]').text()).toContain('0 kW')
    expect(view.findComponent({ name: 'CompareHistory' }).props('devices').map((d: { id: string }) => d.id)).toEqual(['meter-zero'])
    view.unmount()
  })
  it('切V保持缺失并同步历史单位，不把null补为0', async () => {
    const view = mount(EnergyView, { global: { stubs: { CompareHistory: comparison } } }); await flushPromises()
    await view.get('[data-testid="energy-metric"]').setValue('voltage')
    expect(view.get('[data-testid="energy-space-1"]').text()).toContain('— V')
    expect(view.get('[data-testid="energy-space-1"]').text()).toContain('缺失')
    expect(view.findComponent({ name: 'CompareHistory' }).props('tagId')).toBe('voltage')
    expect(view.findComponent({ name: 'CompareHistory' }).props('unit')).toBe('V')
    view.unmount()
  })
  it('没有能源设备时不能用环境设备填空', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ ...structuredClone(fixture), devices: [fixture.devices[0]!] })
    const view = mount(EnergyView, { global: { stubs: { CompareHistory: comparison } } }); await flushPromises()
    expect(view.findAll('.space-cards > section')).toHaveLength(4)
    expect(view.text()).toContain('此空间没有能源设备')
    expect(view.findComponent({ name: 'CompareHistory' }).props('devices')).toEqual([])
    view.unmount()
  })
})
