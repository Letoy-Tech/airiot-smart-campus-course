import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import AdminLayout from '@/layout/AdminLayout.vue'
import { useAuthStore } from '@/store/auth'
import { useCampusStore } from '@/store/campus'
import type { CampusCapabilities } from '@/types/campus'
beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage)
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})
afterEach(() => vi.unstubAllGlobals())
async function render(caps: CampusCapabilities, narrow = false) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: narrow, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  const pinia = createPinia(); setActivePinia(pinia)
  const auth = useAuthStore(); auth.setUser({ uid: 'TEST_UID', username: 'TEST_VIEWER', roles: 'CAMPUS_VIEWER', groupIds: '', active: true, accountLocked: false })
  const campus = useCampusStore(); campus.capabilities = caps
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div>TEST page</div>' }, meta: { title: 'TEST 页面' } }] })
  await router.push('/campus/overview'); await router.isReady()
  const wrapper = mount(AdminLayout, { global: { plugins: [pinia, router] } }); await flushPromises(); return wrapper
}
const viewer: CampusCapabilities = { roles: ['CAMPUS_VIEWER'], canRead: true, canControl: false, canAdmin: false, canAudit: false }
describe('按后端能力呈现工作入口', () => {
  it('只读身份可访问校园入口，管理员入口隐藏', async () => {
    const wrapper = await render(viewer)
    const navigation = wrapper.get('nav').text()
    expect(navigation).toContain('设备台账'); expect(navigation).toContain('报警记录')
    expect(navigation).not.toContain('用户管理'); expect(navigation).not.toContain('角色管理')
    expect(navigation).not.toContain('模拟命令审计'); expect(navigation).not.toContain('AIRIOT 接入')
    wrapper.unmount()
  })
  it('管理员能力显示接入、角色与专属审计入口', async () => {
    const wrapper = await render({ ...viewer, canAdmin: true, canAudit: true, canControl: true })
    const navigation = wrapper.get('nav').text()
    expect(navigation).toContain('用户管理'); expect(navigation).toContain('角色管理')
    expect(navigation).toContain('模拟命令审计'); expect(navigation).toContain('AIRIOT 接入')
    wrapper.unmount()
  })
  it('窄屏导航可展开和关闭，折叠时不可聚焦', async () => {
    const wrapper = await render(viewer, true)
    expect(wrapper.get('aside').attributes('inert')).toBeDefined()
    await wrapper.get('button[aria-label="打开菜单"]').trigger('click')
    expect(wrapper.get('button[aria-label="打开菜单"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('aside').attributes('inert')).toBeUndefined()
    await wrapper.get('button[aria-label="关闭菜单"]').trigger('click')
    expect(wrapper.get('button[aria-label="打开菜单"]').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})
