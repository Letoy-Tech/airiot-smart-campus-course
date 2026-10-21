<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsCoreOption } from 'echarts/core'
import { getOverview } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import type { DeviceCategory, Point, PointQuality } from '@/types/campus'
import { categoryLabels, onlineLabel, pointLabel, qualityLabels, timeLabel } from '@/utils/campus'
import { alpha, axisStyle, gradient, vizTheme } from '@/utils/vizTheme'
import CampusChart from '@/components/campus/CampusChart.vue'
import MetricTrend from '@/components/campus/MetricTrend.vue'
import PointValue from '@/components/campus/PointValue.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
import CountUp from '@/components/viz/CountUp.vue'
import SegmentTabs from '@/components/viz/SegmentTabs.vue'

defineOptions({ name: 'CampusOverview' })

const router = useRouter()
const { data, loading, error, lastSuccess, nextRefreshAt, load } = useResource(getOverview, 15000)
const categoryIds: DeviceCategory[] = ['environment', 'energy', 'facility', 'lighting']
const categoryIcons: Record<DeviceCategory, string> = { environment: 'ri-leaf-line', energy: 'ri-flashlight-line', facility: 'ri-building-2-line', lighting: 'ri-lightbulb-line' }
const categories = computed(() => categoryIds.map(id => ({ id, label: categoryLabels[id], color: vizTheme.value.category[id], glow: vizTheme.value.categoryGlow[id], icon: categoryIcons[id] })))
const qualityOrder: PointQuality[] = ['fresh', 'stale', 'missing', 'invalid']
const qualities = computed(() =>
  qualityOrder.map(id => ({ id, label: qualityLabels[id], color: vizTheme.value.quality[id], count: data.value?.points.filter(point => point.quality === id).length ?? 0 })),
)
const effectiveCount = computed(() => qualities.value.find(quality => quality.id === 'fresh')?.count ?? 0)
const effectiveRatio = computed(() => (data.value?.points.length ? effectiveCount.value / data.value.points.length : null))
const qualityLabel = computed(() => qualities.value.map(quality => `${quality.label}${quality.count}个`).join('，'))
const qualityOption = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}：{c} 个（{d}%）' },
  series: [{
    type: 'pie', name: '采集质量', radius: ['70%', '88%'], center: ['50%', '50%'], padAngle: 3, startAngle: 90,
    label: { show: false }, labelLine: { show: false },
    itemStyle: { borderRadius: 8 },
    emphasis: { scale: true, scaleSize: 6 },
    data: qualities.value.filter(quality => quality.count > 0).map(quality => ({ name: quality.label, value: quality.count, itemStyle: { color: gradient(quality.color, alpha(quality.color, 0.7)), shadowBlur: vizTheme.value.dark ? 16 : 8, shadowColor: alpha(quality.color, 0.45) } })),
  }],
}))

const spaceRows = computed(() => {
  if (!data.value) return []
  const rows = data.value.spaces.map(space => ({ key: space.id, id: space.id as string | null, name: space.name, known: true }))
  for (const device of data.value.devices) {
    const key = device.spaceId ?? '__unassigned__'
    if (!rows.some(row => row.key === key)) rows.push({ key, id: device.spaceId, name: device.spaceId ? `未读取空间 · ${device.spaceId}` : '未关联空间', known: false })
  }
  return rows
})
const deviceCount = (spaceId: string | null, category?: DeviceCategory) =>
  data.value?.devices.filter(device => device.spaceId === spaceId && (!category || device.category === category)).length ?? 0
const deviceLink = (spaceId?: string | null, category?: DeviceCategory) => ({
  path: '/campus/devices',
  query: { ...(spaceId !== undefined ? { spaceId: spaceId ?? '__unassigned__' } : {}), ...(category ? { category } : {}) },
})
const matrixMaximum = computed(() => Math.max(1, ...spaceRows.value.flatMap(space => categoryIds.map(category => deviceCount(space.id, category)))))
const cellStyle = (spaceId: string | null, category: { id: DeviceCategory; color: string }) => {
  const share = deviceCount(spaceId, category.id) / matrixMaximum.value
  return { '--heat': category.color, '--heat-alpha': `${Math.round(share * 34)}%`, '--heat-glow': share > 0 ? alpha(category.color, 0.35 * share) : 'transparent' }
}
const categoryCounts = computed(() => categories.value.map(category => ({ ...category, count: data.value?.devices.filter(device => device.category === category.id).length ?? 0 })))
const categoryOption = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}：{c} 台（{d}%）' },
  series: [{
    type: 'pie', name: '设备类型', roseType: 'radius', radius: ['26%', '82%'], center: ['50%', '52%'], padAngle: 2,
    itemStyle: { borderRadius: 10 },
    label: { show: true, color: vizTheme.value.text, fontSize: 12, formatter: '{b}\n{c} 台', lineHeight: 16 },
    labelLine: { length: 8, length2: 10, lineStyle: { color: vizTheme.value.axis } },
    data: categoryCounts.value.filter(category => category.count > 0).map(category => ({ name: category.label, value: category.count, itemStyle: { color: gradient(category.glow, category.color), shadowBlur: 14, shadowColor: alpha(category.color, 0.35) } })),
  }],
}))

