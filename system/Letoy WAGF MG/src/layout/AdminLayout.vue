<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useCampusStore } from '@/store/campus'
import { useIsMobile } from '@/utils/responsive'
import { messageBox } from '@/utils/messageBox'
import { setBodyScrollLock, unlockBodyScroll } from '@/utils/scrollLock'
import { theme, toggleTheme } from '@/utils/theme'
import VGlobalLoading from '@/components/common/VGlobalLoading.vue'
import CommandPalette from '@/components/business/CommandPalette.vue'
const route = useRoute(); const auth = useAuthStore(); const campus = useCampusStore()
const mobile = useIsMobile(); const drawer = ref(false); const palette = ref(false)
const readCollapsed = () => { try { return localStorage.getItem('campus-sidebar') === 'collapsed' } catch { return false } }
const collapsed = ref(readCollapsed())
const toggleCollapsed = () => { collapsed.value = !collapsed.value; try { localStorage.setItem('campus-sidebar', collapsed.value ? 'collapsed' : 'expanded') } catch { /* 不记忆 */ } }
const nav = computed(() => [
  ...(campus.capabilities?.canRead ? [{ title: '校园运行', items: [
    { to: '/campus/operations', label: '演示运营', icon: 'ri-route-line' },
    { to: '/campus/overview', label: '校园概览', icon: 'ri-dashboard-3-line' },
    { to: '/campus/locations', label: '空间与楼栋', icon: 'ri-building-4-line' },
    { to: '/campus/devices', label: '设备台账', icon: 'ri-cpu-line' },
    { to: '/campus/device-owners', label: '设备责任人', icon: 'ri-user-star-line' },
    { to: '/campus/energy', label: '能源点位', icon: 'ri-flashlight-line' },
    { to: '/campus/alarms', label: '报警记录', icon: 'ri-alarm-warning-line' },
  ] }] : []),
  ...(campus.capabilities?.canAdmin ? [{ title: '管理与安全', items: [
    { to: '/campus/integration', label: 'AIRIOT 接入', icon: 'ri-plug-2-line' },
    ...(campus.capabilities.canAudit ? [{ to: '/campus/audit', label: '模拟命令审计', icon: 'ri-file-list-3-line' }] : []),
    { to: '/users', label: '用户管理', icon: 'ri-team-line' },
    { to: '/roles', label: '角色管理', icon: 'ri-shield-user-line' },
    { to: '/groups', label: '组织架构', icon: 'ri-node-tree' },
    { to: '/security-rules', label: '访问规则', icon: 'ri-lock-line' },
  ] }] : []),
])
const crumbGroup = computed(() => nav.value.find(group => group.items.some(item => route.path === item.to || route.path.startsWith(`${item.to}/`)))?.title)
const displayName = computed(() => auth.user?.nickname || auth.user?.username || '当前账户')
const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '我')

const now = ref(new Date())
let clock: ReturnType<typeof setInterval> | undefined
const timeText = computed(() => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now.value))
const dateText = computed(() => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short' }).format(now.value))
const fullscreen = ref(false)
const syncFullscreen = () => { fullscreen.value = !!document.fullscreenElement }
const toggleFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.() }
const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); palette.value = !palette.value } }
onMounted(() => {
  clock = setInterval(() => { now.value = new Date() }, 1000)
  document.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', syncFullscreen)
})

