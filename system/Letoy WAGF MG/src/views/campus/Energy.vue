<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import type { Point } from '@/types/campus'
import { getOverview } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { qualityLabels, timeLabel } from '@/utils/campus'
import { gaugeScale } from '@/utils/gaugeScale'
import { alpha, axisStyle, gradient, vizTheme } from '@/utils/vizTheme'
import CampusChart from '@/components/campus/CampusChart.vue'
import MetricTrend from '@/components/campus/MetricTrend.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import PointValue from '@/components/campus/PointValue.vue'
import ArcGauge from '@/components/viz/ArcGauge.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
import SegmentTabs from '@/components/viz/SegmentTabs.vue'

defineOptions({ name: 'CampusEnergy' })

type EnergyTag = 'power_kw' | 'voltage_v'
const metrics = {
  power_kw: { name: '功率', unit: 'kW' },
  voltage_v: { name: '电压', unit: 'V' },
}
const metricTabs = [{ value: 'power_kw' as EnergyTag, label: '功率', hint: 'kW', icon: 'ri-flashlight-line' }, { value: 'voltage_v' as EnergyTag, label: '电压', hint: 'V', icon: 'ri-pulse-line' }]
const selectedTag = ref<EnergyTag>('power_kw')
const metric = computed(() => metrics[selectedTag.value])
const { data, loading, error, lastSuccess, nextRefreshAt, load } = useResource(getOverview, 15000)
const devices = computed(() => data.value?.devices.filter(device => device.category === 'energy') || [])
const pointFor = (deviceId: string, tagId: EnergyTag) => data.value?.points.find(point => point.deviceId === deviceId && point.tagId === tagId)
const hasValue = (point: Point | undefined): point is Point => !!point
  && (point.quality === 'fresh' || point.quality === 'stale')
  && typeof point.value === 'number' && Number.isFinite(point.value)
  && typeof point.time === 'number' && Number.isFinite(point.time)
const compact = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value)
const rows = computed(() => devices.value.map(device => {
  const point = pointFor(device.id, selectedTag.value)
  const value = hasValue(point) ? point.value : null
  return { device, point, value }
}))
const qualityCounts = computed(() => ({
  fresh: rows.value.filter(row => row.value !== null && row.point?.quality === 'fresh').length,
  stale: rows.value.filter(row => row.value !== null && row.point?.quality === 'stale').length,
  unavailable: rows.value.filter(row => row.value === null).length,
}))
const availablePoints = computed(() => devices.value.reduce((count, device) => count
  + Number(hasValue(pointFor(device.id, 'power_kw')))
  + Number(hasValue(pointFor(device.id, 'voltage_v'))), 0))
const hasComparison = computed(() => rows.value.some(row => row.value !== null))
const scale = computed(() => gaugeScale(selectedTag.value, rows.value.map(row => row.value)))
const comparisonLabel = computed(() => `${metric.value.name}即时比较，单位${metric.value.unit}，${qualityCounts.value.fresh}台有效，${qualityCounts.value.stale}台过期，${qualityCounts.value.unavailable}台未取得有效值。具体采样时间见最新点值表。`)
const comparisonOption = computed<EChartsCoreOption>(() => {
  const t = vizTheme.value
  const ax = axisStyle(t)
  const color = t.category.energy
  const glow = t.categoryGlow.energy
  return {
    grid: { left: 8, right: 16, top: 40, bottom: 8, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      trigger: 'item', renderMode: 'richText',
      formatter: (params: { dataIndex: number }) => {
        const row = rows.value[params.dataIndex]
        if (!row) return ''
        return [row.device.spaceName || '未关联空间', row.device.name, `${row.value === null ? '未取得有效值' : `${compact(row.value)} ${metric.value.unit}`} · ${qualityLabels[row.point?.quality || 'missing']}`, `采样 ${timeLabel(row.point?.time ?? null)}`].join('\n')
      },
    },
    xAxis: { type: 'category', data: rows.value.map(row => row.device.spaceName || row.device.name), axisLine: ax.axisLine, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 11, width: 76, overflow: 'truncate', interval: 0 } },
    yAxis: { type: 'value', name: metric.value.unit, scale: selectedTag.value === 'voltage_v', ...ax, axisLine: { show: false } },
    series: [{
      type: 'bar', name: metric.value.name, barMaxWidth: 34, showBackground: true, backgroundStyle: { color: alpha(t.subtext, 0.06), borderRadius: [10, 10, 4, 4] },
      data: rows.value.map(row => ({
        value: row.value,
        itemStyle: row.point?.quality === 'stale'
          ? { color: gradient(t.quality.stale, alpha(t.quality.stale, 0.35)), borderRadius: [10, 10, 4, 4], decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [3, 5], rotation: -0.8, color: alpha('#ffffff', 0.35) } }
          : { color: gradient(glow, alpha(color, 0.55)), borderRadius: [10, 10, 4, 4], shadowBlur: t.dark ? 18 : 8, shadowColor: alpha(color, 0.5) },
      })),
      label: {
        show: true, position: 'top', distance: 6, fontSize: 12, lineHeight: 16, color: t.text, fontWeight: 600,
        formatter: (params: { dataIndex: number }) => {
          const row = rows.value[params.dataIndex]
          return row?.value !== null && row?.value !== undefined ? `${compact(row.value)} ${metric.value.unit}` : ''
        },
      },
    }],
  }
})
</script>

