<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { HistoryResult } from '../types/full'
import { historySeries } from '../domain/course'
echarts.use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])
const props = defineProps<{ history: HistoryResult }>()
const host = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resize: ResizeObserver | null = null
function render() {
  chart?.setOption(
    {
      animation: false,
      aria: { enabled: true },
      color: ['#27665d'],
      grid: { left: 60, right: 25, top: 25, bottom: 45 },
      tooltip: { trigger: 'axis', renderMode: 'richText' },
      xAxis: { type: 'time', axisLabel: { hideOverlap: true } },
      yAxis: { type: 'value', scale: true, name: props.history.unit },
      series: [
        {
          name: '原始样本',
          type: 'line',
          data: historySeries(props.history),
          connectNulls: false,
          smooth: false,
          symbolSize: 5,
          lineStyle: { width: 2 },
        },
      ],
    },
    { notMerge: true },
  )
}
onMounted(() => {
  if (host.value) {
    chart = echarts.init(host.value)
    resize = new ResizeObserver(() => chart?.resize())
    resize.observe(host.value)
    render()
  }
})
watch(() => props.history, render)
onBeforeUnmount(() => {
  resize?.disconnect()
  chart?.dispose()
  chart = null
})
</script>
<template>
  <div
    ref="host"
    class="history-chart"
    role="img"
    aria-label="历史采样折线，缺失值处断开；可通过下方样本表读取全部数值。"
  ></div>
</template>
