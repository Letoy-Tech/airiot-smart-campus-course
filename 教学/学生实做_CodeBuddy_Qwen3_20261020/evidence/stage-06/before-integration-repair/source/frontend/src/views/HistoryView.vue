<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import HistoryChart from '../components/HistoryChart.vue'
import { getHistory } from '../api/full'
import { ApiError } from '../api/http'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import { useCampusStore } from '../stores/campus'
import { timeText } from '../domain/course'
import type { HistoryResult } from '../types/full'

const store = useCampusStore()
const { busy, error, run, cancel } = useRequestScope()

const params = new URLSearchParams(location.hash.split('?')[1] ?? '')
const deviceId = ref(params.get('deviceId') ?? '')
const tagId = ref(params.get('tagId') ?? '')
const windowMinutes = ref(60)
const scenario = ref<'normal' | 'empty' | 'failure'>('normal')
const history = ref<HistoryResult | null>(null)
const attemptedAt = ref<number | null>(null)
const denied = ref(false)

const selectedDevice = computed(() => store.devices.find((device) => device.id === deviceId.value) ?? null)
const selectedTag = computed(
  () => selectedDevice.value?.tags.find((tag) => tag.id === tagId.value) ?? null,
)

/** 只使用固定教学采样时刻作窗口终点，不拿浏览器当前时间冒充遥测时间。 */
const range = computed(() => {
  const to = store.observedAt
  const span = windowMinutes.value * 60000
  if (to === null || !Number.isSafeInteger(to) || to < span) return null
  return { from: to - span, to }
})

const contextIssue = computed(() => {
  if (!deviceId.value) return '请选择设备。'
  if (!tagId.value) return '请选择采样点。'
  if (store.observedAt === null) return '尚未取得固定教学采样时刻，无法确定查询窗口。请先读取设备目录。'
  if (!store.devices.length) return ''
  if (!selectedDevice.value) return `设备 ${deviceId.value} 不在本次设备目录，未发起查询。`
  if (!selectedDevice.value.tags.some((tag) => tag.id === tagId.value)) {
    return `采样点 ${tagId.value} 不属于设备 ${deviceId.value}，未发起查询。`
  }
  return ''
})
const canQuery = computed(() => !contextIssue.value && range.value !== null && !busy.value && !denied.value)

const nullCount = computed(() => history.value?.samples.filter((sample) => sample.value === null).length ?? 0)
const zeroCount = computed(() => history.value?.samples.filter((sample) => sample.value === 0).length ?? 0)

function applyDefaults() {
  if (!store.devices.length) return
  if (!deviceId.value) {
    deviceId.value = store.devices.find((device) => device.tags.length > 0)?.id ?? store.devices[0]?.id ?? ''
  }
  const device = store.devices.find((item) => item.id === deviceId.value)
  if (!tagId.value && device) tagId.value = device.tags[0]?.id ?? ''
}

async function query() {
  const window = range.value
  if (!canQuery.value || !window) return
  const requested = {
    deviceId: deviceId.value,
    tagId: tagId.value,
    from: window.from,
    to: window.to,
    scenario: scenario.value,
  }
  attemptedAt.value = Date.now()
  await run(
    async (signal) => {
      const search = new URLSearchParams({
        deviceId: requested.deviceId,
        tagId: requested.tagId,
        from: String(requested.from),
        to: String(requested.to),
      })
      if (requested.scenario !== 'normal') search.set('scenario', requested.scenario)
      const data = await getHistory(search, signal)
      if (
        data.deviceId !== requested.deviceId ||
        data.tagId !== requested.tagId ||
        data.from !== requested.from ||
        data.to !== requested.to
      ) {
        throw new ApiError('响应的设备、点位或时间范围与本次请求不一致，本次结果未采用。')
      }
      return data
    },
    (data) => {
      history.value = data
    },
    (reason) => {
      if (reason instanceof ApiError && reason.status === 403) {
        denied.value = true
        history.value = null
      }
    },
  )
}

applyDefaults()
const poll = useCompletionPolling(query, () => busy.value, 30000)

watch(
  () => [store.devices, store.observedAt] as const,
  () => {
    applyDefaults()
    if (canQuery.value) void poll.refresh()
  },
)

function resetForContextChange() {
  cancel()
  error.value = ''
  history.value = null
  attemptedAt.value = null
  if (canQuery.value) void poll.refresh()
}

function onDeviceChange() {
  tagId.value = selectedDevice.value?.tags[0]?.id ?? ''
  resetForContextChange()
}

function refreshNow() {
  if (canQuery.value) void poll.refresh()
}

async function loadCatalog() {
  if (store.loading) return
  await store.refreshDevices()
  applyDefaults()
  if (canQuery.value) void poll.refresh()
}