<template>
  <div class="campus-page energy-page">
    <header class="campus-page-head">
      <div><p class="campus-eyebrow">能源监测</p><h1>能源<span class="gradient-text">运行概览</span></h1><p>对比四个空间的功率与电压，查看原始采样变化。</p></div>
      <div class="campus-page-actions">
        <LivePulse :loading="loading" :error="error" :last-success="lastSuccess" :next-at="nextRefreshAt" />
        <button class="campus-button" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>{{ loading ? '读取中…' : '刷新最新值' }}</button>
      </div>
    </header>
    <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
    <template v-if="data">
      <div class="campus-live-source">
        <span class="campus-chip sim"><i class="ri-flask-line" aria-hidden="true"></i>模拟采集</span>
        <span>AIRIOT · {{ error ? '上次成功读取' : '数据读取' }} {{ timeLabel(data.observedAt) }}</span>
        <span>最新值每15秒自动读取</span>
      </div>

      <div class="campus-kpi-grid" aria-label="能源点位完整性与所选指标质量">
        <KpiCard :index="0" label="能源设备" icon="ri-flashlight-line" tone="amber" :value="devices.length" suffix="/ 4 台" :ratio="Math.min(1, devices.length / 4)" ratio-label="能源设备读取比例" hint="当前读取的能源设备" />
        <KpiCard :index="1" label="有数值点位" icon="ri-radar-line" tone="cyan" :value="availablePoints" suffix="/ 8 个" :ratio="Math.min(1, availablePoints / 8)" ratio-label="有数值点位比例" hint="电压与功率，包含过期采样" />
        <KpiCard :index="2" :label="`${metric.name}有效采样`" icon="ri-shield-check-line" tone="emerald" :value="qualityCounts.fresh" unit="台" :hint="`所选指标 · 缺失或无效 ${qualityCounts.unavailable} 台`" />
        <KpiCard :index="3" :label="`${metric.name}过期采样`" icon="ri-history-line" tone="rose" :value="qualityCounts.stale" unit="台" hint="所选指标 · 保留原始值与时间" :warn="qualityCounts.stale > 0" />
      </div>

      <div class="energy-toolbar">
        <SegmentTabs v-model="selectedTag" :options="metricTabs" label="选择能源指标" />
        <span class="campus-muted">表盘刻度 {{ scale.min }}–{{ scale.max }} {{ metric.unit }}{{ scale.auto ? '，按当前最大值自动缩放' : '' }}；刻度仅用于显示位置</span>
      </div>
      <section class="energy-gauges fx-stagger" aria-label="能源设备仪表">
        <article v-for="row in rows" :key="row.device.id" class="energy-gauge campus-panel fx-spotlight">
          <header><strong>{{ row.device.spaceName || '未关联空间' }}</strong><span class="quality" :class="row.point?.quality || 'missing'">{{ qualityLabels[row.point?.quality || 'missing'] }}</span></header>
          <ArcGauge :value="row.value" :min="scale.min" :max="scale.max" :unit="metric.unit" :color="vizTheme.category.energy" :glow="vizTheme.categoryGlow.energy" :stale="row.point?.quality === 'stale'" :caption="`采样 ${timeLabel(row.point?.time ?? null)}`" />
          <router-link class="energy-gauge-link" :to="`/campus/devices/${encodeURIComponent(row.device.id)}`" :aria-label="`查看${row.device.name}的设备详情与历史`">{{ row.device.name }}<i class="ri-arrow-right-line" aria-hidden="true"></i></router-link>
        </article>
        <p v-if="!rows.length" class="campus-empty">未读取到能源设备，请检查项目接入。</p>
      </section>

      <div class="energy-chart-grid">
        <section class="campus-panel energy-comparison" aria-labelledby="energy-comparison-title">
          <header class="campus-panel-head">
            <div><h2 id="energy-comparison-title"><i class="ri-bar-chart-2-line" aria-hidden="true"></i>空间{{ metric.name }}比较</h2><p>各设备末次采样 · {{ metric.unit }} · 采样时间可能不同</p></div>
          </header>
          <CampusChart v-if="hasComparison" :option="comparisonOption" :label="comparisonLabel" :height="300" />
          <p v-else class="campus-empty">{{ devices.length ? `未取得可展示的${metric.name}值，请查看点位质量与采样时间。` : '未读取到能源设备，请检查项目接入。' }}</p>
          <div class="energy-quality-key"><span><i class="energy-key fresh" aria-hidden="true"></i>有效采样</span><span><i class="energy-key stale" aria-hidden="true"></i>过期采样（斜纹）</span><span v-if="qualityCounts.unavailable">{{ qualityCounts.unavailable }} 台未取得有效值，不绘制数值</span><a href="#energy-latest">查看采样时间与质量 <i class="ri-arrow-down-line" aria-hidden="true"></i></a></div>
        </section>
        <MetricTrend :devices="devices" :tag-id="selectedTag" :unit="metric.unit" :title="`${metric.name}原始历史`" />
      </div>

      <section id="energy-latest" class="energy-latest" aria-labelledby="energy-latest-title">
        <header class="campus-panel-head"><div><h2 id="energy-latest-title"><i class="ri-table-line" aria-hidden="true"></i>最新点值</h2><p>每个点位保留原始值、质量与采样时间；进入设备详情可查看单台历史。</p></div></header>
        <div class="campus-table-scroll">
          <table class="campus-table">
            <thead><tr><th scope="col">能源设备</th><th scope="col">空间</th><th scope="col">功率 kW</th><th scope="col">电压 V</th><th scope="col">设备详情</th></tr></thead>
            <tbody><tr v-for="device in devices" :key="device.id">
              <td><strong>{{ device.name }}</strong><small>{{ device.id }}</small></td>
              <td>{{ device.spaceName || '未关联空间' }}</td>
              <td><PointValue :point="pointFor(device.id, 'power_kw')" /></td>
              <td><PointValue :point="pointFor(device.id, 'voltage_v')" /></td>
              <td><router-link class="energy-device-link" :to="`/campus/devices/${encodeURIComponent(device.id)}`" :aria-label="`查看${device.name}的设备详情与历史`">查看设备 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></td>
            </tr></tbody>
          </table>
        </div>
        <p v-if="!devices.length" class="campus-empty">当前没有可展示的能源设备。</p>
      </section>
      <ul v-if="data.issues.length" class="campus-notice warning" role="status"><li v-for="(issue, index) in data.issues" :key="index">{{ issue.message }}</li></ul>
    </template>
    <p class="campus-footnote"><i class="ri-information-line" aria-hidden="true"></i>当前接入电压 V 与功率 kW。功率不等于电量，当前不生成 kWh、耗电费用或节能率。</p>
  </div>