// 拓扑：校园项目 → 空间 → 设备，结构变化时才重建，避免轮询时力导布局反复抖动
const topologyKey = computed(() => JSON.stringify([vizTheme.value.dark, spaceRows.value.map(row => row.key), data.value?.devices.map(device => [device.id, device.spaceId, device.category, device.online, device.name])]))
const topologyOption = shallowRef<EChartsCoreOption>({})
watch(topologyKey, () => {
  const t = vizTheme.value
  if (!data.value) return
  const nodes: Record<string, unknown>[] = [{
    id: 'root', name: 'AIRIOT 校园项目', symbolSize: 58, category: 0, fixed: false,
    itemStyle: { color: gradient(t.brand[0]!, t.brand[2]!), shadowBlur: 24, shadowColor: alpha(t.brand[1]!, 0.6), borderColor: alpha('#ffffff', 0.7), borderWidth: 2 },
    label: { show: true, position: 'bottom', fontWeight: 700, color: t.text, fontSize: 12 },
  }]
  const links: Record<string, unknown>[] = []
  for (const row of spaceRows.value) {
    nodes.push({ id: `space:${row.key}`, name: row.name, symbolSize: 34, category: 1, itemStyle: { color: t.surface, borderColor: row.known ? t.brand[1] : t.unknown, borderWidth: 3, borderType: row.known ? 'solid' : 'dashed', shadowBlur: 12, shadowColor: alpha(t.brand[1]!, 0.35) }, label: { show: true, position: 'right', color: t.text, fontSize: 11 } })
    links.push({ source: 'root', target: `space:${row.key}`, lineStyle: { width: 2, color: alpha(t.brand[1]!, 0.45), type: row.known ? 'solid' : 'dashed' } })
  }
  for (const device of data.value.devices) {
    const color = t.category[device.category]
    const ring = device.online === true ? t.online : device.online === false ? t.offline : t.unknown
    nodes.push({ id: `device:${device.id}`, deviceId: device.id, name: device.name, symbolSize: 16, category: categoryIds.indexOf(device.category) + 2, value: `${categoryLabels[device.category]} · ${onlineLabel(device.online)}`, itemStyle: { color, borderColor: ring, borderWidth: 2.5, borderType: device.online === null ? 'dashed' : 'solid', shadowBlur: 10, shadowColor: alpha(color, 0.6) }, label: { show: false } })
    links.push({ source: `space:${device.spaceId ?? '__unassigned__'}`, target: `device:${device.id}`, lineStyle: { color: alpha(color, 0.5), width: 1.2 } })
  }
  topologyOption.value = {
    tooltip: { trigger: 'item', formatter: (p: { dataType: string; data: { name: string; value?: string; deviceId?: string } }) => p.dataType === 'node' ? `${p.data.name}${p.data.value ? `\n${p.data.value}` : ''}${p.data.deviceId ? '\n点击查看设备详情' : ''}` : '', renderMode: 'richText' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, itemGap: 14, textStyle: { color: t.subtext, fontSize: 11 }, data: ['空间', ...categoryIds.map(id => categoryLabels[id])] },
    series: [{
      type: 'graph', name: '校园拓扑', layout: 'force', roam: true, draggable: true, scaleLimit: { min: 0.5, max: 2.5 },
      force: { repulsion: 210, gravity: 0.09, edgeLength: [36, 92], friction: 0.18, layoutAnimation: true },
      categories: [{ name: '项目' }, { name: '空间', itemStyle: { color: t.brand[1] } }, ...categoryIds.map(id => ({ name: categoryLabels[id], itemStyle: { color: t.category[id] } }))],
      emphasis: { focus: 'adjacency', label: { show: true, color: t.text }, lineStyle: { width: 3, opacity: 1 } },
      blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.08 } },
      lineStyle: { curveness: 0.12, opacity: 0.85 },
      edgeSymbol: ['none', 'circle'], edgeSymbolSize: [0, 4],
      data: nodes, links,
    }],
  }
}, { immediate: true })
const onTopologySelect = (params: { data?: unknown }) => {
  const deviceId = (params.data as { deviceId?: string } | undefined)?.deviceId
  if (deviceId) void router.push(`/campus/devices/${encodeURIComponent(deviceId)}`)
}
const onlineCounts = computed(() => ({
  online: data.value?.devices.filter(device => device.online === true).length ?? 0,
  offline: data.value?.devices.filter(device => device.online === false).length ?? 0,
  unknown: data.value?.devices.filter(device => device.online !== true && device.online !== false).length ?? 0,
}))

