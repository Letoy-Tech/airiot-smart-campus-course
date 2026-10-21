import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
export function useResource<T>(fetcher: () => Promise<T>, interval = 0, immediate = true) {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  const lastSuccess = ref<number | null>(null)
  const nextRefreshAt = ref<number | null>(null)
  let active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const load = async () => {
    if (loading.value || !active) return
    loading.value = true
    try { const result = await fetcher(); if (active) { data.value = result; lastSuccess.value = Date.now(); error.value = '' } }
    catch (e) { if (active) error.value = e instanceof Error ? e.message : '读取失败，请稍后重试' }
    finally { if (active) loading.value = false }
  }
  const poll = async () => { await load(); if (active && interval > 0) { nextRefreshAt.value = Date.now() + interval; timer = setTimeout(poll, interval) } }
  onMounted(() => { if (immediate) void poll() })
  onUnmounted(() => { active = false; clearTimeout(timer) })
  return { data, loading, error, lastSuccess, nextRefreshAt, load }
}
