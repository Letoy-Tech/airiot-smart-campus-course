import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useCampusStore } from '@/store/campus'
import type { Capability } from '@/types/campus'
import { AuthExpiredError } from '@/utils/request'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/auth/Login.vue'), meta: { title: '登录' } },
    { path: '/', component: () => import('@/layout/AdminLayout.vue'), redirect: '/campus/operations', children: [
      { path: 'dashboard', redirect: '/campus/operations' },
      { path: 'campus/operations', component: () => import('@/views/campus/Operations.vue'), meta: { title: '演示运营', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/alarm-cases/:id', component: () => import('@/views/campus/CaseDetail.vue'), meta: { title: '事件处置', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/device-owners', component: () => import('@/views/campus/DeviceOwners.vue'), meta: { title: '设备责任人', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/overview', component: () => import('@/views/campus/Overview.vue'), meta: { title: '校园概览', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/locations', component: () => import('@/views/campus/Locations.vue'), meta: { title: '空间与楼栋', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/devices', component: () => import('@/views/campus/Devices.vue'), meta: { title: '设备台账', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/devices/:id', component: () => import('@/views/campus/DeviceDetail.vue'), meta: { title: '设备详情', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/energy', component: () => import('@/views/campus/Energy.vue'), meta: { title: '能源点位', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/alarms', component: () => import('@/views/campus/Alarms.vue'), meta: { title: '报警记录', requiresAuth: true, capability: 'canRead' } },
      { path: 'campus/audit', component: () => import('@/views/campus/Audit.vue'), meta: { title: '模拟命令审计', requiresAuth: true, capability: 'canAudit' } },
      { path: 'campus/integration', component: () => import('@/views/campus/Integration.vue'), meta: { title: 'AIRIOT 接入', requiresAuth: true, capability: 'canAdmin' } },
      { path: 'access', component: () => import('@/views/campus/Access.vue'), meta: { title: '访问状态', requiresAuth: true } },
      { path: 'users', component: () => import('@/views/users/List.vue'), meta: { title: '用户管理', requiresAuth: true, capability: 'canAdmin' } },
      { path: 'groups', component: () => import('@/views/groups/Index.vue'), meta: { title: '组织架构', requiresAuth: true, capability: 'canAdmin' } },
      { path: 'roles', component: () => import('@/views/roles/Index.vue'), meta: { title: '角色管理', requiresAuth: true, capability: 'canAdmin' } },
      { path: 'security-rules', component: () => import('@/views/security-rules/List.vue'), meta: { title: '访问规则', requiresAuth: true, capability: 'canAdmin' } },
      { path: 'profile', component: () => import('@/views/profile/Index.vue'), meta: { title: '账户信息', requiresAuth: true } },
    ] },
    { path: '/:pathMatch(.*)*', redirect: '/campus/operations' },
  ],
})
router.beforeEach(async to => {
  const auth = useAuthStore()
  document.title = `${String(to.meta.title || '校园管理')} · 智慧校园`
  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.path === '/login' && auth.isLoggedIn) return '/campus/operations'
  if (auth.isLoggedIn && !auth.user) {
    try { await auth.fetchMe() } catch (e) { if (e instanceof AuthExpiredError) return '/login'; if (to.path !== '/access') return '/access' }
  }
  if (to.meta.capability) {
    const campus = useCampusStore()
    try { await campus.ensureCapabilities() } catch { return '/access' }
    if (!campus.capabilities?.[to.meta.capability as Capability]) return '/access'
  }
  return true
})
export default router