const trendTag = ref('temperature_c')
const trendSpace = ref('')
const trendMetrics = [{ tag: 'temperature_c', label: '温度', unit: '°C' }, { tag: 'humidity_pct', label: '湿度', unit: '%' }]
const trendTabs = trendMetrics.map(metric => ({ value: metric.tag, label: metric.label, hint: metric.unit, icon: metric.tag === 'temperature_c' ? 'ri-temp-hot-line' : 'ri-drop-line' }))
const trendMetric = computed(() => trendMetrics.find(metric => metric.tag === trendTag.value) ?? trendMetrics[0]!)
const trendSpaces = computed(() => spaceRows.value.filter(space => deviceCount(space.id, 'environment') > 0))
const trendDevices = computed(() => data.value?.devices.filter(device => device.category === 'environment' && (!trendSpace.value || (device.spaceId ?? '__unassigned__') === trendSpace.value) && device.tags.some(tag => tag.id === trendMetric.value.tag && tag.unit === trendMetric.value.unit)) ?? [])

const metrics: { tag: string; label: string; unit: string; category: DeviceCategory }[] = [
  { tag: 'temperature_c', label: '环境温度', unit: '°C', category: 'environment' },
  { tag: 'humidity_pct', label: '环境湿度', unit: '%', category: 'environment' },
  { tag: 'illuminance_lux', label: '照度', unit: 'lux', category: 'lighting' },
  { tag: 'equipment_temperature_c', label: '设备温度', unit: '°C', category: 'facility' },
  { tag: 'power_kw', label: '功率', unit: 'kW', category: 'energy' },
  { tag: 'voltage_v', label: '电压', unit: 'V', category: 'energy' },
]
const comparisonTag = ref('temperature_c')
const comparisonMetric = computed(() => metrics.find(metric => metric.tag === comparisonTag.value) ?? metrics[0]!)
const numericValue = (point: Point | undefined) =>
  point && (point.quality === 'fresh' || point.quality === 'stale') && typeof point.value === 'number' && Number.isFinite(point.value) && point.unit === comparisonMetric.value.unit ? point.value : null
