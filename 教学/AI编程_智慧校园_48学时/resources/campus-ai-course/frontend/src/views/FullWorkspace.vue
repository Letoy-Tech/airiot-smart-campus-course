<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import DeviceCatalog from './DeviceCatalog.vue'
const pages = [
  ['devices', '设备台账', '06'],
  ['locations', '空间归属', '05'],
  ['overview', '校园监测', '07'],
  ['history', '历史样本', '07'],
  ['cases', '事件工作台', '09'],
  ['owners', '责任登记', '10'],
  ['integration', 'AIRIOT 选做', '+'],
  ['first-read', '首次贯通', '04'],
] as const
const components = {
  devices: DeviceCatalog,
  locations: defineAsyncComponent(() => import('./LocationsView.vue')),
  overview: defineAsyncComponent(() => import('./OverviewView.vue')),
  history: defineAsyncComponent(() => import('./HistoryView.vue')),
  cases: defineAsyncComponent(() => import('./CasesView.vue')),
  owners: defineAsyncComponent(() => import('./OwnersView.vue')),
  integration: defineAsyncComponent(() => import('./IntegrationView.vue')),
  'first-read': defineAsyncComponent(() => import('./FirstDeviceRead.vue')),
}
const store = useCampusStore()
const hash = ref(location.hash)
const page = computed(() => {
  const name = hash.value.slice(1).split('?')[0]
  return name in components ? (name as keyof typeof components) : 'devices'
})
function changed() {
  hash.value = location.hash
}
window.addEventListener('hashchange', changed)
onBeforeUnmount(() => window.removeEventListener('hashchange', changed))
</script>
<template>
  <nav class="workspace-nav" aria-label="校园教学模块">
    <a
      v-for="[key, label, chapter] in pages"
      :key="key"
      :href="`#${key}`"
      :aria-current="page === key ? 'page' : undefined"
      :data-testid="`nav-${key}`"
      ><span>{{ chapter }}</span
      >{{ label }}</a
    >
  </nav>
  <div v-if="store.capabilities?.canRead !== true" class="workspace">
    <p class="notice error" role="alert">当前身份没有校园读取权限。请退出后联系教师核对身份。</p>
  </div>
  <component v-else :is="components[page]" :key="page" />
</template>
