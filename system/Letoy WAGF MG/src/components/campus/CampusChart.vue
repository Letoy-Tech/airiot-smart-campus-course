<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, GraphChart, LineChart, PieChart, TreeChart } from 'echarts/charts'
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, PolarComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { vizTheme } from '@/utils/vizTheme'

echarts.use([BarChart, GraphChart, LineChart, PieChart, TreeChart, AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, PolarComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(defineProps<{ option: EChartsCoreOption; label: string; height?: number }>(), { height: 280 })
const emit = defineEmits<{ select: [params: { name?: string; dataIndex?: number; data?: unknown; seriesIndex?: number }] }>()
const element = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | undefined
let observer: ResizeObserver | undefined
let signature = ''

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

/** 系列数量或类型变化时整体重建，否则合并更新，让轮询数值平滑过渡而不是从零重播。 */
function structure(option: EChartsCoreOption) {
  const series = (Array.isArray(option.series) ? option.series : option.series ? [option.series] : []) as { type?: string; name?: string }[]
  return JSON.stringify([series.map(item => `${item.type}:${item.name ?? ''}`), Boolean(option.xAxis), Boolean(option.polar)])
}

function render() {
  if (!chart) return
  const t = vizTheme.value
  const option = props.option as Record<string, unknown>
  const tooltip = option.tooltip as Record<string, unknown> | undefined
  const next = {
    ...option,
    animation: !reducedMotion(),
    animationDuration: 900,
    animationDurationUpdate: 650,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicInOut',
    textStyle: { fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', color: t.text },
    aria: { enabled: true, description: props.label },
    ...(tooltip ? {
      tooltip: {
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: t.text, fontSize: 12 },
        extraCssText: `border-radius:12px;box-shadow:0 12px 32px -8px ${t.tooltipShadow};backdrop-filter:blur(10px);`,
        ...tooltip,
      },
    } : {}),
  } as EChartsCoreOption
  const nextSignature = structure(next)
  chart.setOption(next, { notMerge: nextSignature !== signature })
  signature = nextSignature
}

onMounted(() => {
  if (!element.value) return
  chart = echarts.init(element.value)
  render()
  chart.on('click', params => emit('select', params as never))
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(element.value)
  }
})
watch(() => props.option, render, { deep: true })
watch(vizTheme, () => { signature = ''; render() })
watch(() => props.height, () => chart?.resize())
onUnmounted(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template><div ref="element" class="campus-chart" :style="{height: `${height}px`}" role="img" :aria-label="label"></div></template>
<style scoped>.campus-chart{width:100%;min-width:0}</style>