const comparisonRows = computed(() =>
  spaceRows.value.flatMap(space =>
    data.value?.devices.filter(device => device.spaceId === space.id && device.category === comparisonMetric.value.category).map(device => {
      const point = data.value?.points.find(point => point.deviceId === device.id && point.tableId === device.tableId && point.tagId === comparisonMetric.value.tag)
      return { device, point, space: space.name, value: numericValue(point) }
    }) ?? []),
)
const comparisonValid = computed(() => comparisonRows.value.filter(row => row.value !== null).length)
const comparisonOption = computed<EChartsCoreOption>(() => {
  const t = vizTheme.value
  const ax = axisStyle(t)
  const color = t.category[comparisonMetric.value.category]
  const glow = t.categoryGlow[comparisonMetric.value.category]
  return {
    tooltip: {
      trigger: 'axis', renderMode: 'richText', axisPointer: { type: 'shadow', shadowStyle: { color: alpha(color, 0.06) } },
      formatter: (params: unknown) => {
        const first = Array.isArray(params) ? (params[0] as { dataIndex?: number } | undefined) : undefined
        const row = typeof first?.dataIndex === 'number' ? comparisonRows.value[first.dataIndex] : undefined
        return row ? `${row.space} · ${row.device.name}\n${comparisonMetric.value.label}：${pointLabel(row.point)}\n${row.point ? qualityLabels[row.point.quality] : '未返回点'} · 采样 ${timeLabel(row.point?.time)}` : ''
      },
    },
    grid: { left: 8, right: 70, top: 26, bottom: 26, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'value', name: comparisonMetric.value.unit, ...ax, axisLine: { show: false } },
    yAxis: { type: 'category', inverse: true, data: comparisonRows.value.map(row => `${row.space}\n${row.device.name}`), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { width: 142, overflow: 'truncate', fontSize: 11, lineHeight: 17, color: t.text } },
    series: [{
      type: 'bar', name: comparisonMetric.value.label, barMaxWidth: 16, showBackground: true, backgroundStyle: { color: alpha(t.subtext, 0.07), borderRadius: 8 },
      label: { show: true, position: 'right', color: t.text, fontWeight: 600, formatter: (p: { value: number | null }) => (p.value === null || p.value === undefined ? '' : `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(p.value)} ${comparisonMetric.value.unit}`) },
      markLine: comparisonValid.value > 1 ? { symbol: 'none', silent: true, lineStyle: { color: alpha(t.subtext, 0.6), type: 'dashed' }, label: { position: 'end', color: t.subtext, fontSize: 10, formatter: '均值 {c}' }, data: [{ type: 'average', name: '均值' }] } : undefined,
      data: comparisonRows.value.map(row => ({
        value: row.value,
        itemStyle: row.point?.quality === 'stale'
          ? { color: gradient(alpha(t.quality.stale, 0.5), t.quality.stale, true), borderRadius: 8, decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [3, 5], rotation: -0.8, color: alpha('#ffffff', 0.35) } }
          : { color: gradient(alpha(glow, 0.85), color, true), borderRadius: 8, shadowBlur: t.dark ? 14 : 6, shadowColor: alpha(color, 0.45) },
      })),
    }],
  }
})
const comparisonTabs = computed(() => metrics.map(metric => ({ value: metric.tag, label: metric.label })))
const integrity = computed(() =>
  data.value
    ? [
        { label: '空间', icon: 'ri-building-4-line', tone: 'cyan' as const, actual: data.value.completeness.actualSpaces, expected: data.value.completeness.expectedSpaces },
        { label: '设备', icon: 'ri-cpu-line', tone: 'blue' as const, actual: data.value.completeness.actualDevices, expected: data.value.completeness.expectedDevices },
        { label: '采集点', icon: 'ri-radar-line', tone: 'violet' as const, actual: data.value.completeness.actualPoints, expected: data.value.completeness.expectedPoints },
      ]
    : [],
)
</script>