onMounted(() => {
  if (!store.devices.length && store.user && store.capabilities?.canRead) void loadCatalog()
})
</script>

<template>
  <section class="workspace full-page" data-testid="history-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第06站 · 历史样本</p>
        <h1>按原采样时间看变化</h1>
        <p class="muted">
          读取固定教学时钟窗口内的原始样本；横轴用样本 time，null 处断线，0 仍是有效零值，两者都不插值。
        </p>
      </div>
      <button type="button" class="button primary" :disabled="busy || !canQuery" @click="refreshNow">
        {{ busy ? '正在读取…' : history ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <SourceBanner :time="store.observedAt" />
    <p class="refresh-note">
      首次进入立即读取一次，此后每次完成后等 30 秒再读；同一查询不重叠，离页或会话变化即停止。
      查询窗口以固定教学采样时刻为终点，不使用浏览器当前时间。
    </p>

    <ReadStatus :busy="busy" :error="error" :has-data="history !== null" />
    <div v-if="denied" class="notice error" role="alert">
      <strong>读取权限已变化</strong>
      <p>历史数据已清除，请重新登录核对当前身份的读取权限。</p>
    </div>

    <form class="query-bar" @submit.prevent="query">
      <label
        >设备<select v-model="deviceId" data-testid="history-device" @change="onDeviceChange">
          <option value="" disabled>请选择设备</option>
          <option v-for="device in store.devices" :key="device.id" :value="device.id">
            {{ device.name }} · {{ device.id }}
          </option>
        </select></label
      >
      <label
        >采样点<select v-model="tagId" data-testid="history-tag" @change="resetForContextChange">
          <option value="" disabled>请选择采样点</option>
          <option v-for="tag in selectedDevice?.tags ?? []" :key="tag.id" :value="tag.id">
            {{ tag.name }}（{{ tag.unit ?? '无量纲' }}）
          </option>
        </select></label
      >
      <label
        >窗口<select v-model.number="windowMinutes" data-testid="history-window" @change="resetForContextChange">
          <option :value="15">15 分钟</option>
          <option :value="60">1 小时</option>
          <option :value="360">6 小时</option>
        </select></label
      >
      <label
        >教学读取情境<select v-model="scenario" data-testid="history-scenario" @change="resetForContextChange">
          <option value="normal">正常样本</option>
          <option value="empty">成功空结果</option>
          <option value="failure">读取失败</option>
        </select></label
      >
      <button class="button primary" type="submit" data-testid="history-query" :disabled="!canQuery">
        {{ busy ? '正在读取…' : '查询历史' }}
      </button>
    </form>

    <div v-if="contextIssue" class="notice warning" role="status">
      <strong>{{ contextIssue }}</strong>
      <p v-if="!store.devices.length">页面不会用第一台设备或第一个点位冒充当前上下文。</p>
      <button
        v-if="!store.devices.length"
        type="button"
        class="button subtle"
        :disabled="store.loading"
        @click="loadCatalog"
      >
        {{ store.loading ? '正在读取设备目录…' : '读取设备目录' }}
      </button>
      <p v-if="store.readError" class="muted">{{ store.readError }}</p>
    </div>

    <div v-if="deviceId || tagId" class="context-grid">
      <div>
        <span>设备</span>
        <strong>{{ selectedDevice?.name ?? '目录中无此设备' }}</strong>
        <code>{{ deviceId || '未选择' }}</code>
        <small v-if="selectedDevice?.spaceName">空间：{{ selectedDevice.spaceName }}</small>
      </div>
      <div>
        <span>采样点</span>
        <strong>{{ selectedTag?.name ?? '目录中无此点位' }}</strong>
        <code>{{ tagId || '未选择' }}</code>
        <small>单位：{{ selectedTag?.unit ?? history?.unit ?? '由响应提供' }}</small>
      </div>
      <div>
        <span>查询窗口</span>
        <strong>{{ windowMinutes }} 分钟 · 固定教学时钟</strong>
        <small v-if="range">{{ timeText(range.from) }} 至 {{ timeText(range.to) }}</small>
        <small v-else>等待固定教学采样时刻</small>
      </div>
    </div>

    <div v-if="!history && !busy && !error && !contextIssue" class="notice" role="status">
      <strong>尚未取得历史样本</strong>
      <p>选择设备、采样点与窗口后点“查询历史”；读取需要已登录会话与读取权限。</p>
    </div>

    <template v-if="history">
      <div class="metric-strip">
        <div>
          <strong class="numeric">{{ history.samples.length }}</strong>
          <span>原始样本 · 不补点</span>
        </div>
        <div>
          <strong class="numeric">{{ nullCount }}</strong>
          <span>null · 折线断开</span>
        </div>
        <div>
          <strong class="numeric">{{ zeroCount }}</strong>
          <span>有效零值 · 仍画 0</span>
        </div>
      </div>

      <p class="history-meta">
        成功查询：{{ timeText(history.queriedAt ?? attemptedAt) }}
        <template v-if="history.queriedAt === undefined">（响应未给 queriedAt，显示本地发起时刻）</template>
        · 固定教学采样时刻：{{ timeText(history.observedAt) }}
        · 样本范围：{{ timeText(history.from) }} 至 {{ timeText(history.to) }}
        · 单位：{{ history.unit }}
      </p>
      <p v-if="error" class="muted tiny">
        本次失败发起：{{ timeText(attemptedAt) }}；下方图表与表格仍是上次成功快照，不是本次查询结果。
      </p>
      <div v-if="history.truncated" class="notice warning" role="status">
        <strong>结果已截断</strong>
        <p>服务端最多返回 1000 个样本；请缩短窗口后重新查询，不把截断结果当成完整区间。</p>
      </div>
      <div v-if="history.issues.length" class="notice warning" role="status">
        <strong>响应附带 {{ history.issues.length }} 条 issues</strong>
        <ul class="issue-list">
          <li v-for="issue in history.issues" :key="`${issue.code}-${issue.scope}-${issue.message}`">
            <code>{{ issue.code }}</code>
            <span>{{ issue.message }}</span>
            <small>{{ issue.scope }}</small>
          </li>
        </ul>
      </div>

      <section v-if="history.samples.length > 0" class="panel chart-panel">
        <div class="section-heading">
          <h2>原始采样折线</h2>
          <span>
            横轴为样本 time，纵轴单位 {{ history.unit }}；null 处断开，0 是有效零值，不插值、不生成未观测样本。
          </span>
        </div>
        <HistoryChart :history="history" />
        <p class="ledger-footnote">
          折线只连相邻的已观测数值；缺失区间保留为断口。功率 kW 与电量 kWh 不在此换算或相加。
        </p>
      </section>

      <section class="panel">
        <div class="section-heading">
          <h2>原始样本表</h2>
          <span>按响应顺序列出原始 time 与 value；null 不显示为 0，0 不显示为缺失。</span>
        </div>

        <div v-if="history.samples.length === 0" class="empty-state" role="status">
          <h3>查询已成功，此范围没有样本</h3>
          <p>这是成功空结果，不是读取失败；页面不补 0、不插值，也不借用其他点位的数据。</p>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table history-samples">
            <caption>时间为服务端原始采样 time（北京时间显示）；查询时刻与采样时刻分开显示。</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">采样时间</th>
                <th scope="col">原始值</th>
                <th scope="col">解释</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(sample, index) in history.samples"
                :key="`${sample.time}-${index}`"
                :class="{ 'is-null': sample.value === null }"
              >
                <td class="numeric">{{ index + 1 }}</td>
                <td class="time-cell">{{ timeText(sample.time) }}</td>
                <td class="numeric sample-value">
                  {{ sample.value === null ? 'null' : `${sample.value} ${history.unit}` }}
                </td>
                <td>
                  <span v-if="sample.value === null" class="state-badge warning">缺失，折线在此断开</span>
                  <span v-else-if="sample.value === 0" class="state-badge">有效零值</span>
                  <span v-else class="muted">原始样本</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          只读页面：没有确认、恢复或关闭上游报警的按钮；原始报警的 status/level 按原文保留在“原始报警”页查看。
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.refresh-note {
  margin: -16px 0 22px;
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.7;
}
.context-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.context-grid > div {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
}
.context-grid span {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
}
.context-grid strong,
.context-grid code,
.context-grid small {
  display: block;
  overflow-wrap: anywhere;
}
.context-grid strong {
  font-size: 0.86rem;
  font-weight: 600;
}
.context-grid code {
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.69rem;
}
.context-grid small {
  margin-top: 7px;
  color: var(--muted);
  font-size: 0.7rem;
  line-height: 1.6;
}
.history-meta {
  margin: -6px 0 18px;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.8;
}
.history-samples tr.is-null td {
  background: oklch(98% 0.014 40);
}
.history-samples .sample-value {
  font-weight: 600;
}
.issue-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.issue-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  padding: 5px 0;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
}
.issue-list li:first-child {
  border-top: 0;
}
.issue-list small {
  color: var(--muted);
  font-size: 0.7rem;
}
@media (max-width: 860px) {
  .context-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 740px) {
  .refresh-note {
    margin-top: -12px;
  }
}
</style>
