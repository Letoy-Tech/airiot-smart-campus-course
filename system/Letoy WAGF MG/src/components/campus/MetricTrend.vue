<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { Device } from '@/types/campus'
import type { EChartsCoreOption } from 'echarts/core'
import { useHistorySeries } from '@/composables/useHistorySeries'
import { timeLabel } from '@/utils/campus'
import { alpha, axisStyle, gradient, vizTheme } from '@/utils/vizTheme'
import CampusChart from './CampusChart.vue'
import ResourceState from './ResourceState.vue'
import SegmentTabs from '@/components/viz/SegmentTabs.vue'
import Sparkline from '@/components/viz/Sparkline.vue'

const props = withDefaults(defineProps<{ devices: Device[]; tagId: string; unit: string; title: string; height?: number }>(), { height: 300 })
const hours = ref(0.25)
const ranges = [{ value: 0.25, label: '15分钟' }, { value: 1, label: '1小时' }, { value: 6, label: '6小时' }]
const showSamples = ref(false)
const toggleSamples = (event: Event) => { showSamples.value = (event.target as HTMLDetailsElement).open }
const { entries, sources, failures, loading, error, lastSuccess, load } = useHistorySeries(toRef(props, 'devices'), toRef(props, 'tagId'), hours)
const palette = computed(() => vizTheme.value.series)
const visible = ref<Record<string, boolean>>({})
const toggleSeries = (id: string) => { visible.value[id] = visible.value[id] === false }
const seriesName = (device: Device) => device.spaceName && entries.value.filter(entry => entry.device.spaceName === device.spaceName).length === 1 ? device.spaceName : device.name
const seriesColor = (device: Device) => palette.value[Math.max(0, sources.value.findIndex(source => source.id === device.id)) % palette.value.length]!
const count = computed(() => entries.value.reduce((sum, item) => sum + item.result.samples.length, 0))
const hasSamples = computed(() => count.value > 0)
const freshRange = computed(() => entries.value.find(entry => !entry.retained)?.result)
const option = computed<EChartsCoreOption>(() => {
  const t = vizTheme.value
  const ax = axisStyle(t)
  const single = entries.value.length === 1
  return {
    color: palette.value,
    tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: alpha(t.brand[1]!, 0.5), type: 'dashed' }, label: { backgroundColor: t.brand[1] } } },
    grid: { left: 12, right: 18, top: 34, bottom: 52, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'time', min: entries.value.length ? Math.min(...entries.value.map(entry => entry.result.from)) : undefined, max: entries.value.length ? Math.max(...entries.value.map(entry => entry.result.to)) : undefined, axisLabel: { ...ax.axisLabel, formatter: '{HH}:{mm}' }, axisLine: ax.axisLine, axisTick: ax.axisTick, splitLine: { show: false } },
    yAxis: { type: 'value', name: props.unit, scale: true, ...ax, axisLine: { show: false } },
    dataZoom: [
      { type: 'inside', filterMode: 'none', zoomOnMouseWheel: false },
      { type: 'slider', bottom: 6, height: 20, showDetail: false, borderColor: 'transparent', backgroundColor: alpha(t.subtext, 0.06), fillerColor: alpha(t.brand[1]!, 0.14), dataBackground: { lineStyle: { color: alpha(t.brand[1]!, 0.4) }, areaStyle: { color: alpha(t.brand[1]!, 0.08) } }, selectedDataBackground: { lineStyle: { color: t.brand[1] }, areaStyle: { color: alpha(t.brand[1]!, 0.2) } }, handleStyle: { color: t.surface, borderColor: t.brand[1] }, moveHandleStyle: { color: alpha(t.brand[1]!, 0.5) } },
    ],
    series: entries.value.map(item => {
      const color = seriesColor(item.device)
      return {
        name: seriesName(item.device), type: 'line', showSymbol: item.result.samples.length < 30, symbolSize: 5, smooth: false, connectNulls: false,
        itemStyle: { color },
        lineStyle: { width: 2.2, color, type: item.retained ? 'dashed' : 'solid', shadowBlur: t.dark ? 12 : 6, shadowColor: alpha(color, t.dark ? 0.6 : 0.35) },
        areaStyle: { color: gradient(alpha(color, single ? 0.32 : 0.14), alpha(color, 0)) },
        emphasis: { focus: 'series', lineStyle: { width: 3 } },
        data: visible.value[item.device.id] === false ? [] : item.result.samples.map(sample => [sample.time, sample.value]),
      }
    }),
  }
})
const compact = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value)
const lastSample = (samples: { time: number; value: number }[]) => samples[samples.length - 1]
</script>