<template>
  <div class="campus-page overview-page">
    <header class="campus-page-head">
      <div>
        <p class="campus-eyebrow">校园运行</p>
        <h1>校园<span class="gradient-text">运行概览</span></h1>
        <p>采集趋势、质量、空间拓扑与分布。数据来自 AIRIOT 模拟项目接口，未取得的值不以 0 代替。</p>
      </div>
      <div class="campus-page-actions">
        <LivePulse :loading="loading" :error="error" :last-success="lastSuccess" :next-at="nextRefreshAt" :interval="15000" />
        <button class="campus-button secondary" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>{{ loading ? '读取中…' : '刷新最新值' }}</button>
      </div>
    </header>
    <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
    <template v-if="data">
      <div class="campus-live-source overview-source">
        <span class="campus-chip info"><i class="ri-database-2-line" aria-hidden="true"></i>{{ error ? '保留上次成功数据' : 'AIRIOT 接口数据' }}</span>
        <span>读取 {{ timeLabel(data.observedAt) }}</span><span>15秒刷新最新值</span><span class="campus-chip sim overview-simulated">全部模拟</span>
      </div>
      <section class="campus-kpi-grid" aria-label="实际读取与采集质量">
        <KpiCard v-for="(item, index) in integrity" :key="item.label" :index="index" :label="item.label" :icon="item.icon" :tone="item.tone" :value="item.actual" :suffix="`/ ${item.expected}`" :ratio="item.expected ? Math.min(1, item.actual / item.expected) : null" :ratio-label="`${item.label}实际 ${item.actual} / 预期 ${item.expected}`" :hint="item.actual === item.expected ? '实际 / 预期一致' : '实际 / 预期待核对'" :warn="item.actual !== item.expected" />
        <KpiCard :index="3" label="有效采集点" icon="ri-shield-check-line" tone="emerald" :value="effectiveCount" :suffix="`/ ${data.points.length}`" :ratio="effectiveRatio" :ratio-label="`有效采集点占比`" :hint="data.points.length ? `${Math.round((effectiveCount / data.points.length) * 100)}% 有效` : '未返回采集点'" />
      </section>

      <div class="overview-trend-toolbar">
        <SegmentTabs v-model="trendTag" :options="trendTabs" label="环境趋势指标" />
        <label><span><i class="ri-map-pin-2-line" aria-hidden="true"></i>对比范围</span><select v-model="trendSpace"><option value="">全部环境设备（最多4台）</option><option v-for="space in trendSpaces" :key="space.key" :value="space.key">{{ space.name }}</option></select></label>
      </div>
      <div class="campus-chart-grid overview-primary">
        <MetricTrend :devices="trendDevices" :tag-id="trendMetric.tag" :unit="trendMetric.unit" :title="`环境${trendMetric.label}原始趋势`" />
        <section class="campus-panel overview-quality fx-spotlight" aria-labelledby="quality-title">
          <header class="campus-panel-head">
            <div><h2 id="quality-title"><i class="ri-shield-check-line" aria-hidden="true"></i>采集质量</h2><p>本次返回的 {{ data.points.length }} 个点</p></div>
            <router-link to="/campus/devices" class="overview-small-link">查看点值 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link>
          </header>
          <div v-if="data.points.length" class="overview-quality-ring">
            <CampusChart :option="qualityOption" :height="220" :label="`采集点质量，${qualityLabel}`" />
            <div class="overview-ring-center" aria-hidden="true"><strong><CountUp :value="effectiveRatio === null ? null : Math.round(effectiveRatio * 100)" /><small>%</small></strong><span>有效率</span></div>
          </div>
          <p v-else class="campus-empty">未返回采集点，质量占比暂不可用。</p>
          <dl class="overview-quality-list">
            <div v-for="quality in qualities" :key="quality.id" :style="{ '--q': quality.color, '--w': data.points.length ? `${(quality.count / data.points.length) * 100}%` : '0%' }">
              <dt><span class="overview-swatch" aria-hidden="true"></span>{{ quality.label }}</dt>
              <dd><CountUp :value="quality.count" /><small>{{ data.points.length ? `${Math.round((quality.count / data.points.length) * 100)}%` : '无样本' }}</small></dd>
              <span class="overview-quality-bar" aria-hidden="true"><span></span></span>
            </div>
          </dl>
          <p class="campus-muted overview-quality-note"><i class="ri-information-line" aria-hidden="true"></i>过期值保留原采样时间；缺失与无效值不参与数值比较。</p>
        </section>
      </div>

      <div class="campus-chart-grid overview-network">
        <section class="campus-panel overview-topology" aria-labelledby="topology-title">
          <header class="campus-panel-head">
            <div><h2 id="topology-title"><i class="ri-mind-map" aria-hidden="true"></i>校园设备拓扑</h2><p>项目 → 空间 → 设备的实际关联。可拖拽节点、滚轮缩放，点击设备进入详情。</p></div>
            <div class="topology-legend" aria-label="通信状态计数">
              <span class="t-online"><i aria-hidden="true"></i>在线 {{ onlineCounts.online }}</span>
              <span class="t-offline"><i aria-hidden="true"></i>离线 {{ onlineCounts.offline }}</span>
              <span class="t-unknown"><i aria-hidden="true"></i>未知 {{ onlineCounts.unknown }}</span>
            </div>
          </header>
          <CampusChart v-if="data.devices.length" :option="topologyOption" :height="380" :label="`校园设备拓扑：${spaceRows.length}个空间，${data.devices.length}台设备；在线${onlineCounts.online}台，离线${onlineCounts.offline}台，状态未知${onlineCounts.unknown}台`" @select="onTopologySelect" />
          <p v-else class="campus-empty">本次未读取到设备，无法建立拓扑关系。</p>
          <p class="campus-muted">设备外环：绿色在线、红色离线、灰色虚线为状态未知。空间虚线表示设备关联的空间未读取。</p>
        </section>
        <section class="campus-panel overview-category fx-spotlight" aria-labelledby="category-title">
          <header class="campus-panel-head">
            <div><h2 id="category-title"><i class="ri-pie-chart-2-line" aria-hidden="true"></i>设备类型分布</h2><p>实际读取 {{ data.devices.length }} 台设备</p></div>
            <router-link to="/campus/devices" class="overview-small-link">设备台账 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link>
          </header>
          <CampusChart v-if="data.devices.length" :option="categoryOption" :height="240" label="四类设备实际数量分布，下方提供按类型筛选入口" />
          <p v-else class="campus-empty">本次未读取到设备，检查完整性与接入问题。</p>
          <div class="overview-category-links">
            <router-link v-for="category in categoryCounts" :key="category.id" :to="deviceLink(undefined, category.id)" class="fx-glow-border" :style="{ '--c': category.color }">
              <span class="cat-icon" aria-hidden="true"><i :class="category.icon"></i></span>
              <span class="cat-label">{{ category.label }}</span>
              <strong><CountUp :value="category.count" /><small> 台</small></strong>
              <i class="ri-arrow-right-up-line cat-go" aria-hidden="true"></i>
            </router-link>
          </div>
        </section>
      </div>

      <div class="campus-chart-grid overview-secondary">
        <section class="campus-panel" aria-labelledby="comparison-title">
          <header class="campus-panel-head overview-comparison-head">
            <div><h2 id="comparison-title"><i class="ri-bar-chart-horizontal-line" aria-hidden="true"></i>空间最新指标</h2><p>每条为一台设备，当前单位 {{ comparisonMetric.unit }}</p></div>
          </header>
          <SegmentTabs v-model="comparisonTag" class="overview-metric-tabs" :options="comparisonTabs" label="空间比较指标" size="sm" />
          <CampusChart v-if="comparisonValid" :option="comparisonOption" :height="Math.max(250, comparisonRows.length * 58 + 52)" :label="`${comparisonMetric.label}最新值比较，${comparisonValid}台设备有可比较值，单位${comparisonMetric.unit}`" />
          <p v-else class="campus-empty">该指标暂未取得可比较值。查看采样详情核对质量与单位。</p>
          <p class="campus-muted">按实际空间关联排列，同一图仅使用 {{ comparisonMetric.unit }}；过期值以琥珀色斜纹标记，未取得有效值留空。</p>
          <details class="overview-samples">
            <summary><i class="ri-table-line" aria-hidden="true"></i>查看 {{ comparisonRows.length }} 台设备的采样详情</summary>
            <div class="campus-table-scroll">
              <table class="campus-table">
                <thead><tr><th scope="col">空间 / 设备</th><th scope="col">最新值、质量与时间</th></tr></thead>
                <tbody>
                  <tr v-for="row in comparisonRows" :key="row.device.id">
                    <th scope="row"><router-link :to="`/campus/devices/${encodeURIComponent(row.device.id)}`">{{ row.device.name }}</router-link><small>{{ row.space }}</small></th>
                    <td><PointValue :point="row.point" /><small v-if="row.point && row.point.unit !== comparisonMetric.unit" class="campus-error-text">单位与当前指标不一致，已排除比较</small></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="!comparisonRows.length" class="campus-muted">当前未读取到该类设备。</p>
          </details>
        </section>
        <section class="campus-panel overview-matrix" aria-labelledby="matrix-title">
          <header class="campus-panel-head">
            <div><h2 id="matrix-title"><i class="ri-grid-line" aria-hidden="true"></i>空间与设备热力</h2><p>按实际空间 ID 关联，点击数量筛选设备</p></div>
            <span class="campus-chip">{{ spaceRows.filter((space) => space.known).length }} 个空间</span>
          </header>
          <div class="overview-matrix-scroll">
            <table class="overview-matrix-table">
              <thead>
                <tr>
                  <th scope="col">空间</th>
                  <th v-for="category in categories" :key="category.id" scope="col"><router-link :to="deviceLink(undefined, category.id)" :style="{ '--c': category.color }"><i :class="category.icon" aria-hidden="true"></i>{{ category.label }}</router-link></th>
                  <th scope="col">总计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(space, rowIndex) in spaceRows" :key="space.key">
                  <th scope="row"><router-link :to="deviceLink(space.id)">{{ space.name }}</router-link><small v-if="!space.known">{{ space.id ? '关联空间未读取，待核对' : '设备未提供空间关联' }}</small></th>
                  <td v-for="(category, colIndex) in categories" :key="category.id">
                    <router-link class="heat-cell" :to="deviceLink(space.id, category.id)" :style="{ ...cellStyle(space.id, category), '--d': `${(rowIndex * 4 + colIndex) * 35}ms` }" :aria-label="`${space.name}，${category.label}，${deviceCount(space.id, category.id)}台，查看设备`">{{ deviceCount(space.id, category.id) }}</router-link>
                  </td>
                  <td><router-link class="heat-total" :to="deviceLink(space.id)" :aria-label="`${space.name}共${deviceCount(space.id)}台，查看设备`">{{ deviceCount(space.id) }}</router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!spaceRows.length" class="campus-empty">未读取到空间或设备，无法建立分布关系。</p>
        </section>
      </div>

      <section v-if="data.issues.length" class="campus-notice warning overview-issues" aria-label="接入问题">
        <h2>待核对事项 · {{ data.issues.length }}</h2>
        <ul><li v-for="(issue, index) in data.issues" :key="index">{{ issue.message }} <span class="campus-muted">（{{ issue.scope }}）</span></li></ul>
      </section>
      <footer class="overview-evidence">
        <i class="ri-shield-keyhole-line" aria-hidden="true"></i>
        <div><span>来源 {{ data.source }} · 项目 {{ data.projectId }} · {{ timeLabel(data.observedAt) }}</span><span>全部远端对象为模拟设备。功率 kW 与电压 V 不代表耗电量，模拟开关仅更新模拟状态。</span></div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.overview-source{margin-top:-6px}
