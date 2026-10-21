import { onScopeDispose, ref, watch } from 'vue'
import { useCampusStore } from '../stores/campus'
import { ApiError, safeError } from '../api/http'

/** 每个资源一个序号；会话变化、页面卸载和新请求都使旧回调失效。 */
export function useRequestScope() {
  const store = useCampusStore()
  const busy = ref(false)
  const error = ref('')
  const initialEpoch = store.sessionEpoch
  let alive = true
  let sequence = 0
  let controller: AbortController | null = null
  const cancel = () => {
    sequence++
    controller?.abort()
    controller = null
    busy.value = false
  }
  const stop = watch(() => store.sessionEpoch, cancel, { flush: 'sync' })
  onScopeDispose(() => {
    alive = false
    cancel()
    stop()
  })
  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
    failed?: (error: unknown) => void,
  ): Promise<boolean> {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const epoch = store.sessionEpoch
    const uid = store.user?.uid
    const requestSeq = ++sequence
    const current = () =>
      alive &&
      !signal.aborted &&
      store.sessionEpoch === epoch &&
      store.user?.uid === uid &&
      sequence === requestSeq
    if (!uid) return false
    busy.value = true
    error.value = ''
    try {
      const result = await task(signal)
      if (!current()) return false
      commit(result)
      return true
    } catch (reason) {
      if (!current()) return false
      if (reason instanceof ApiError && reason.status === 401) store.expireSession()
      else {
        error.value = safeError(reason)
        failed?.(reason)
      }
      return false
    } finally {
      if (current()) busy.value = false
    }
  }
  return {
    busy,
    error,
    run,
    cancel,
    active: () => alive && !!store.user && store.sessionEpoch === initialEpoch,
  }
}
/** 首次立即读取；每次完成后 15 秒再读。卸载或身份变化停止，不叠加请求。 */
export function useCompletionPolling(
  refresh: () => Promise<unknown>,
  isBusy: () => boolean,
  delay = 15000,
) {
  const store = useCampusStore()
  const epoch = store.sessionEpoch
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  async function cycle() {
    if (stopped || store.sessionEpoch !== epoch || isBusy()) return
    clearTimeout(timer)
    await refresh()
    if (!stopped && store.sessionEpoch === epoch) timer = setTimeout(cycle, delay)
  }
  function stop() {
    stopped = true
    clearTimeout(timer)
  }
  onScopeDispose(stop)
  void cycle()
  return { stop, refresh: cycle }
}
