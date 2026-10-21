import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CampusCapabilities, Device, Point } from '@/types/campus'
import { canControlDevice, confirmedControl, onlineLabel, pointLabel, switchLabel } from '@/utils/campus'
import PointValue from '@/components/campus/PointValue.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import { useResource } from '@/composables/useResource'
import { getCapabilities } from '@/api/campus'
import { useCampusStore } from '@/store/campus'
import App from '@/App.vue'
vi.mock('@/api/campus', () => ({ getCapabilities: vi.fn() }))
const viewer: CampusCapabilities = { roles: ['CAMPUS_VIEWER'], canRead: true, canControl: false, canAdmin: false, canAudit: false }
const manager: CampusCapabilities = { ...viewer, roles: ['CAMPUS_MANAGER'], canControl: true }
const device: Device = { id: 'facility_demo_01', tableId: 'campus_facility', name: 'TEST fixture', category: 'facility', spaceId: null, spaceName: null, online: null, communicationTime: null, simulated: true, switchOn: false, tags: [] }
const point: Point = { deviceId: 'TEST', tableId: 'TEST', tagId: 'TEST', value: 0, time: 1700000000000, quality: 'fresh', unit: 'kW' }
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
describe('数据证据与显示', () => {
  it('有效零与缺失、无效值不同，未知布尔不变成关闭或离线', () => {
    expect(pointLabel(point)).toBe('0 kW')
    expect(pointLabel(undefined)).toBe('未取得有效值')
    expect(pointLabel({ ...point, value: null })).toBe('未取得有效值')
    expect(pointLabel({ ...point, value: NaN })).toBe('未取得有效值')
    expect(pointLabel({ ...point, quality: 'invalid' })).toBe('未取得有效值')
    expect(switchLabel(null)).toBe('未知')
    expect(switchLabel(false)).toBe('关闭')
    expect(onlineLabel(null)).toBe('状态未知')
  })
  it('过期值保留数值且明确质量；缺失点不显示0', () => {
    const stale = mount(PointValue, { props: { point: { ...point, value: 2.5, quality: 'stale' } } })
    expect(stale.text()).toContain('2.5 kW'); expect(stale.text()).toContain('过期')
    const missing = mount(PointValue)
    expect(missing.text()).toContain('未取得有效值'); expect(missing.text()).toContain('缺失'); expect(missing.text()).not.toContain('0 kW')
  })
  it('刷新失败显式标记旧数据而非空列表或成功', () => {
    const wrapper = mount(ResourceState, { props: { loading: false, error: '上游读取失败', hasData: true, lastSuccess: 1700000000000 } })
    expect(wrapper.get('[role="alert"]').text()).toContain('上次成功数据')
    expect(wrapper.text()).toContain('上游读取失败')
  })
})
describe('模拟控制边界', () => {
  it('只读身份、未知状态、非既有对象、错误模型均不能控制', () => {
    expect(canControlDevice(device, viewer)).toBe(false)
    expect(canControlDevice(device, null)).toBe(false)
    expect(canControlDevice({ ...device, switchOn: null }, manager)).toBe(false)
    expect(canControlDevice({ ...device, id: 'facility_demo_05' }, manager)).toBe(false)
    expect(canControlDevice({ ...device, tableId: 'other_project' }, manager)).toBe(false)
    expect(canControlDevice({ ...device, category: 'energy' }, manager)).toBe(false)
    expect(canControlDevice(device, manager)).toBe(true)
  })
  it('只接受严格Boolean的匹配回读，包括关闭的false', () => {
    expect(confirmedControl(false, { requested: false, confirmed: false })).toBe(true)
    expect(confirmedControl(true, { requested: true, confirmed: false })).toBe(false)
    expect(confirmedControl(true, { requested: true, confirmed: 'true' as unknown as boolean })).toBe(false)
  })
})
describe('能力获取', () => {
  it('只读能力不提升权限，失败时撤销缓存权限', async () => {
    setActivePinia(createPinia()); const store = useCampusStore()
    vi.mocked(getCapabilities).mockResolvedValue(viewer)
    await store.ensureCapabilities()
    expect(store.capabilities?.canAdmin).toBe(false); expect(store.capabilities?.canControl).toBe(false)
    vi.mocked(getCapabilities).mockRejectedValue(new Error('权限服务失败'))
    await expect(store.ensureCapabilities(true)).rejects.toThrow('权限服务失败')
    expect(store.capabilities).toBeNull()
  })
  it('拒绝字符串或数字形式的授权标记', async () => {
    setActivePinia(createPinia()); const store = useCampusStore()
    vi.mocked(getCapabilities).mockResolvedValue({ ...viewer, canControl: 'true', canAdmin: 1 } as unknown as CampusCapabilities)
    await store.ensureCapabilities()
    expect(store.capabilities?.canControl).toBe(false); expect(store.capabilities?.canAdmin).toBe(false)
  })
  it('处置权限独立读取，新增能力只接受严格Boolean', async () => {
    setActivePinia(createPinia()); const store = useCampusStore()
    vi.mocked(getCapabilities).mockResolvedValue({ ...viewer, canHandleAlarms: true, canAssignAlarms: 'true', canRunDemoScenarios: 1 } as unknown as CampusCapabilities)
    await store.ensureCapabilities()
    expect(store.capabilities?.canHandleAlarms).toBe(true)
    expect(store.capabilities?.canControl).toBe(false)
    expect(store.capabilities?.canAssignAlarms).toBe(false)
    expect(store.capabilities?.canRunDemoScenarios).toBe(false)
  })
})
describe('后台读取生命周期', () => {
  it('失败保留最后成功数据，并避免请求重叠', async () => {
    let resolve: (value: { value: number }) => void = () => {}
    const fetcher = vi.fn().mockResolvedValueOnce({ value: 12 }).mockRejectedValueOnce(new Error('读取失败')).mockImplementationOnce(() => new Promise(r => { resolve = r }))
    let resource!: ReturnType<typeof useResource<{ value: number }>>
    const wrapper = mount(defineComponent({ setup() { resource = useResource(fetcher); return () => null } }))
    await flushPromises(); expect(resource.data.value).toEqual({ value: 12 })
    await resource.load(); expect(resource.data.value).toEqual({ value: 12 }); expect(resource.error.value).toBe('读取失败')
    const request = resource.load(); await resource.load(); expect(fetcher).toHaveBeenCalledTimes(3)
    resolve({ value: 15 }); await request; expect(resource.data.value).toEqual({ value: 15 }); expect(resource.error.value).toBe('')
    wrapper.unmount()
  })
  it('离开页面后停止轮询', async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockResolvedValue({ value: 1 })
    const wrapper = mount(defineComponent({ setup() { useResource(fetcher, 15000); return () => null } }))
    await flushPromises(); expect(fetcher).toHaveBeenCalledTimes(1)
    wrapper.unmount(); await vi.advanceTimersByTimeAsync(60000); expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
describe('应用入口', () => {
  it('通过路由视图呈现实际页面', () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: { template: '<main>TEST route content</main>' } } } })
    expect(wrapper.get('main').text()).toBe('TEST route content')
  })
})
