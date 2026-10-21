import { defineAsyncComponent, type Component } from 'vue'
export const pages = [["first-read","首次读取","02"],["devices","设备台账","03"]] as const
export const defaultPage = 'devices'
export const components: Record<string, Component> = {
  'first-read': defineAsyncComponent(() => import('../views/FirstDeviceRead.vue')),
  'devices': defineAsyncComponent(() => import('../views/DeviceCatalog.vue')),
}