.overview-simulated{margin-left:auto}
.overview-trend-toolbar{display:flex;gap:16px;justify-content:space-between;align-items:center;margin:4px 0 14px;flex-wrap:wrap}
.overview-trend-toolbar label{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--text-secondary);font-weight:500}
.overview-trend-toolbar label>span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.overview-trend-toolbar select{width:auto;max-width:280px;min-height:38px;font-size:13px}
.overview-primary{grid-template-columns:minmax(0,2fr) minmax(280px,1fr);align-items:start;margin-top:0}
.overview-network{grid-template-columns:minmax(0,1.75fr) minmax(280px,1fr);align-items:stretch}
.overview-secondary{grid-template-columns:minmax(0,1.35fr) minmax(320px,1fr);align-items:start}
.overview-primary>*,.overview-secondary>*,.overview-network>*{min-width:0}
.overview-small-link{font-size:12.5px;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;gap:4px;font-weight:600}
.overview-small-link i{transition:transform .25s}.overview-small-link:hover i{transform:translateX(3px)}
.overview-quality-ring{position:relative}
.overview-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.overview-ring-center strong{font-size:38px;line-height:1.1;font-weight:750;font-family:var(--font-number);letter-spacing:-.03em}
.overview-ring-center strong small{font-size:16px;margin-left:2px;color:var(--text-secondary);font-weight:600}
.overview-ring-center>span{font-size:12px;margin-top:3px;color:var(--text-tertiary);letter-spacing:.1em}
.overview-quality-list{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;padding-top:6px}
.overview-quality-list>div{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 8px}
.overview-quality-list dt{display:flex;gap:7px;align-items:center;font-size:12.5px;color:var(--text-secondary)}
.overview-quality-list dd{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;font-family:var(--font-number)}
.overview-quality-list small{font-size:11px;color:var(--text-tertiary);font-weight:400;margin-left:5px;font-family:var(--font-family)}
.overview-quality-bar{grid-column:1/-1;height:5px;border-radius:5px;background:var(--ring-track);overflow:hidden}
.overview-quality-bar span{display:block;height:100%;width:var(--w);border-radius:inherit;background:var(--q);box-shadow:0 0 10px var(--q);animation:bar-grow 1.1s cubic-bezier(.22,.8,.24,1) both}
@keyframes bar-grow{from{width:0}}
.overview-swatch{display:inline-block;width:9px;height:9px;border-radius:3px;flex-shrink:0;background:var(--q)}
.overview-quality-note{display:flex;gap:6px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border-base)}
.topology-legend{display:flex;gap:6px;flex-wrap:wrap}
.topology-legend span{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--surface-inset);border:1px solid var(--border-base);color:var(--text-secondary);font-variant-numeric:tabular-nums}
.topology-legend i{width:8px;height:8px;border-radius:50%;background:currentColor}
.t-online{color:var(--ok-text)!important}.t-offline{color:var(--bad-text)!important}
.t-unknown i{background:transparent!important;box-shadow:inset 0 0 0 1.5px currentColor}
.overview-topology{background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,var(--brand-2) 7%,transparent),transparent 70%),var(--surface-1)}
.overview-category-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.overview-category-links a{position:relative;display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;align-items:center;column-gap:10px;padding:11px 12px;border-radius:14px;background:var(--surface-inset);border:1px solid var(--border-base);color:var(--text-main);transition:transform .2s,border-color .2s}
@media(hover:hover){.overview-category-links a:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--c) 45%,transparent);opacity:1}.overview-category-links a:hover .cat-go{opacity:1;transform:translate(2px,-2px)}}
.cat-icon{grid-row:1/3;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.cat-label{font-size:12px;color:var(--text-secondary)}
.overview-category-links strong{grid-column:2;font-size:19px;font-weight:700;font-family:var(--font-number);line-height:1.15}
.overview-category-links strong small{font-size:11px;font-weight:500;color:var(--text-tertiary);font-family:var(--font-family)}
.cat-go{grid-row:1/3;grid-column:3;color:var(--text-tertiary);opacity:.4;transition:all .25s}
.overview-comparison-head{margin-bottom:12px}
.overview-metric-tabs{margin-bottom:10px}
.overview-samples summary{display:inline-flex;align-items:center;gap:6px;padding:12px 0 0;min-height:44px;cursor:pointer;color:var(--primary-color);font-size:12.5px;font-weight:600}
.overview-samples .campus-table-scroll{max-height:340px;overflow:auto}
.overview-matrix-scroll{overflow-x:auto;margin:0 -4px;padding:0 4px}
.overview-matrix-table{width:100%;border-collapse:separate;border-spacing:5px;font-size:13px;table-layout:fixed}
.overview-matrix-table thead th{font-size:11.5px;font-weight:600;color:var(--text-tertiary);text-align:center;padding:0 0 4px}
.overview-matrix-table thead th:first-child{text-align:left}
.overview-matrix-table thead a{display:inline-flex;flex-direction:column;align-items:center;gap:3px;color:var(--text-secondary);min-height:40px;justify-content:center}
.overview-matrix-table thead a i{font-size:16px;color:var(--c)}
.overview-matrix-table thead th:first-child,.overview-matrix-table tbody th{width:30%}
.overview-matrix-table tbody th{text-align:left;font-weight:600;padding-right:4px}
.overview-matrix-table tbody th a{display:flex;align-items:center;min-height:44px;color:var(--text-main);font-size:12.5px;line-height:1.35}
.overview-matrix-table tbody th small{display:block;font-size:11px;font-weight:400;color:var(--warn-text)}
.overview-matrix-table td{padding:0}
.heat-cell,.heat-total{display:grid;place-items:center;min-height:48px;border-radius:12px;font-size:17px;font-weight:700;font-family:var(--font-number);font-variant-numeric:tabular-nums;color:var(--text-main);transition:transform .2s,box-shadow .2s}
.heat-cell{background:color-mix(in srgb,var(--heat) var(--heat-alpha),var(--surface-inset));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--heat) 22%,transparent),0 6px 16px -10px var(--heat-glow);animation:heat-pop .5s cubic-bezier(.34,1.5,.5,1) both;animation-delay:var(--d)}
.heat-total{background:var(--surface-raised);border:1px solid var(--border-base)}
@media(hover:hover){.heat-cell:hover,.heat-total:hover{transform:scale(1.08);opacity:1;box-shadow:inset 0 0 0 1.5px var(--heat,var(--brand-2)),0 10px 22px -10px var(--heat-glow,var(--brand-glow))}}
@keyframes heat-pop{from{transform:scale(.6);opacity:0}}
.overview-issues{margin:20px 0 0}
.overview-evidence{display:flex;gap:12px;align-items:flex-start;margin-top:22px;padding:14px 18px;border-radius:16px;border:1px dashed var(--border-strong);font-size:12px;color:var(--text-tertiary);line-height:1.8}
.overview-evidence>i{font-size:20px;color:var(--brand-2);margin-top:2px}
.overview-evidence div{display:flex;flex-direction:column}
@media(max-width:1200px){.overview-primary{grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr)}.overview-secondary,.overview-network{grid-template-columns:minmax(0,1fr)}.overview-quality-list{grid-template-columns:1fr}}
@media(max-width:900px){.overview-primary{grid-template-columns:1fr}.overview-quality-list{grid-template-columns:1fr 1fr}.overview-quality-ring{max-width:320px;margin:auto}}
@media(max-width:560px){
  .overview-simulated{margin-left:0}
  .overview-trend-toolbar label{width:100%;justify-content:space-between}
  .overview-trend-toolbar select{min-height:44px;font-size:16px;max-width:220px}
  .overview-category-links{grid-template-columns:1fr}
  .overview-matrix-table{table-layout:auto}.overview-matrix-table tbody th{min-width:92px}.overview-matrix-table td{min-width:46px}
  .overview-evidence{font-size:11px;padding:12px}
  .topology-legend{width:100%}
}
</style>
