<script setup lang="ts">
import { computed, ref } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getOverview } from '../api/full'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import { categoryNames, qualityNames, timeText } from '../domain/course'
import { catalogHash, qualityMatrix } from '../domain/read-models'
import type { Device } from '../types/campus'
import type { Overview, Point } from '../types/full'

interface QualityRow {
  id: string
  name: string
  devices: number
  points: number
  fresh: number
  stale: number
  missing: number
  invalid: number
  attention: number
  drill: string | null
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
const issues = computed(() => overview.value?.issues ?? [])

/** 覆盖数直接读服务端 completeness，不用本地数组长度冒充预期值。 */
const coverage = computed(() => {
  const value = overview.value?.completeness
  if (!value) return []
  return [
    { key: 'spaces', name: '空间', actual: value.actualSpaces, expected: value.expectedSpaces },
    { key: 'devices', name: '设备', actual: value.actualDevices, expected: value.expectedDevices },
    { key: 'points', name: '点位', actual: value.actualPoints, expected: value.expectedPoints },
  ]
})

function gapText(actual: number, expected: number): string {
  if (actual === expected) return '与预期一致'
  return actual < expected ? `比预期少 ${expected - actual}` : `比预期多 ${actual - expected}`
}

const qualityTotals = computed(() => {
  const count = (quality: Point['quality']) =>
    points.value.filter((point) => point.quality === quality).length
  return {
    fresh: count('fresh'),
    stale: count('stale'),
    missing: count('missing'),
    invalid: count('invalid'),
  }
})
const attentionTotal = computed(
  () => qualityTotals.value.stale + qualityTotals.value.missing + qualityTotals.value.invalid,
)

function summarize(id: string, name: string, deviceList: Device[], pointList: Point[]): QualityRow {
  const count = (quality: Point['quality']) =>
    pointList.filter((point) => point.quality === quality).length
  const stale = count('stale')
  const missing = count('missing')
  const invalid = count('invalid')
  return {
    id,
    name,
    devices: deviceList.length,
    points: pointList.length,
    fresh: count('fresh'),
    stale,
    missing,
    invalid,
    attention: stale + missing + invalid,
    drill: id ? catalogHash({ spaceId: id }) : null,
  }
}

const deviceById = computed(() => new Map(devices.value.map((device) => [device.id, device])))
const knownDeviceIds = computed(() => new Set(deviceById.value.keys()))

const unassignedDevices = computed(() => devices.value.filter((device) => device.spaceId === null))
const unassignedPoints = computed(() => {
  const ids = new Set(unassignedDevices.value.map((device) => device.id))
  return points.value.filter((point) => ids.has(point.deviceId))
})
const unassignedRow = computed(() =>
  unassignedDevices.value.length === 0
    ? null
    : summarize('', '未关联空间', unassignedDevices.value, unassignedPoints.value),
)

/** 空间矩阵按待关注点位降序，异常分组排在最前面；未关联设备单列，不并入任何空间。 */
const spaceRows = computed(() => {
  const rows: QualityRow[] = qualityMatrix(spaces.value, devices.value, points.value).map(
    ({ space, devices: deviceCount, points: pointCount, fresh, stale, missing, invalid }) => ({
      id: space.id,
      name: space.name,
      devices: deviceCount,
      points: pointCount,
      fresh,
      stale,
      missing,
      invalid,
      attention: stale + missing + invalid,
      drill: catalogHash({ spaceId: space.id }),
    }),
  )
  rows.sort((left, right) => right.attention - left.attention || left.name.localeCompare(right.name, 'zh-CN'))
  const unassigned = unassignedRow.value
  if (unassigned) rows.push(unassigned)
  return rows
})
const attentionRows = computed(() => spaceRows.value.filter((row) => row.attention > 0))

/** deviceId 不在本次设备目录的点位单独提示，不强行算进某个空间。 */
const orphanPoints = computed(() => points.value.filter((point) => !knownDeviceIds.value.has(point.deviceId)))

const categoryRows = computed(() =>
  Object.entries(categoryNames).map(([id, name]) => {
    const list = devices.value.filter((device) => device.category === id)
    return {
      id,
      name,
      total: list.length,
      online: list.filter((device) => device.online === true).length,
      offline: list.filter((device) => device.online === false).length,
      unknown: list.filter((device) => device.online === null).length,
      drill: catalogHash({ category: id }),
    }
  }),
)

const qualityOrder: Record<Point['quality'], number> = {
  missing: 0,
  invalid: 1,
  stale: 2,
  fresh: 3,
}
const abnormalPoints = computed(() =>
  points.value
    .filter((point) => point.quality !== 'fresh')
    .sort(
      (left, right) =>
        qualityOrder[left.quality] - qualityOrder[right.quality] ||
        left.deviceId.localeCompare(right.deviceId) ||
        left.tagId.localeCompare(right.tagId),
    ),
)

function deviceName(deviceId: string): string {
  return deviceById.value.get(deviceId)?.name ?? '本次目录无此设备'
}

function valueText(point: Point): string {
  return point.value === null ? '无值' : String(point.value)
}
</script>

<template>
  <section class="workspace full-page" data-testid="overview-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第05站 · 校园概览</p>
        <h1>一眼找到异常的空间</h1>
        <p class="muted">
          覆盖数、空间/类型统计与质量矩阵取自同一次 GET /api/campus/overview；按待关注点位数排序后可直达设备台账。
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
      <strong>尚未取得校园概览</strong>
      <p>读取需要已登录会话与读取权限；请先确认身份，再点右上角读取。</p>
    </div>