watch(() => route.fullPath, () => { drawer.value = false })
let lock = false
watch([drawer, mobile], ([open, narrow]) => { lock = setBodyScrollLock(open && narrow, lock) })
onUnmounted(() => {
  if (lock) unlockBodyScroll()
  clearInterval(clock)
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
const logout = async () => { try { await messageBox.confirm('确定退出当前管理会话？'); await auth.logout() } catch {} }
</script>
<template><div class="campus-layout" :class="{ collapsed: collapsed && !mobile }">
  <VGlobalLoading />
  <div class="campus-aurora" aria-hidden="true"><span></span><i></i></div>
  <a class="campus-skip" href="#campus-main">跳到主要内容</a>
  <button v-if="mobile && drawer" class="campus-nav-mask" aria-label="关闭导航" @click="drawer = false"></button>
  <aside id="campus-navigation" class="campus-sidebar" :class="{open: drawer}" :inert="mobile && !drawer ? true : undefined">
    <div class="campus-brand">
      <span class="campus-logo" aria-hidden="true"><i class="ri-school-line"></i></span>
      <div class="campus-brand-text"><strong>智慧校园</strong><span>学校演示版 · 模拟项目</span></div>
      <button v-if="mobile" class="campus-icon-button" aria-label="关闭菜单" @click="drawer = false"><i class="ri-close-line" aria-hidden="true"></i></button>
    </div>
    <button v-if="!mobile" class="campus-collapse" :aria-label="collapsed ? '展开侧栏' : '收起侧栏'" :aria-expanded="!collapsed" @click="toggleCollapsed"><i class="ri-arrow-left-s-line" aria-hidden="true"></i></button>
    <nav class="campus-nav scroll-y" aria-label="主导航"><section v-for="group in nav" :key="group.title"><h2>{{ group.title }}</h2><router-link v-for="item in group.items" :key="item.to" :to="item.to" :data-tip="item.label"><i :class="item.icon" aria-hidden="true"></i><span>{{ item.label }}</span></router-link></section></nav>
    <div class="campus-account"><router-link to="/profile" :title="displayName"><span class="campus-avatar" aria-hidden="true">{{ initial }}</span><div><strong>{{ displayName }}</strong><span>{{ auth.currentUserRoleNames.join(' / ') || '账户信息' }}</span></div></router-link><button class="campus-icon-button" aria-label="退出登录" @click="logout"><i class="ri-logout-box-r-line" aria-hidden="true"></i></button></div>
  </aside>
  <div class="campus-workspace">
    <header class="campus-topbar">
      <button v-if="mobile" class="campus-icon-button" aria-label="打开菜单" :aria-expanded="drawer" aria-controls="campus-navigation" @click="drawer = !drawer"><i class="ri-menu-line" aria-hidden="true"></i></button>
      <div class="campus-crumbs"><template v-if="crumbGroup && !mobile"><span>{{ crumbGroup }}</span><i class="ri-arrow-right-s-line" aria-hidden="true"></i></template><strong>{{ route.meta.title || '智慧校园' }}</strong></div>
      <div class="campus-topbar-tools">
        <button class="campus-search-trigger" type="button" aria-label="搜索页面或设备" aria-keyshortcuts="Meta+K Control+K" @click="palette = true"><i class="ri-search-2-line" aria-hidden="true"></i><span>搜索页面或设备</span><kbd>⌘K</kbd></button>
        <span class="campus-topbar-note"><i class="ri-flask-line" aria-hidden="true"></i>全部模拟设备</span>
        <div class="campus-clock" aria-label="北京时间"><strong>{{ timeText }}</strong><span>{{ dateText }}</span></div>
        <button class="campus-tool" type="button" :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'" :title="theme === 'dark' ? '浅色主题' : '深色主题'" @click="toggleTheme($event)"><i :class="theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'" class="theme-icon" aria-hidden="true"></i></button>
        <button v-if="!mobile" class="campus-tool" type="button" :aria-label="fullscreen ? '退出全屏' : '全屏展示'" :title="fullscreen ? '退出全屏' : '全屏展示'" @click="toggleFullscreen"><i :class="fullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'" aria-hidden="true"></i></button>
      </div>
    </header>
    <main id="campus-main" class="campus-main scroll-y" tabindex="-1"><router-view v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" :key="route.path" /></Transition></router-view></main>
  </div>
  <CommandPalette v-model:open="palette" :groups="nav" :can-read="campus.capabilities?.canRead === true" />
</div></template>
