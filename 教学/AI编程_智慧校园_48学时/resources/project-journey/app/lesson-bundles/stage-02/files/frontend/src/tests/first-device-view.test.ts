import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
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

describe('真实刷新失败回归', () => {
  it('成功后失败必须显示旧快照错误，重试成功再清除，不能因已有设备吞错', async () => {
    const store = useCampusStore()
    store.capabilities = { roles: ['ADMIN'], canRead: true, canControl: false, canAdmin: true, canAudit: true, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
    store.hasSucceeded = true
    store.observedAt = 1792281600000
    store.devices = [{ id: 'stable-zero-device', tableId: 't', name: '已读取设备', category: 'energy', spaceId: null, spaceName: null, online: null, communicationTime: null, simulated: true, switchOn: null, tags: [] }]
    const refresh = vi.spyOn(store, 'refreshDevices').mockResolvedValue()
    const view = mount(FirstDeviceRead); await flushPromises()
    store.readError = '本轮后端不可达'; await view.vm.$nextTick()
    expect(view.get('[role="alert"]').text()).toContain('本轮后端不可达')
    expect(view.text()).toContain('保留上次成功快照')
    expect(view.text()).toContain('已读取设备')
    expect(store.observedAt).toBe(1792281600000)
    refresh.mockImplementation(async () => { store.readError = '' })
    await view.get('button').trigger('click'); await flushPromises()
    expect(view.text()).not.toContain('本轮后端不可达')
    expect(view.text()).toContain('已读取设备')
    view.unmount()
  })
})
