import { defineAsyncComponent, type Component } from 'vue'
export const pages = [["first-read","首次读取","02"]] as const
export const defaultPage = 'first-read'
export const components: Record<string, Component> = {
  'first-read': defineAsyncComponent(() => import('../views/FirstDeviceRead.vue')),
}
