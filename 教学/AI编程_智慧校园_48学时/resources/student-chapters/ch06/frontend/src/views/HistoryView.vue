<script setup lang="ts">
import { computed, onMounted, ref, watch, defineAsyncComponent } from 'vue'
import { useCampusStore } from '../stores/campus'
import { useRequestScope } from '../composables/useRequestScope'
import { getHistory } from '../api/full'
import type { HistoryResult } from '../types/full'
import { timeText } from '../domain/course'
import { ApiError } from '../api/http'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const HistoryChart = defineAsyncComponent(() => import('../components/HistoryChart.vue'))
const store = useCampusStore(),
  scope = useRequestScope()
const deviceId = ref(''),
  tagId = ref(''),
  minutes = ref(60),
  data = ref<HistoryResult | null>(null)
const tags = computed(() => store.devices.find((d) => d.id === deviceId.value)?.tags ?? [])
watch(deviceId, () => {
  tagId.value = tags.value[0]?.id ?? ''
})
async function query() {
  if (!deviceId.value || !tagId.value || store.observedAt === null) return
  const params = new URLSearchParams({
    deviceId: deviceId.value,
    tagId: tagId.value,
    from: String(store.observedAt - minutes.value * 60000),
    to: String(store.observedAt),
  })
  await scope.run(
    (signal) => getHistory(params, signal),
    (value) => {
      data.value = value
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) data.value = null
    },
  )
}
onMounted(async () => {
  await store.refreshDevices()
  if (!scope.active()) return
  deviceId.value = store.devices[0]?.id ?? ''
  tagId.value = tags.value[0]?.id ?? ''
  void query()
})
</script>
<template>
  <section class="workspace full-page" data-testid="history-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">07 / 时间序列</p>
        <h1>历史样本</h1>
        <p class="muted">用真实返回的时间点绘图，保留 null 断点与原始表格。</p>
      </div>
    </header>
    <SourceBanner :time="data?.observedAt ?? store.observedAt" />
    <form class="query-bar" @submit.prevent="query">
      <label
        >设备<select v-model="deviceId" required data-testid="history-device">
          <option v-for="device in store.devices" :value="device.id" :key="device.id">
            {{ device.name }}
          </option>
        </select></label
      ><label
        >采样点<select v-model="tagId" required data-testid="history-tag" aria-label="采样点">
          <option v-for="tag in tags" :value="tag.id" :key="tag.id">
            {{ tag.name }}（{{ tag.unit || '无量纲' }}）
          </option>
        </select></label
      ><label
        >教学时钟之前<select v-model="minutes">
          <option :value="15">15 分钟</option>
          <option :value="60">1 小时</option>
          <option :value="360">6 小时</option>
        </select></label
      ><button class="button primary" :disabled="scope.busy.value || !tagId">查询样本</button>
    </form>
    <p v-if="store.readError" class="notice error" role="alert">{{ store.readError }}</p>
    <ReadStatus :busy="scope.busy.value" :error="scope.error.value" :has-data="!!data" />
    <template v-if="data"
      ><div class="panel chart-panel">
        <div class="section-heading">
          <h2>{{ store.devices.find((d) => d.id === data?.deviceId)?.name }} / {{ data.tagId }}</h2>
          <span>{{ data.samples.length }} 个原始样本 · {{ data.unit || '无量纲' }}</span>
        </div>
        <p class="muted tiny">{{ timeText(data.from) }} 至 {{ timeText(data.to) }}（北京时间）</p>
        <HistoryChart v-if="data.samples.length" :history="data" />
        <div v-else class="empty-state">该时间范围无样本。</div>
        <p class="muted tiny">
          图表按浏览器本地时区显示时间刻度，表格统一为北京时间。缺失值断开，不插值、不补零。
        </p>
        <div v-if="data.truncated" class="notice">本次返回被截断，请缩短时间范围后继续查询。</div>
        <div v-if="data.issues.length" class="notice">
          <p v-for="(issue, i) in data.issues" :key="i">{{ issue.code }} · {{ issue.message }}</p>
        </div>
      </div>
      <div class="ledger">
        <div class="table-scroll">
          <table class="data-table">
            <caption>
              原始样本表 ·
              {{
                data.deviceId
              }}
              /
              {{
                data.tagId
              }}
            </caption>
            <thead>
              <tr>
                <th>采样时间（北京时间）</th>
                <th>原始值</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(sample, i) in data.samples" :key="`${sample.time}/${i}`">
                <td class="time-cell">{{ timeText(sample.time) }}</td>
                <td>{{ sample.value === null ? 'null' : sample.value }} {{ data.unit }}</td>
                <td>{{ sample.value === null ? '缺失：保留断点' : '已返回样本' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div></template
    >
  </section>
</template>