    <template v-if="overview">
      <div class="metric-strip">
        <div v-for="row in coverage" :key="row.key">
          <strong class="numeric">{{ row.actual }} / {{ row.expected }}</strong>
          <span>{{ row.name }}（实际 / 预期）· {{ gapText(row.actual, row.expected) }}</span>
        </div>
        <div>
          <strong class="numeric">{{ attentionTotal }}</strong>
          <span>陈旧/缺失/无效点位 · 共 {{ points.length }} 个点位</span>
        </div>
      </div>

      <div v-if="attentionRows.length > 0" class="notice warning" role="status">
        <strong>{{ attentionRows.length }} 个空间分组存在陈旧、缺失或无效点位</strong>
        <p>{{ attentionRows.map((row) => row.name).join('、') }}；矩阵已把这些分组排在前面。</p>
      </div>
      <div v-else-if="spaceRows.length > 0" class="notice" role="status">
        <strong>本次响应没有非新鲜点位</strong>
        <p>所有点位 quality 均为 fresh；这不代表设备真实在线，观察时刻见上方固定教学采样时刻。</p>
      </div>

      <div v-if="issues.length > 0" class="notice" role="status">
        <strong>响应附带 {{ issues.length }} 条 issues</strong>
        <ul class="issue-list">
          <li v-for="issue in issues" :key="`${issue.code}-${issue.scope}-${issue.message}`">
            <code>{{ issue.code }}</code>
            <span>{{ issue.message }}</span>
            <small>{{ issue.scope }}</small>
          </li>
        </ul>
      </div>

      <section class="panel">
        <div class="section-heading">
          <h2>空间质量矩阵</h2>
          <span>fresh / stale / missing / invalid 分别计数，0 也显示为 0，不并入其他状态。</span>
        </div>
        <div v-if="spaceRows.length === 0" class="empty-state" role="status">
          <h3>响应里没有空间</h3>
          <p>读取成功但 spaces 为空，不是读取失败；可到“空间归属”核对来源空间。</p>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table quality-matrix" data-testid="quality-matrix">
            <caption>
              按待关注点位数从多到少排序；设备数、点位数来自本次响应，不用点位反推设备。
            </caption>
            <thead>
              <tr>
                <th scope="col">空间</th>
                <th scope="col">设备</th>
                <th scope="col">点位</th>
                <th scope="col">新鲜</th>
                <th scope="col">陈旧</th>
                <th scope="col">缺失</th>
                <th scope="col">无效</th>
                <th scope="col">台账钻取</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in spaceRows"
                :key="row.id || 'unassigned'"
                :class="{ 'is-attention': row.attention > 0 }"
              >
                <td>
                  <strong>{{ row.name }}</strong>
                  <code v-if="row.id">{{ row.id }}</code>
                  <span v-if="row.attention > 0" class="state-badge warning">待关注 {{ row.attention }}</span>
                </td>
                <td class="numeric">{{ row.devices }}</td>
                <td class="numeric">{{ row.points }}</td>
                <td class="numeric">{{ row.fresh }}</td>
                <td class="numeric" :class="{ 'count-bad': row.stale > 0 }">{{ row.stale }}</td>
                <td class="numeric" :class="{ 'count-bad': row.missing > 0 }">{{ row.missing }}</td>
                <td class="numeric" :class="{ 'count-bad': row.invalid > 0 }">{{ row.invalid }}</td>
                <td>
                  <a v-if="row.drill" class="button subtle" :href="row.drill">在台账查看</a>
                  <span v-else class="muted">无空间筛选，按设备 ID 查找</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          missing 表示服务端没有给值，不能用 0 代替；null 值在下方点位表显示“无值”。
          <template v-if="unassignedDevices.length > 0">
            未关联空间：{{ unassignedDevices.length }} 台设备已单列，不并入任何空间。
          </template>
          <template v-if="orphanPoints.length > 0">
            另有 {{ orphanPoints.length }} 个点位的 deviceId 不在本次设备目录，未计入空间矩阵。
          </template>
        </p>
      </section>

