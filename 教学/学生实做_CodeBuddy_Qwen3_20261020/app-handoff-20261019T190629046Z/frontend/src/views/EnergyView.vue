<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CompareHistory from '../components/CompareHistory.vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getOverview } from '../api/full'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import { qualityNames, timeText } from '../domain/course'
import { catalogHash } from '../domain/read-models'
import type { Device } from '../types/campus'
import type { Overview, Point } from '../types/full'

interface EnergyEntry {
  point: Point
  device: Device | null
}

interface SpaceGroup {
  id: string
  name: string
  deviceCount: number
  entries: EnergyEntry[]
  attention: number
}

interface MetricOption {
  id: string
  name: string
  unit: string
  deviceCount: number
}

const overview = ref<Overview | null>(null)
const { busy, error, run } = useRequestScope()

async function readOverview() {
  await run(
    (signal) => getOverview(signal),
    (data) => {
      overview.value = data
    },
  )
}

// 首次立即读取；每次完成后 15 秒再读，离页或会话变化停止。
const poll = useCompletionPolling(readOverview, () => busy.value)

function refreshNow() {
  if (!busy.value) void poll.refresh()
}

const hasData = computed(() => overview.value !== null)
const spaces = computed(() => overview.value?.spaces ?? [])
const devices = computed(() => overview.value?.devices ?? [])
const points = computed(() => overview.value?.points ?? [])

const deviceById = computed(() => new Map(devices.value.map((device) => [device.id, device])))

/** 能源页只认 category 为 energy 的设备；环境/设施/照明不进入选项、统计与历史比较。 */
const energyDevices = computed(() => devices.value.filter((device) => device.category === 'energy'))
const energyDeviceIds = computed(() => new Set(energyDevices.value.map((device) => device.id)))

/** 课程能源页只比较功率 kW 与电压 V；按实际声明的单位匹配，不做换算，也不认其他类别同名字段。 */
const ENERGY_METRIC_UNITS: readonly { id: string; unit: string }[] = [
  { id: 'power', unit: 'kW' },
  { id: 'voltage', unit: 'V' },
]

function declaredEnergyTag(device: Device, id: string, unit: string) {
  return device.tags.find((tag) => tag.id === id && (tag.unit ?? '').trim() === unit)
}

/** 可选点位只来自能源设备实际声明的 power/voltage，顺序固定 power 优先；切换只改筛选，不换算也不重新请求。 */
const metricOptions = computed<MetricOption[]>(() => {
  const options = new Map<string, MetricOption>()
  for (const metric of ENERGY_METRIC_UNITS) {
    for (const device of energyDevices.value) {
      const tag = declaredEnergyTag(device, metric.id, metric.unit)
      if (!tag) continue
      const found = options.get(tag.id)
      if (found) found.deviceCount += 1
      else
        options.set(tag.id, {
          id: tag.id,
          name: tag.name,
          unit: tag.unit ?? metric.unit,
          deviceCount: 1,
        })
    }
  }
  return [...options.values()]
})

const metricId = ref('')
const activeMetric = computed(
  () => metricOptions.value.find((item) => item.id === metricId.value) ?? null,
)
const unit = computed(() => activeMetric.value?.unit ?? '')

/** 首次拿到数据或旧点位消失时默认功率，没有功率才取实际存在的电压；都缺则诚实留空。 */
watch(
  metricOptions,
  (list) => {
    if (list.some((item) => item.id === metricId.value)) return
    const preferred = list.find((item) => item.id === 'power') ?? list[0]
    metricId.value = preferred?.id ?? ''
  },
  { immediate: true },
)

/** 点位按 tagId 严格匹配且设备必须是能源设备；同名的 kW 与 V 不混在一张卡片里，其他类别不混入。 */
const unitPoints = computed(() =>
  metricId.value
    ? points.value.filter(
        (point) => point.tagId === metricId.value && energyDeviceIds.value.has(point.deviceId),
      )
    : [],
)
const freshCount = computed(() => unitPoints.value.filter((point) => point.quality === 'fresh').length)
const zeroCount = computed(
  () => unitPoints.value.filter((point) => point.quality === 'fresh' && point.value === 0).length,
)
const missingCount = computed(
  () => unitPoints.value.filter((point) => point.quality === 'missing' || point.value === null).length,
)
const attentionCount = computed(() => unitPoints.value.length - freshCount.value)
/** 对比组件与卡片共用同一个真实 tagId，避免图表与卡片看的不是同一点位。 */
const compareTagId = computed(() => metricId.value)

function buildGroup(id: string, name: string, deviceList: Device[]): SpaceGroup {
  const ids = new Set(deviceList.map((device) => device.id))
  const entries = unitPoints.value
    .filter((point) => ids.has(point.deviceId))
    .map((point) => ({ point, device: deviceById.value.get(point.deviceId) ?? null }))
    .sort(
      (left, right) =>
        (right.point.time ?? -1) - (left.point.time ?? -1) ||
        (left.device?.name ?? left.point.deviceId).localeCompare(
          right.device?.name ?? right.point.deviceId,
          'zh-CN',
        ) ||
        left.point.tagId.localeCompare(right.point.tagId),
    )
  return {
    id,
    name,
    deviceCount: deviceList.length,
    entries,
    attention: entries.filter((entry) => entry.point.quality !== 'fresh').length,
  }
}