</template>

<style scoped>
.energy-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 14px}
.energy-gauges{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px}
.energy-gauge{display:flex;flex-direction:column;gap:6px;padding:16px 18px;background:radial-gradient(260px 160px at 50% 70%,color-mix(in srgb,var(--viz-energy) 10%,transparent),transparent 70%),var(--surface-1)}
.energy-gauge header{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px}
.energy-gauge header strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.energy-gauge-link{display:inline-flex;align-items:center;justify-content:center;gap:4px;font-size:12.5px;font-weight:600;min-height:32px;margin-top:2px}
.energy-gauge-link i{transition:transform .25s}.energy-gauge-link:hover i{transform:translateX(3px)}
.energy-chart-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:start;gap:20px}
.energy-chart-grid>*,.energy-comparison{min-width:0}
.energy-comparison .campus-panel-head{margin-bottom:6px}
.energy-quality-key{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;font-size:12px;line-height:1.7;color:var(--text-tertiary);margin-top:12px}
.energy-quality-key>span{display:inline-flex;align-items:center;gap:6px}
.energy-quality-key>a{margin-left:auto;min-height:32px;display:inline-flex;align-items:center;gap:4px;font-weight:600}
.energy-key{width:10px;height:10px;border-radius:3px;flex-shrink:0;background:var(--viz-energy)}
.energy-key.stale{background:repeating-linear-gradient(-45deg,var(--warn) 0 2px,color-mix(in srgb,var(--warn) 45%,transparent) 2px 4px)}
.energy-latest{margin-top:28px;scroll-margin-top:24px}
.energy-latest .campus-panel-head{margin-bottom:8px}
.energy-device-link{min-height:36px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-weight:600}
@media(max-width:1050px){.energy-chart-grid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){.energy-toolbar .segment-tabs{width:100%}.energy-quality-key{gap:6px 14px}.energy-quality-key>a{margin-left:0;min-height:44px}.energy-device-link{min-height:44px}.energy-latest{margin-top:24px}.energy-gauges{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.energy-gauge{padding:12px 10px}}
</style>
