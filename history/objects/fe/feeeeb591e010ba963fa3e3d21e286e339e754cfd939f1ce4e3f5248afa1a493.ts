import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import CasesView from '../views/CasesView.vue'
import { useCampusStore } from '../stores/campus'
import * as api from '../api/full'
import { ApiError } from '../api/http'
import type { AlarmDetail } from '../types/full'

vi.mock('../api/full', () => ({
  getCases: vi.fn(), getCase: vi.fn(), getHandlers: vi.fn(), getDemoStatus: vi.fn(),
  triggerDemo: vi.fn(), actOnCase: vi.fn(),
}))

function detail(id: string): AlarmDetail {
  return {
    id, sourceId: id, scenario: 'patrol', deviceId: id, deviceName: id, message: `模拟事件 ${id}`,
    sourceType: 'DEMO', sourceScope: 'LOCAL_DEMO', simulated: true, level: 'DEMO_NOTICE',
    occurredAt: 1, sourceState: 'ACTIVE', sourceRawStatus: 'DEMO_ACTIVE', sourceRecoveredAt: null,
    sourceObservedAt: 1, sourceVerifiedAt: null, sourceCheckOutcome: 'PENDING', state: 'NEW',
    assigneeUid: null, assigneeName: null, createdAt: 1, updatedAt: 1, closedAt: null,
    disposition: null, version: 1, timeline: [],
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  const store = useCampusStore()
  store.user = { uid: 'admin', username: 'admin', displayName: '教师', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
  store.capabilities = {
    roles: ['ADMIN'], canRead: true, canAdmin: true, canControl: false, canAudit: true,
    canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true,
  }
  vi.mocked(api.getCases).mockResolvedValue({ items: [detail('old-A')], total: 1, observedAt: 1 })
  vi.mocked(api.getHandlers).mockResolvedValue({ items: [{ uid: 'manager-a', displayName: '甲' }], currentUid: 'admin' })
  vi.mocked(api.getDemoStatus).mockResolvedValue({
    enabled: true, label: '教学模拟',
    scenarios: [{ id: 'patrol', name: '巡查', deviceId: 'new-B', description: '模拟' }], limitations: [],
  })
  vi.mocked(api.triggerDemo).mockResolvedValue(detail('new-B'))
})

describe('新建演练接管详情请求', () => {
  it.each(['success', 'forbidden', 'network-error'] as const)(
    '旧事件详情迟到 %s 不覆盖或清除新事件，也不留下旧错误',
    async outcome => {
      let resolve!: (value: AlarmDetail) => void
      let reject!: (reason: unknown) => void
      vi.mocked(api.getCase).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no }))
      const wrapper = mount(CasesView)
      await flushPromises()
      await wrapper.get('[data-testid="case-old-A"]').trigger('click')
      const oldSignal = vi.mocked(api.getCase).mock.calls[0]?.[1]
      await wrapper.get('[data-testid="trigger-demo"]').trigger('click')
      await flushPromises()
      expect(oldSignal?.aborted).toBe(true)
      expect(wrapper.get('.case-detail').text()).toContain('new-B')
      // 模拟不遵守 AbortSignal 的迟到返回，仍须由 epoch/seq 门控拒绝写入。
      if (outcome === 'success') resolve(detail('old-A'))
      else if (outcome === 'forbidden') reject(new ApiError('旧详情权限拒绝', 403, 403))
      else reject(new Error('旧详情网络错误'))
      await flushPromises()
      const panel = wrapper.get('.case-detail')
      expect(panel.text()).toContain('new-B')
      expect(panel.text()).not.toContain('old-A')
      expect(panel.find('[role="alert"]').exists()).toBe(false)
      expect(panel.text()).toContain('已创建本地模拟事件')
      expect(vi.mocked(api.triggerDemo)).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    },
  )

  it('新事件不继承上一个事件尚未提交的分派人', async () => {
    vi.mocked(api.getCase).mockResolvedValue(detail('old-A'))
    const wrapper = mount(CasesView)
    await flushPromises()
    await wrapper.get('[data-testid="case-old-A"]').trigger('click')
    await flushPromises()
    const select = wrapper.get<HTMLSelectElement>('[data-testid="case-assignee"]')
    await select.setValue('manager-a')
    await wrapper.get('[data-testid="trigger-demo"]').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLSelectElement>('[data-testid="case-assignee"]').element.value).toBe('')
    expect(wrapper.get('.case-detail').text()).toContain('new-B')
    wrapper.unmount()
  })
})
