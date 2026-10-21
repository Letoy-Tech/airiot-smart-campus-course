import { ref, shallowRef, watch } from 'vue'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import { useCompletionPolling, useRequestScope } from './useRequestScope'
import type { ReadPage, ReadScenario } from '../types/read-models'

/** 页码是查询条件；失败时快照仍标明原页码，不冒充当前页。 */
export function useReadPage<T>(read: (limit: number, skip: number, scenario: ReadScenario, signal?: AbortSignal) => Promise<ReadPage<T>>, allowed: () => boolean) {
  const scope = useRequestScope(), store = useCampusStore()
  const data = shallowRef<ReadPage<T> | null>(null), skip = ref(0), limit = ref(5), scenario = ref<ReadScenario>('normal')
  const snapshotSkip = ref(0), snapshotLimit = ref(5), denied = ref(false)
  const clear = () => { data.value = null }
  watch(() => store.sessionEpoch, clear, { flush: 'sync' })
  watch(allowed, value => { if (!value) { scope.cancel(); clear() } })
  function refresh() {
    if (!allowed() || denied.value) return Promise.resolve(false)
    const requestedSkip = skip.value, requestedLimit = limit.value
    return scope.run(signal => read(requestedLimit, requestedSkip, scenario.value, signal), value => {
      data.value = value
      snapshotSkip.value = requestedSkip
      snapshotLimit.value = requestedLimit
    }, error => {
      if (error instanceof ApiError && error.status === 403) { denied.value = true; clear() }
    })
  }
  const poller = useCompletionPolling(refresh, () => scope.busy.value, 30000)
  function filtersChanged() { skip.value = 0; void poller.refresh() }
  function page(delta: number) { skip.value = Math.max(0, skip.value + delta * limit.value); void poller.refresh() }
  return { scope, data, skip, limit, scenario, snapshotSkip, snapshotLimit, denied, refresh: poller.refresh, filtersChanged, page }
}
