<script setup lang="ts">
import { computed, ref } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getOverview } from '../api/full'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import { qualityNames, timeText } from '../domain/course'
import { catalogHash } from '../domain/read-models'
import type { Device } from '../types/campus'
import type { Overview, Point } from '../types/full'

type EnergyUnit = 'kW' | 'V'

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

const units: { id: EnergyUnit; name: string; hint: string }[] = [
  { id: 'kW', name: 'kW', hint: '功率，不是电量' },
  { id: 'V', name: 'V', hint: '电压，只与 V 比较' },
]
const unit = ref<EnergyUnit>('kW')

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

/** 单位由点位自身 unit 严格匹配；切换单位不换算旧值，也不重新请求。 */
const unitPoints = computed(() => points.value.filter((point) => point.unit === unit.value))
const freshCount = computed(() => unitPoints.value.filter((point) => point.quality === 'fresh').length)
const attentionCount = computed(() => unitPoints.value.length - freshCount.value)
const orphanPoints = computed(() =>
  unitPoints.value.filter((point) => !deviceById.value.has(point.deviceId)),
)

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

/** 空间来自响应本身；待关注空间排前，未关联设备单列，不并入任何空间。 */
const spaceGroups = computed(() => {
  const groups = spaces.value.map((space) =>
    buildGroup(
      space.id,
      space.name,
      devices.value.filter((device) => device.spaceId === space.id),
    ),
  )
  const unassigned = devices.value.filter((device) => device.spaceId === null)
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

function valueText(point: Point): string {
  return point.value === null ? '无值' : String(point.value)
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
          值按点位原样显示，null 为“无值”，0 仍是 0。
        </p>
      </div>

      <div class="energy-toolbar">
        <div class="unit-switch" role="group" aria-label="能源单位切换">
          <button
            v-for="item in units"
            :key="item.id"
            type="button"
            class="button subtle"
            :aria-pressed="unit === item.id"
            @click="unit = item.id"
          >
            {{ item.name }}
          </button>
        </div>
        <p class="field-help">
          当前只看 {{ unit }}（{{ units.find((item) => item.id === unit)?.hint }}）；切换单位不重新请求，也不换算。
        </p>
      </div>

      <div class="metric-strip">
        <div>
          <strong class="numeric">{{ unitPoints.length }}</strong>
          <span>{{ unit }} 点位 · 本次响应</span>
        </div>
        <div>
          <strong class="numeric">{{ freshCount }}</strong>
          <span>新鲜点位</span>
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
          <h3>本次响应没有 {{ unit }} 点位</h3>
          <p>
            读取成功但 points 里没有该单位，不是读取失败；切到另一个单位查看，页面不会补 0 或显示空白值。
          </p>
        </div>

        <div v-else class="space-cards">
          <article v-for="group in spaceGroups" :key="group.id || 'unassigned'" class="panel space-card">
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
                  ? '该空间本次没有设备。'
                  : `该空间本次没有 ${unit} 点位；不显示 0，也不补值。`
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
                <p class="energy-value numeric">
                  {{ valueText(entry.point) }} <small>{{ entry.point.unit }}</small>
                </p>
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
          </article>
        </div>

        <p class="ledger-footnote">
          值来自本次 GET /api/campus/overview 的 points，逐点质量与采样时间原样展示；null 显示“无值”，0 保留为 0。
          <template v-if="orphanPoints.length > 0">
            另有 {{ orphanPoints.length }} 个 {{ unit }} 点位的 deviceId 不在本次设备目录，未归入空间卡片。
          </template>
          单位不换算，kW 与 kWh 不混用。
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
.energy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  margin-bottom: 24px;
}
.unit-switch {
  display: flex;
  gap: 6px;
}
.unit-switch .button {
  min-width: 72px;
}
.energy-toolbar .field-help {
  margin: 0;
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
