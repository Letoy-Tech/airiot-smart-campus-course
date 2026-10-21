import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirstDeviceRead, { onlineLabel } from '../views/FirstDeviceRead.vue'
import { useCampusStore } from '../stores/campus'

beforeEach(() => setActivePinia(createPinia()))
describe('页面事实与三态', () => {
  it.each([[true, '在线'], [false, '离线'], [null, '未知']] as const)('online=%s 明确显示 %s', (value, text) => {
    expect(onlineLabel(value)).toBe(text)
  })
  it('非法字符串不能冒充 Boolean 或合法未知', () => {
    expect(() => onlineLabel('false' as unknown as boolean)).toThrow()
  })
  it('首次失败与成功空目录使用不同反馈', async () => {
    const store = useCampusStore()
    store.capabilities = { roles: ['CAMPUS_VIEWER'], canRead: true, canControl: false, canAdmin: false, canAudit: false, canHandleAlarms: false, canAssignAlarms: false, canRunDemoScenarios: false }
    vi.spyOn(store, 'refreshDevices').mockResolvedValue()
    store.readError = 'network issue'
    const wrapper = mount(FirstDeviceRead)
    expect(wrapper.text()).toContain('首次读取未成功')
    expect(wrapper.text()).not.toContain('目录暂无设备')
    expect(wrapper.text()).not.toContain('显示 0 / 0')
    store.readError = ''
    store.hasSucceeded = true
    store.observedAt = 1792281600000
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('目录暂无设备')
    expect(wrapper.text()).toContain('固定教学时钟')
    wrapper.unmount()
  })
})