      <section class="panel">
        <div class="section-heading">
          <h2>类型统计</h2>
          <span>设备类型与在线三态来自同一响应；未知单列，不并进离线。</span>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <caption>四类设备都列出，0 台保留为 0；台账只带类型条件，不附加空间或关键词。</caption>
            <thead>
              <tr>
                <th scope="col">类型</th>
                <th scope="col">设备</th>
                <th scope="col">在线</th>
                <th scope="col">离线</th>
                <th scope="col">未知</th>
                <th scope="col">台账</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in categoryRows" :key="row.id">
                <td>
                  <strong>{{ row.name }}</strong>
                  <code>{{ row.id }}</code>
                </td>
                <td class="numeric">{{ row.total }}</td>
                <td class="numeric">{{ row.online }}</td>
                <td class="numeric">{{ row.offline }}</td>
                <td class="numeric">{{ row.unknown }}</td>
                <td><a class="button subtle" :href="row.drill">在台账查看</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          online=null 计为“未知”，不与 false 合并；各类型设备数之和等于本次响应的
          {{ devices.length }} 台设备。
        </p>
      </section>

      <section class="panel">
        <div class="section-heading">
          <h2>异常点位与设备入口</h2>
          <span>只列非 fresh 点位；值按原样显示，null 为“无值”，0 仍是 0，单位不换算。</span>
        </div>
        <div v-if="abnormalPoints.length === 0" class="empty-state" role="status">
          <h3>没有非新鲜点位</h3>
          <p>服务端本次响应全部为 quality=fresh；缺失会以 missing 出现，不会补成 0。</p>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table">
            <caption>
              点“查看原设备”按 deviceId 进入台账详情；设备不在目录时会明确提示，不会用其他设备顶替。
            </caption>
            <thead>
              <tr>
                <th scope="col">点位</th>
                <th scope="col">设备</th>
                <th scope="col">质量</th>
                <th scope="col">值</th>
                <th scope="col">采样时间</th>
                <th scope="col">原设备</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in abnormalPoints" :key="`${point.deviceId}-${point.tableId}-${point.tagId}`">
                <td>
                  <strong>{{ point.tagId }}</strong>
                  <code>{{ point.tableId }}</code>
                </td>
                <td>
                  <strong>{{ deviceName(point.deviceId) }}</strong>
                  <code>{{ point.deviceId }}</code>
                </td>
                <td>
                  <span class="state-badge warning">{{ qualityNames[point.quality] }}</span>
                </td>
                <td>
                  <span class="numeric">{{ valueText(point) }}</span>
                  <small>{{ point.unit || '单位未提供' }}</small>
                </td>
                <td class="time-cell">{{ timeText(point.time) }}</td>
                <td>
                  <a class="button subtle" :href="catalogHash({ deviceId: point.deviceId })">查看原设备</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          值列不做单位换算：kW 是功率、kWh 是电量，本页不把两者相加或互相推算。
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
.quality-matrix tr.is-attention td {
  background: oklch(98% 0.014 40);
}
.quality-matrix .count-bad {
  color: var(--offline);
  font-weight: 650;
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
@media (max-width: 740px) {
  .refresh-note {
    margin-top: -12px;
  }
}
</style>
