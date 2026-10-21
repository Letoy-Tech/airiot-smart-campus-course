import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { Device, HistoryResult } from '@/types/campus'
import { getHistory } from '@/api/campus'
import { useHistorySeries } from '@/composables/useHistorySeries'
vi.mock('@/api/campus', () => ({ getHistory: vi.fn() }))
const device = (id: string): Device => ({ id, name: `TEST ${id}`, tableId: 'TEST', category: 'energy', spaceId: null, spaceName: null, online: null, communicationTime: null, simulated: true, switchOn: null, tags: [{id:'power_kw',name:'功率',unit:'kW'},{id:'voltage_v',name:'电压',unit:'V'}] })
const result = (id: string, tag = 'power_kw'): HistoryResult => ({source:'AIRIOT',deviceId:id,tagId:tag,unit:tag === 'power_kw' ? 'kW' : 'V',from:0,to:1,observedAt:1,samples:[{time:1,value:0}],truncated:false,issues:[]})
const scopes: EffectScope[] = []
function setup(ids = ['a']) {
  const devices = ref(ids.map(device)); const tag = ref('power_kw'); const hours = ref(0.25)
  const scope = effectScope(); scopes.push(scope)
  const resource = scope.run(() => useHistorySeries(devices,tag,hours))!
  return {devices,tag,hours,resource,scope}
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.resetAllMocks() })
describe('真实多设备历史读取', () => {
  it('只查询提供该点的去重设备，最多4台，普通点值刷新不重复历史请求', async () => {
    vi.mocked(getHistory).mockImplementation(async id => result(id))
    const {devices,resource} = setup(['a','a','b','c','d','e'])
    await flushPromises()
    expect(getHistory).toHaveBeenCalledTimes(4)
    expect(resource.entries.value.map(entry => entry.device.id)).toEqual(['a','b','c','d'])
    devices.value = devices.value.map(item => ({...item,online:true}))
    await nextTick(); await flushPromises()
    expect(getHistory).toHaveBeenCalledTimes(4)
  })
  it('切换指标会取消旧请求，旧响应不能覆盖新单位和范围', async () => {
    let resolveOld: (value: HistoryResult) => void = () => {}
    vi.mocked(getHistory).mockImplementation((id,tag) => tag === 'power_kw' ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(result(id,tag)))
    const {tag,resource} = setup()
    const oldSignal = vi.mocked(getHistory).mock.calls[0]![4]!
    tag.value = 'voltage_v'
    await nextTick(); await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(resource.entries.value[0]?.result.unit).toBe('V')
    resolveOld(result('a'))
    await flushPromises()
    expect(resource.entries.value[0]?.result.unit).toBe('V')
  })
  it('同范围刷新失败保留真实上次样本和时间，并明确失败', async () => {
    vi.mocked(getHistory).mockResolvedValueOnce(result('a')).mockRejectedValueOnce(new Error('TEST upstream failure'))
    const {resource} = setup()
    await flushPromises()
    const lastSuccess = resource.lastSuccess.value
    await resource.load()
    expect(resource.entries.value[0]?.result.samples[0]?.value).toBe(0)
    expect(resource.lastSuccess.value).toBe(lastSuccess)
    expect(resource.error.value).toContain('读取失败')
    expect(resource.failures.value[0]).toContain('TEST upstream failure')
  })
  it('部分失败只呈现本次成功设备并列出失败目标，卸载取消请求', async () => {
    vi.mocked(getHistory).mockImplementation(async id => { if (id === 'b') throw new Error('TEST denied'); return result(id) })
    const {resource,scope} = setup(['a','b'])
    await flushPromises()
    expect(resource.entries.value.map(entry => entry.device.id)).toEqual(['a'])
    expect(resource.failures.value[0]).toContain('TEST b')
    const signal = vi.mocked(getHistory).mock.calls[0]![4]!
    scope.stop()
    expect(signal.aborted).toBe(true)
  })
  it('部分刷新失败逐台保留上次历史并标记；设备改名不重拉历史', async () => {
    vi.mocked(getHistory).mockImplementation(async id => result(id))
    const {resource,devices} = setup(['a','b'])
    await flushPromises()
    vi.mocked(getHistory).mockImplementation(async id => { if(id === 'b') throw new Error('TEST upstream'); return {...result(id),to:2} })
    await resource.load()
    expect(resource.entries.value.map(entry=>[entry.device.id,entry.result.to,entry.retained ?? false])).toEqual([['a',2,false],['b',1,true]])
    devices.value = devices.value.map(item=>({...item,name:`TEST renamed ${item.id}`}))
    await nextTick()
    expect(resource.entries.value[1]?.device.name).toBe('TEST renamed b')
    expect(getHistory).toHaveBeenCalledTimes(4)
  })
})
