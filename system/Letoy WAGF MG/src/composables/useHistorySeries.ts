import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { getHistory } from '@/api/campus'
import type { Device, HistoryResult } from '@/types/campus'

export interface HistorySeries { device: Device; result: HistoryResult; retained?: boolean }
export function useHistorySeries(devices: Ref<Device[]>, tagId: Ref<string>, hours: Ref<number>) {
  const entries = shallowRef<HistorySeries[]>([])
  const failures = ref<string[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastSuccess = ref<number | null>(null)
  const sources = computed(() => devices.value.filter((d, i, list) => d.tags.some(t => t.id === tagId.value) && list.findIndex(item => item.id === d.id) === i).slice(0, 4))
  const scope = computed(() => JSON.stringify([tagId.value, hours.value, sources.value.map(d => d.id)]))
  let generation = 0
  let active = true
  let pendingScope = ''
  let controller: AbortController | undefined
  const load = async () => {
    const selectedScope = scope.value
    if (!active || (loading.value && pendingScope === selectedScope)) return
    const selectedDevices = [...sources.value]
    const tag = tagId.value
    const to = Date.now()
    const from = to - hours.value * 3600000
    const request = ++generation
    controller?.abort()
    controller = new AbortController()
    pendingScope = selectedScope
    if (!selectedDevices.length) { entries.value = []; failures.value = []; error.value = ''; loading.value = false; return }
    loading.value = true
    const outcomes = await Promise.allSettled(selectedDevices.map(device => getHistory(device.id, tag, from, to, controller?.signal)))
    if (!active || generation !== request || scope.value !== selectedScope) return
    const next: HistorySeries[] = []
    const failed: string[] = []
    outcomes.forEach((outcome, i) => {
      const device = selectedDevices[i]!
      if (outcome.status === 'fulfilled') next.push({ device, result: outcome.value })
      else failed.push(`${device.name}：${outcome.reason instanceof Error ? outcome.reason.message : '历史读取失败'}`)
    })
    failures.value = failed
    if (next.length) {
      const previous = entries.value
      entries.value = selectedDevices.flatMap(device => {
        const fresh = next.find(entry => entry.device.id === device.id)
        const old = previous.find(entry => entry.device.id === device.id)
        return fresh ? [fresh] : old ? [{...old,device,retained:true}] : []
      })
      lastSuccess.value = Date.now(); error.value = ''
    } else { entries.value = entries.value.map(entry => ({...entry,retained:true})); error.value = '历史读取失败，请重试。' }
    loading.value = false
  }
  watch(scope, () => { entries.value = []; failures.value = []; error.value = ''; lastSuccess.value = null; void load() }, { immediate: true })
  watch(() => JSON.stringify(devices.value.map(device => [device.id,device.name,device.spaceId,device.spaceName])), () => {
    entries.value = entries.value.map(entry => ({...entry,device:devices.value.find(device => device.id === entry.device.id) ?? entry.device}))
  })
  onScopeDispose(() => { active = false; generation++; controller?.abort() })
  return { entries, sources, failures, loading, error, lastSuccess, load }
}