/** 空间来自响应本身（四空间照常显示）；待关注空间排前，未关联空间的能源设备单列，不并入任何空间。 */
const spaceGroups = computed(() => {
  const groups = spaces.value.map((space) =>
    buildGroup(
      space.id,
      space.name,
      energyDevices.value.filter((device) => device.spaceId === space.id),
    ),
  )
  const unassigned = energyDevices.value.filter((device) => device.spaceId === null)
  if (unassigned.length > 0) groups.push(buildGroup('', '未关联空间', unassigned))
  groups.sort(
    (left, right) => right.attention - left.attention || left.name.localeCompare(right.name, 'zh-CN'),
  )
  return groups
})

function tagText(point: Point): string {
  const device = deviceById.value.get(point.deviceId)
  return device?.tags.find((tag) => tag.id === point.tagId)?.name ?? point.tagId
}

/** 0 是有效读数，缺失用破折号；两者视觉与文本都分开，不补零。 */
function valueText(point: Point): string {
  return point.value === null ? '—' : String(point.value)
}

function unitText(point: Point): string {
  return point.unit || unit.value
}

function metricText(point: Point): string {
  const text = `${valueText(point)} ${unitText(point)}`
  return text.trim()
}

function deviceIdOf(entry: EnergyEntry): string {
  return entry.device?.id ?? entry.point.deviceId
}

function deviceNameOf(entry: EnergyEntry): string {
  return entry.device?.name ?? '本次目录无此设备'
}
</script>

