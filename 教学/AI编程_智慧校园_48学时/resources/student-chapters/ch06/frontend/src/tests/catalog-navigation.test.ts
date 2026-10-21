import { mount } from '@vue/test-utils'
import { createPinia,setActivePinia } from 'pinia'
import { beforeEach,describe,it,expect,vi } from 'vitest'
import { useCampusStore } from '../stores/campus'
import DeviceCatalog from '../views/DeviceCatalog.vue'
import type { Device } from '../types/campus'
const device=(id:string,name:string,online:boolean|null):Device=>({id,name,online,tableId:'table',category:'energy',spaceId:'s1',spaceName:'一号空间',communicationTime:null,simulated:true,switchOn:null,tags:[{id:'power',name:'功率',unit:'kW'}]})
beforeEach(()=>{setActivePinia(createPinia());history.replaceState(null,'','#devices');const store=useCampusStore();store.devices=[device('stable-a','甲设备',true),device('stable-b','乙设备',null)];store.hasSucceeded=true;store.observedAt=100;vi.spyOn(store,'refreshDevices').mockResolvedValue()})
describe('设备详情与筛选导航',()=>{
  it('读取成功但源目录为空，不提示调整筛选',()=>{
    useCampusStore().devices=[]
    const wrapper=mount(DeviceCatalog)
    expect(wrapper.text()).toContain('目录暂无设备，当前读取已成功')
    expect(wrapper.text()).not.toContain('暂无匹配设备，请调整筛选')
    wrapper.unmount()
  })
  it('源目录有设备但筛选无结果，提示调整筛选',async()=>{
    const wrapper=mount(DeviceCatalog)
    await wrapper.get('[data-testid="device-search"]').setValue('不存在的设备')
    expect(wrapper.text()).toContain('暂无匹配设备，请调整筛选')
    expect(wrapper.text()).not.toContain('目录暂无设备，当前读取已成功')
    wrapper.unmount()
  })
  it('从URL稳定deviceId恢复详情，即使台账顺序变化也不靠数组下标',()=>{
    history.replaceState(null,'','#devices?deviceId=stable-b');useCampusStore().devices.reverse()
    const wrapper=mount(DeviceCatalog);expect(wrapper.get('[data-testid="device-detail"]').text()).toContain('乙设备');expect(wrapper.get('[data-testid="device-detail"]').text()).toContain('power');wrapper.unmount()
  })
  it('未知ID明确提示而不使用第一项冒充设备',()=>{
    history.replaceState(null,'','#devices?deviceId=missing');const wrapper=mount(DeviceCatalog);expect(wrapper.get('[data-testid="device-detail"]').text()).toContain('设备标识不存在：missing');wrapper.unmount()
  })
  it('清除全部筛选后返回完整台账且在线未知仍分开',async()=>{
    const wrapper=mount(DeviceCatalog);await wrapper.get('[data-testid="device-search"]').setValue('没有');await wrapper.get('[data-testid="online-filter"]').setValue('unknown');expect(wrapper.findAll('.data-table tbody tr')).toHaveLength(0)
    await wrapper.get('[data-testid="clear-device-filters"]').trigger('click');expect(wrapper.findAll('.data-table tbody tr')).toHaveLength(2);expect(wrapper.get('[data-testid="online-filter"]').element).toHaveProperty('value','all');wrapper.unmount()
  })
})
