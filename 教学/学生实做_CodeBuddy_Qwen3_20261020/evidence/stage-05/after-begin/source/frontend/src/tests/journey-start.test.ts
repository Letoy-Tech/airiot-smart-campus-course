import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticDevices from '../views/StaticDevices.vue'
import { communicationLabel } from '../domain/journey-exercises'
describe('连续项目起点', () => {
  it('只显示两台明确模拟设备并保留未知', () => {
    const view = mount(StaticDevices)
    expect(view.findAll('tbody tr')).toHaveLength(2)
    expect(view.text()).toContain('未知')
    expect(view.text()).toContain('TEACHING_MOCK')
    expect(view.text()).not.toContain('已连接AIRIOT')
  })
  it('通信标签区分三态，0不是设备状态输入', () => {
    expect([true, false, null].map(communicationLabel)).toEqual(['在线', '离线', '未知'])
  })
})
