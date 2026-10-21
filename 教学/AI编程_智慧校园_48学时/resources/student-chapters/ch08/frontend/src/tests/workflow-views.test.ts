import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import * as api from '../api/full'
import { useCampusStore } from '../stores/campus'
import CasesView from '../views/CasesView.vue'
import OwnersView from '../views/OwnersView.vue'
import type { AlarmDetail, OwnerDetail } from '../types/full'
import { ApiError } from '../api/http'
vi.mock('../api/full')
const detail: AlarmDetail = {
  id: 'case-a',
  sourceId: 'src',
  scenario: 'temperature-patrol',
  deviceId: 'd',
  deviceName: '教学设备',
  message: '演练',
  sourceType: 'DEMO',
  sourceScope: 'LOCAL_DEMO',
  simulated: true,
  level: 'DEMO_NOTICE',
  occurredAt: 10,
  sourceState: 'ACTIVE',
  sourceRawStatus: 'DEMO_ACTIVE',
  sourceRecoveredAt: null,
  sourceObservedAt: 10,
  sourceVerifiedAt: null,
  sourceCheckOutcome: 'PENDING',
  state: 'IN_PROGRESS',
  assigneeUid: 'a',
  assigneeName: '甲',
  createdAt: 10,
  updatedAt: 10,
  closedAt: null,
  disposition: null,
  version: 3,
  timeline: [],
}
const owner: OwnerDetail = {
  deviceId: 'd',
  ownerUid: 'a',
  ownerName: '甲',
  version: 2,
  updatedAt: 10,
  timeline: [],
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  history.replaceState(null, '', '#cases')
  const store = useCampusStore()
  store.user = {
    uid: 'a',
    username: 'a',
    displayName: '甲',
    roles: ['ADMIN'],
    source: 'TEACHING_MOCK',
  }
  store.csrf = { token: 'test-token', headerName: 'X-CSRF-TOKEN' }
  store.capabilities = {
    roles: ['ADMIN'],
    canRead: true,
    canAdmin: true,
    canAudit: true,
    canControl: false,
    canHandleAlarms: true,
    canAssignAlarms: true,
    canRunDemoScenarios: true,
  }
  vi.spyOn(store, 'refreshDevices').mockResolvedValue()
  vi.mocked(api.getCases).mockResolvedValue({ items: [detail], total: 1, observedAt: 10 })
  vi.mocked(api.getCase).mockResolvedValue({ ...detail })
  vi.mocked(api.getHandlers).mockResolvedValue({
    items: [
      { uid: 'a', displayName: '甲' },
      { uid: 'b', displayName: '乙' },
    ],
    currentUid: 'a',
  })
  vi.mocked(api.getDemoStatus).mockResolvedValue({
    enabled: true,
    label: '本地演练',
    scenarios: [],
    limitations: [],
  })
  vi.mocked(api.getOwners).mockResolvedValue({ items: [owner], observedAt: 10 })
  vi.mocked(api.getOwner).mockResolvedValue({ ...owner })
})
describe('事件和责任的冲突交互', () => {
  it('事件列表403清除已选详情、输入和写入口，重新登录前不重发', async () => {
    const wrapper = mount(CasesView)
    await flushPromises()
    await wrapper.get('[data-testid="case-case-a"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="case-note"]').setValue('权限撤销前的草稿')
    vi.mocked(api.getCases).mockRejectedValue(new ApiError('权限拒绝', 403))
    await wrapper.get('header button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="case-read-denied"]').text()).toContain('重新登录')
    expect(wrapper.find('[data-testid="case-version"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="case-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="trigger-demo"]').exists()).toBe(false)
    await wrapper.get('header button').trigger('click')
    await flushPromises()
    expect(api.getCases).toHaveBeenCalledTimes(2)
    expect(api.actOnCase).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('责任列表403清除缓存详情、负责人和理由，不重发变更', async () => {
    const wrapper = mount(OwnersView)
    await flushPromises()
    await wrapper.get('[data-testid="owner-d"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="owner-note"]').setValue('待提交理由')
    vi.mocked(api.getOwners).mockRejectedValue(new ApiError('权限拒绝', 403))
    await wrapper.get('header button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="owner-read-denied"]').text()).toContain('重新登录')
    expect(wrapper.find('[data-testid="owner-version"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="owner-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="save-owner"]').exists()).toBe(false)
    await wrapper.get('header button').trigger('click')
    await flushPromises()
    expect(api.getOwners).toHaveBeenCalledTimes(2)
    expect(api.saveOwner).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('NOTE 收到409后回读新版本、保留输入，确认前不允许重放', async () => {
    const wrapper = mount(CasesView)
    await flushPromises()
    await wrapper.get('[data-testid="case-case-a"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="case-note"]').setValue('保留我的检查记录')
    vi.mocked(api.getCase).mockResolvedValue({ ...detail, version: 4 })
    vi.mocked(api.actOnCase).mockRejectedValue(new ApiError('版本冲突', 409, 'VERSION_CONFLICT'))
    await wrapper.get('[data-testid="note-case"]').trigger('click')
    await flushPromises()
    expect(api.actOnCase).toHaveBeenCalledTimes(1)
    expect(api.actOnCase).toHaveBeenCalledWith(
      'case-a',
      'notes',
      { expectedVersion: 3, note: '保留我的检查记录' },
      expect.anything(),
      expect.anything(),
    )
    expect(wrapper.get('[data-testid="case-note"]').element).toHaveProperty(
      'value',
      '保留我的检查记录',
    )
    expect(wrapper.get('[data-testid="case-version"]').text()).toContain('v4')
    expect(wrapper.get('[data-testid="case-conflict"]').text()).toContain('没有自动重放')
    expect(wrapper.get('[data-testid="note-case"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ack-case-conflict"]').trigger('click')
    expect(api.actOnCase).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="note-case"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('责任变更409保留人选和理由，回读失败不能解除冲突', async () => {
    const wrapper = mount(OwnersView)
    await flushPromises()
    await wrapper.get('[data-testid="owner-d"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="owner-assignee"]').setValue('b')
    await wrapper.get('[data-testid="owner-note"]').setValue('轮值调整')
    vi.mocked(api.saveOwner).mockRejectedValue(new ApiError('冲突', 409))
    vi.mocked(api.getOwner).mockRejectedValue(new ApiError('网络未恢复'))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.saveOwner).toHaveBeenCalledWith(
      'd',
      'b',
      '轮值调整',
      2,
      expect.anything(),
      expect.anything(),
    )
    expect(wrapper.get('[data-testid="owner-note"]').element).toHaveProperty('value', '轮值调整')
    expect(wrapper.get('[data-testid="owner-assignee"]').element).toHaveProperty('value', 'b')
    expect(wrapper.get('[data-testid="save-owner"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('已核对最新责任')
    wrapper.unmount()
  })
  it('从URL恢复合法state但忽略旧skip，状态改变后查询skip=0', async () => {
    history.replaceState(null, '', '#cases?state=CLOSED&skip=50')
    const wrapper = mount(CasesView)
    await flushPromises()
    expect(api.getCases).toHaveBeenLastCalledWith('limit=10&skip=0&state=CLOSED', expect.anything())
    await wrapper.get('[data-testid="case-state"]').setValue('NEW')
    await flushPromises()
    expect(api.getCases).toHaveBeenLastCalledWith('limit=10&skip=0&state=NEW', expect.anything())
    expect(location.hash).toBe('#cases?state=NEW')
    wrapper.unmount()
  })
  it('只读身份不显示业务写入口', async () => {
    const store = useCampusStore()
    store.capabilities = {
      roles: ['CAMPUS_VIEWER'],
      canRead: true,
      canAdmin: false,
      canAudit: false,
      canControl: false,
      canHandleAlarms: false,
      canAssignAlarms: false,
      canRunDemoScenarios: false,
    }
    const wrapper = mount(CasesView)
    await flushPromises()
    await wrapper.get('[data-testid="case-case-a"]').trigger('click')
    await flushPromises()
    for (const key of ['trigger-demo', 'assign-case', 'note-case', 'close-case', 'recover-case'])
      expect(wrapper.find(`[data-testid="${key}"]`).exists()).toBe(false)
    wrapper.unmount()
  })
})
