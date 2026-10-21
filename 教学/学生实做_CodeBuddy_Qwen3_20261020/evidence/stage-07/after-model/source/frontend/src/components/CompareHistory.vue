<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue'
import { getHistory } from '../api/full'
import { ApiError, safeError } from '../api/http'
import { useRequestScope } from '../composables/useRequestScope'
import { useCampusStore } from '../stores/campus'
import { timeText } from '../domain/course'
import type { Device } from '../types/campus'
import type { HistoryResult } from '../types/full'
const HistoryChart = defineAsyncComponent(() => import('./HistoryChart.vue'))
const props = defineProps<{ devices: Device[]; tagId: string; unit: string; observedAt: number; title?: string }>()
const scope = useRequestScope(), store = useCampusStore()
const selected = ref<string[]>([]), minutes = ref(60), failureDevice = ref('')
const attemptedAt = ref<number | null>(null), denied = ref(false)
type Snapshot = { history: HistoryResult; queriedAt: number }
const snapshots = reactive<Record<string, Snapshot>>({}), errors = reactive<Record<string, string>>({})
const candidates = computed(() => props.devices.filter(d => d.tags.some(t => t.id === props.tagId && t.unit === props.unit)))
const key = (id: string) => `${id}/${props.tagId}`
const rows = computed(() => candidates.value.filter(d => selected.value.includes(d.id)).map(device => ({
  device, snapshot: snapshots[key(device.id)], error: errors[key(device.id)] ?? '',
})))
const charts = computed(() => rows.value.filter(r => r.snapshot).map(r => ({
  name: `${r.device.name}${r.error ? '（旧快照）' : ''}`, history: r.snapshot!.history,
})))
function clearData() {
  for (const key of Object.keys(snapshots)) delete snapshots[key]
  for (const key of Object.keys(errors)) delete errors[key]
}
watch(() => store.sessionEpoch, clearData, { flush: 'sync' })
watch(() => [props.tagId, props.unit, candidates.value.map(d => d.id).join('|')], () => {
  scope.cancel()
  selected.value = candidates.value.map(d => d.id)
  failureDevice.value = ''
  attemptedAt.value = null
}, { immediate: true })
function selectionChanged() { scope.cancel(); attemptedAt.value = null }
async function query() {
  if (scope.busy.value || !selected.value.length || denied.value) return
  const tag = props.tagId, unit = props.unit, to = props.observedAt, from = to - minutes.value * 60000
  const devices = candidates.value.filter(d => selected.value.includes(d.id))
  const startedAt = Date.now()
  attemptedAt.value = startedAt
  await scope.run(async signal => Promise.all(devices.map(async device => {
    const query = new URLSearchParams({ deviceId: device.id, tagId: tag, from: String(from), to: String(to) })
    if (failureDevice.value === device.id) query.set('scenario', 'failure')
    try {
      const history = await getHistory(query, signal)
      if (history.deviceId !== device.id || history.tagId !== tag || history.unit !== unit || history.from !== from || history.to !== to)
        throw new ApiError('响应点位、单位或时间范围不匹配，本次结果未采用。')
      return { id: device.id, history, error: '' }
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) throw error
      return { id: device.id, history: null, error: safeError(error) }
    }
  })), values => {
    for (const value of values) {
      const id = `${value.id}/${tag}`
      errors[id] = value.error
      if (value.history) snapshots[id] = { history: value.history, queriedAt: value.history.queriedAt ?? startedAt }
    }
  }, error => {
    if (error instanceof ApiError && error.status === 403) { denied.value = true; clearData() }
  })
}
</script>
<template>
  <section class="panel" data-testid="compare-history">
    <h2>{{ title ?? '同单位历史比较' }} · {{ unit }}</h2>
    <p class="muted tiny">只比较 {{ unit }}；null 断开，0 仍是有效样本。下方保留各设备最近成功快照；修改条件后点击“比较历史”，并核对每台的查询范围。</p>
    <div class="compare-choices">
      <label v-for="device in candidates" :key="device.id"><input type="checkbox" v-model="selected" :value="device.id" @change="selectionChanged" /> {{ device.name }}</label>
    </div>
    <form class="query-bar" @submit.prevent="query">
      <label>教学时钟之前<select v-model="minutes" @change="selectionChanged"><option :value="15">15 分钟</option><option :value="60">1 小时</option><option :value="360">6 小时</option></select></label>
      <label>模拟读取失败<select v-model="failureDevice" data-testid="compare-failure-device"><option value="">全部正常读取</option><option v-for="device in candidates" :key="device.id" :value="device.id">仅 {{ device.name }} 失败</option></select></label>
      <button class="button primary" :disabled="scope.busy.value || !selected.length || denied" data-testid="compare-query">{{ scope.busy.value ? '正在逐台读取…' : '比较历史' }}</button>
    </form>
    <p v-if="!candidates.length" class="empty-state">当前没有这个单位的可比较点位。</p>
    <p v-if="scope.error.value" class="notice error" role="alert">{{ scope.error.value }}</p>
    <p v-if="denied" class="notice error">读取权限已变化，比较数据已清除。请重新登录。</p>
    <p v-if="attemptedAt" class="muted tiny">本次尝试：{{ timeText(attemptedAt) }}。每台下方单独显示其成功查询时刻与范围。</p>
    <HistoryChart v-if="charts.length" :history="charts[0]!.history" :comparisons="charts" />
    <article v-for="row in rows" :key="row.device.id" class="comparison-result" :data-testid="`compare-${row.device.id}`">
      <h3>{{ row.device.name }}</h3>
      <p v-if="row.error" class="notice warning" role="alert">{{ row.error }} {{ row.snapshot ? '保留上次成功快照，不能视为本次查询成功。' : '尚无成功快照。' }}</p>
      <template v-if="row.snapshot">
        <p class="muted tiny">成功查询：{{ timeText(row.snapshot.queriedAt) }}；样本范围：{{ timeText(row.snapshot.history.from) }} 至 {{ timeText(row.snapshot.history.to) }}；{{ row.snapshot.history.samples.length }} 个样本。</p>
        <p v-if="row.snapshot.history.truncated" class="notice warning">结果截断，请缩短范围再查询。</p>
        <p v-for="(issue, i) in row.snapshot.history.issues" :key="i" class="notice warning">{{ issue.code }} · {{ issue.message }}</p>
        <p v-if="!row.snapshot.history.samples.length" class="empty-state">该设备在此范围无样本；查询已成功。</p>
        <details><summary>原始样本表</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>采样时间（北京时间）</th><th>原始值 · {{ unit }}</th></tr></thead><tbody><tr v-for="(sample, i) in row.snapshot.history.samples" :key="i"><td>{{ timeText(sample.time) }}</td><td>{{ sample.value === null ? 'null（缺失）' : sample.value }}</td></tr></tbody></table></div></details>
      </template>
      <p v-else-if="!row.error" class="muted tiny">尚未查询。选择范围后点“比较历史”。</p>
    </article>
  </section>
</template>
