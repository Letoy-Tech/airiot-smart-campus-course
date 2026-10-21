import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCapabilities } from '@/api/campus'
import type { CampusCapabilities } from '@/types/campus'
export const useCampusStore = defineStore('campus', () => {
  const capabilities = ref<CampusCapabilities | null>(null)
  const error = ref('')
  let pending: Promise<void> | null = null
  const ensureCapabilities = (force = false) => {
    if (pending) return pending
    if (capabilities.value && !force) return Promise.resolve()
    pending = getCapabilities().then(value => {
      capabilities.value = {
        roles: Array.isArray(value.roles) ? value.roles.filter(role => typeof role === 'string') : [],
        canRead: value.canRead === true,
        canControl: value.canControl === true,
        canAdmin: value.canAdmin === true,
        canAudit: value.canAudit === true,
        canHandleAlarms: value.canHandleAlarms === true,
        canAssignAlarms: value.canAssignAlarms === true,
        canRunDemoScenarios: value.canRunDemoScenarios === true,
      }
      error.value = ''
    }).catch(e => { capabilities.value = null; error.value = e instanceof Error ? e.message : '权限读取失败'; throw e }).finally(() => { pending = null })
    return pending
  }
  const reset = () => { capabilities.value = null; error.value = '' }
  return { capabilities, error, ensureCapabilities, reset }
})
