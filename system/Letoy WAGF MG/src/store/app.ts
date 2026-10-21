import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isGlobalLoading = ref(false)
  const activeRequests = ref(0)

  const startLoading = () => {
    activeRequests.value++
    isGlobalLoading.value = true
  }

  const stopLoading = () => {
    activeRequests.value = Math.max(0, activeRequests.value - 1)
    if (activeRequests.value === 0) {
      isGlobalLoading.value = false
    }
  }

  return {
    isGlobalLoading,
    startLoading,
    stopLoading
  }
})
