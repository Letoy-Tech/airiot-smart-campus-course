import { defineAsyncComponent, type Component } from 'vue'
export const pages = [["first-read","首次读取","02"],["devices","设备台账","03"],["locations","空间归属","04"],["overview","校园概览","05"],["energy","能源点位","05"],["history","历史样本","06"],["raw-alarms","原始报警","06"],["access","身份与权限","07"]] as const
export const defaultPage = 'devices'
export const components: Record<string, Component> = {
  'first-read': defineAsyncComponent(() => import('../views/FirstDeviceRead.vue')),
  'devices': defineAsyncComponent(() => import('../views/DeviceCatalog.vue')),
  'locations': defineAsyncComponent(() => import('../views/LocationsView.vue')),
  'overview': defineAsyncComponent(() => import('../views/OverviewView.vue')),
  'energy': defineAsyncComponent(() => import('../views/EnergyView.vue')),
  'history': defineAsyncComponent(() => import('../views/HistoryView.vue')),
  'raw-alarms': defineAsyncComponent(() => import('../views/RawAlarmsView.vue')),
  'access': defineAsyncComponent(() => import('../views/AccessView.vue')),
}