<template>
  <section class="campus-panel metric-trend">
    <header class="campus-panel-head">
      <div><h2><i class="ri-line-chart-line" aria-hidden="true"></i>{{ title }}</h2><p>原始采样 · {{ unit || '无单位' }} · 最多对比4台设备</p></div>
      <div class="trend-controls">
        <SegmentTabs v-model="hours" :options="ranges" label="历史时间范围" size="sm" />
        <button class="campus-tool trend-refresh" :class="{ spinning: loading }" :disabled="loading || !sources.length" aria-label="刷新历史趋势" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i></button>
      </div>
    </header>
    <ResourceState :loading="loading" :error="error" :has-data="!!entries.length" :last-success="lastSuccess" compact @retry="load" />
    <p v-if="!sources.length" class="campus-empty">当前范围没有提供该采集点的设备。</p>
    <template v-else-if="entries.length">
      <CampusChart v-if="hasSamples" :option="option" :height="height" :label="`${title}，${entries.length}台设备，${count}条原始样本，单位${unit || '无'}`" />
      <p v-else class="campus-empty">该范围没有返回原始样本。请调整时间范围或检查历史采集。</p>
      <div class="trend-series-facts" :class="{ single: entries.length === 1 }">
        <button v-for="entry in entries" :key="entry.device.id" type="button" class="trend-series fx-spotlight" :class="{ off: visible[entry.device.id] === false, retained: entry.retained }" :style="{ '--series': seriesColor(entry.device) }" :aria-pressed="visible[entry.device.id] !== false" :aria-label="`显示${seriesName(entry.device)}的历史趋势`" @click="toggleSeries(entry.device.id)">
          <span class="series-head"><span class="series-swatch" aria-hidden="true"></span><span class="series-name">{{ seriesName(entry.device) }}</span><span class="series-count">{{ entry.result.samples.length }} 条</span></span>
          <span class="series-body">
            <span v-if="!entry.result.samples.length" class="campus-muted">无样本</span>
            <span v-else class="series-last"><strong>{{ compact(lastSample(entry.result.samples)!.value) }}</strong><small>{{ unit }} · 末条 {{ timeLabel(lastSample(entry.result.samples)!.time).slice(-8) }}</small></span>
            <Sparkline v-if="entry.result.samples.length > 1" :samples="entry.result.samples" :color="seriesColor(entry.device)" :width="96" :height="30" :dashed="entry.retained" />
          </span>
          <span v-if="entry.retained" class="trend-retained">刷新失败，虚线为上次成功结果 · 查询 {{ timeLabel(entry.result.from) }} — {{ timeLabel(entry.result.to) }}</span>
        </button>
      </div>
      <p class="campus-source"><template v-if="freshRange">成功查询 {{ timeLabel(freshRange.from) }} — {{ timeLabel(freshRange.to) }} · </template><template v-if="entries.some(entry=>entry.retained)">虚线的旧查询时间见设备标记 · </template>历史为查询快照，手动刷新更新 · 点击设备卡片显示/隐藏曲线</p>
      <p v-if="entries.some(entry => entry.result.truncated)" class="campus-notice warning">部分设备达到1000条接口上限，历史已截断。缩短时间范围查看完整趋势。</p>
      <ul v-if="entries.some(entry => entry.result.issues.length)" class="campus-notice warning"><template v-for="entry in entries" :key="entry.device.id"><li v-for="(issue, index) in entry.result.issues" :key="index">{{ entry.device.name }}：{{ issue.message }}</li></template></ul>
      <details class="trend-samples" :open="showSamples" @toggle="toggleSamples"><summary><i class="ri-table-line" aria-hidden="true"></i>查看原始样本 · {{ count }} 条</summary><template v-if="showSamples"><section v-for="entry in entries" :key="entry.device.id"><h3>{{ entry.device.name }} · {{ entry.result.samples.length }} 条</h3><div class="campus-table-scroll trend-sample-table"><table class="campus-table"><thead><tr><th scope="col">采样时间</th><th scope="col">原始值{{ unit ? `（${unit}）` : '' }}</th></tr></thead><tbody><tr v-for="(sample,index) in entry.result.samples" :key="index"><td>{{ timeLabel(sample.time) }}</td><td>{{ sample.value }}</td></tr></tbody></table></div></section></template></details>
    </template>
    <ul v-if="failures.length" class="campus-notice warning" role="status"><li v-for="failure in failures" :key="failure">{{ failure }}</li></ul>
  </section>
</template>

<style scoped>
.trend-controls{display:flex;align-items:center;gap:8px;flex-shrink:0}
.trend-refresh{width:36px;height:36px;font-size:17px}
.trend-refresh:disabled{opacity:.45;cursor:not-allowed}
.trend-refresh.spinning i{animation:lp-spin .9s linear infinite}
.trend-retained{grid-column:1/-1;font-size:11px;color:var(--warn-text);line-height:1.6;text-align:left}
.trend-series-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px}
.trend-series-facts.single{grid-template-columns:minmax(0,1fr)}
.trend-series{position:relative;display:grid;gap:6px;text-align:left;padding:11px 12px;border-radius:14px;border:1px solid var(--border-base);background:var(--surface-inset);cursor:pointer;color:var(--text-main);min-width:0;transition:border-color .2s,opacity .25s,transform .2s}
.trend-series::after{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--series);box-shadow:0 0 10px var(--series)}
@media(hover:hover){.trend-series:hover{border-color:color-mix(in srgb,var(--series) 50%,transparent)}}
.trend-series.off{opacity:.45}
.trend-series.off::after{box-shadow:none;background:var(--text-disabled)}
.series-head{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px}
.series-swatch{width:10px;height:10px;border-radius:3px;background:var(--series);flex-shrink:0}
.trend-series.off .series-swatch{background:transparent;box-shadow:inset 0 0 0 2px var(--text-disabled)}
.series-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.series-count{margin-left:auto;color:var(--text-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.series-body{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;min-width:0}
.series-last{display:flex;flex-direction:column;min-width:0}
.series-last strong{font-size:20px;font-weight:700;font-family:var(--font-number);line-height:1.15;letter-spacing:-.01em}
.series-last small{font-size:11px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trend-samples summary{display:inline-flex;align-items:center;gap:6px;padding:10px 0 0;min-height:36px;cursor:pointer;color:var(--primary-color);font-size:12.5px;font-weight:600}
.trend-samples h3{font-size:13px;margin-top:14px}
.trend-sample-table{max-height:260px;overflow:auto}
.metric-trend .campus-source{margin:12px 0 0}
.metric-trend .campus-notice{margin-bottom:0}
@media(max-width:560px){.trend-controls{width:100%;justify-content:space-between}.trend-series-facts{grid-template-columns:1fr}.trend-series{min-height:44px}.metric-trend .campus-panel-head{flex-wrap:wrap}}
</style>