<template>
  <section class="workspace full-page" data-testid="energy-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第05站 · 能源点位</p>
        <h1>同单位才比较</h1>
        <p class="muted">
          kW 与 V 分开查看；每个空间展示所选单位的最新点位、质量与采样时间，可逐点进入设备。
        </p>
      </div>
      <button type="button" class="button primary" :disabled="busy" @click="refreshNow">
        {{ busy ? '正在读取…' : hasData ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <SourceBanner :time="overview?.observedAt ?? null" />
    <p class="refresh-note">
      首次进入立即读取一次，此后每次完成再等 15 秒；离页或会话变化即停止，忙碌时不叠加请求。
    </p>

    <ReadStatus :busy="busy" :error="error" :has-data="hasData" />

    <div v-if="!hasData && !busy && !error" class="notice" role="status">
      <strong>尚未取得能源点位</strong>
      <p>读取需要已登录会话与读取权限；请先确认身份，再点右上角读取。</p>
    </div>

    <template v-if="overview">
      <div class="notice" role="status">
        <strong>只做同单位比较</strong>
        <p>
          kW 是功率、kWh 是电量。本页不显示 kWh，不从 kW 推算电量，也不跨设备求和；
          只统计 category 为 energy 的设备声明的 power（kW）与 voltage（V）；
          值按点位原样显示，null 为“无值”，0 仍是 0。
        </p>
      </div>

      <div class="energy-toolbar">
        <label class="metric-field" for="energy-metric">
          <span>点位与单位</span>
          <select id="energy-metric" v-model="metricId" data-testid="energy-metric">
            <option v-for="item in metricOptions" :key="item.id" :value="item.id">
              {{ item.name }}（{{ item.unit || '无单位' }}）· {{ item.deviceCount }} 台设备
            </option>
          </select>
        </label>
        <p class="field-help">
          当前只看 {{ activeMetric?.name ?? '未选择点位' }} 的
          {{ unit || '未提供' }} 读数；切换点位不重新请求，也不换算单位。
        </p>
      </div>

      <div v-if="metricOptions.length === 0" class="notice" role="status">
        <strong>本次响应没有可比较的能源点位</strong>
        <p>
          只比较 energy 设备实际声明的 power（kW）与 voltage（V）；没有能源设备或未声明这两个点位时
          保持未知，不混入其他类别，也不补 0 或换算。
        </p>
      </div>

      <div class="metric-strip">
        <div>
          <strong class="numeric">{{ unitPoints.length }}</strong>
          <span>{{ unit || '所选点位' }} 读数 · 本次响应</span>
        </div>
        <div>
          <strong class="numeric">{{ freshCount }}</strong>
          <span>新鲜点位</span>
        </div>
        <div>
          <strong class="numeric">{{ zeroCount }}</strong>
          <span>有效零值 · 不是缺失</span>
        </div>
        <div>
          <strong class="numeric">{{ missingCount }}</strong>
          <span>null 或 missing · 不补 0</span>
        </div>
        <div>
          <strong class="numeric">{{ attentionCount }}</strong>
          <span>陈旧/缺失/无效点位</span>
        </div>
      </div>

      <section class="panel">
        <div class="section-heading">
          <h2>各空间 {{ unit }} 最新值</h2>
          <span>按待关注点位数排序；同一空间多台设备时逐台列出，不合并成一个数。</span>
        </div>

        <div v-if="unitPoints.length === 0" class="empty-state" role="status">
          <h3>本次响应没有 {{ activeMetric?.name ?? '所选点位' }} 的读数</h3>
          <p>
            读取成功但 points 里没有该点位，不是读取失败；换一个点位查看，页面不会补 0 或显示空白值。
          </p>
        </div>

        <div v-else class="space-cards">
          <section
            v-for="group in spaceGroups"
            :key="group.id || 'unassigned'"
            class="panel space-card"
            :data-testid="group.id ? `energy-${group.id}` : undefined"
          >
            <header>
              <div>
                <h2>{{ group.name }}</h2>
                <code v-if="group.id">{{ group.id }}</code>
                <code v-else>设备未关联空间</code>
              </div>
              <span v-if="group.attention > 0" class="state-badge warning">
                待关注 {{ group.attention }}
              </span>
            </header>

            <p v-if="group.entries.length === 0" class="muted energy-empty">
              {{
                group.deviceCount === 0
                  ? '该空间本次没有能源设备。'
                  : `该空间本次没有 ${unit || '所选点位'} 读数；不显示 0，也不补值。`
              }}
            </p>

            <ul v-else class="energy-entries">
              <li v-for="entry in group.entries" :key="`${entry.point.deviceId}-${entry.point.tagId}`">
                <div class="entry-head">
                  <div>
                    <span class="tag-name">{{ tagText(entry.point) }}</span>
                    <code>{{ entry.point.tagId }}</code>
                  </div>
                  <span
                    class="state-badge"
                    :class="{ warning: entry.point.quality !== 'fresh' }"
                  >
                    {{ qualityNames[entry.point.quality] }}
                  </span>
                </div>
                <p class="energy-value numeric">{{ metricText(entry.point) }}</p>
                <strong class="device-name">{{ deviceNameOf(entry) }}</strong>
                <code>{{ deviceIdOf(entry) }}</code>
                <div class="energy-meta">
                  <small>采样 {{ timeText(entry.point.time) }}</small>
                  <a class="button subtle" :href="catalogHash({ deviceId: deviceIdOf(entry) })">
                    查看设备
                  </a>
                </div>
              </li>
            </ul>

            <a
              v-if="group.id"
              class="space-link"
              :href="catalogHash({ spaceId: group.id })"
            >
              在台账查看该空间全部设备
            </a>
          </section>
        </div>

        <p class="ledger-footnote">
          值来自本次 GET /api/campus/overview 中 energy 设备的 points，逐点质量与采样时间原样展示；null 显示“—”，有效零值仍是 0。
          其他类别与目录外设备不并入统计。单位不换算，kW 与 kWh 不混用。
        </p>
      </section>

      <p class="field-help compare-note">
        下方历史比较只查当前点位
        <code>{{ compareTagId || '无' }}</code>（{{ unit || '无单位' }}），候选设备只含本次 overview 中的能源设备；
        设备与观察时刻取自本次响应，各台单独查询，一台失败不影响其他曲线。仅读取，不写入。
      </p>
      <CompareHistory
        :devices="energyDevices"
        :tag-id="compareTagId"
        :unit="unit"
        :observed-at="overview.observedAt"
        title="能源历史逐台比较"
      />
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
.energy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  margin-bottom: 24px;
}
.metric-field {
  min-width: 260px;
}
.energy-toolbar .field-help {
  margin: 0;
}
.compare-note {
  margin: 0 0 14px;
}
.space-card {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.space-card > header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.space-card > header h2 {
  font-size: 1rem;
}
.space-card > header code {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 0.68rem;
  overflow-wrap: anywhere;
}
.energy-empty {
  font-size: 0.78rem;
  margin: 0;
}
.energy-entries {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.energy-entries > li {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.energy-entries > li:first-child {
  border-top: 0;
  padding-top: 0;
}
.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.tag-name {
  font-size: 0.8rem;
  font-weight: 600;
}
.entry-head code {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 0.68rem;
}
.energy-value {
  margin: 6px 0;
  font-size: 1.7rem;
}
.energy-value small {
  font-size: 0.8rem;
  color: var(--muted);
}
.device-name {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
}
.energy-entries > li > code {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 0.68rem;
  overflow-wrap: anywhere;
}
.energy-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 9px;
}
.energy-meta small {
  color: var(--muted);
  font-size: 0.7rem;
}
.energy-meta .button {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 0.75rem;
}
.space-link {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  color: var(--accent);
  font-size: 0.74rem;
  text-decoration: underline;
  text-underline-offset: 4px;
}
@media (max-width: 740px) {
  .refresh-note {
    margin-top: -12px;
  }
  .energy-toolbar {
    align-items: flex-start;
  }
}
</style>
