<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { HistoryResult } from '@/types/campus'
import { timeLabel } from '@/utils/campus'
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
const props = defineProps<{ data: HistoryResult }>()
const element = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | undefined
let observer: ResizeObserver | undefined
const render = () => chart?.setOption({ animation: false, grid: { left: 52, right: 24, top: 24, bottom: 46 }, tooltip: { trigger: 'axis' }, xAxis: { type: 'time' }, yAxis: { type: 'value', name: props.data.unit, scale: true }, series: [{ type: 'line', showSymbol: true, symbolSize: 4, connectNulls: false, smooth: false, data: props.data.samples.map(sample => [sample.time, sample.value]), lineStyle: { color: '#0284c7', width: 2 } }] }, true)
onMounted(() => { if (element.value) { chart = echarts.init(element.value); render(); observer = new ResizeObserver(() => chart?.resize()); observer.observe(element.value) } })
watch(() => props.data, render)
onUnmounted(() => { observer?.disconnect(); chart?.dispose() })
</script>
<template><div><div ref="element" class="history-chart" role="img" :aria-label="`原始历史趋势，共 ${data.samples.length} 条样本${data.unit ? `，单位 ${data.unit}` : ''}`"></div><details><summary>查看原始样本（{{ data.samples.length }} 条）</summary><div class="campus-table-scroll sample-table"><table class="campus-table"><thead><tr><th scope="col">采样时间</th><th scope="col">原始值{{ data.unit ? `（${data.unit}）` : '' }}</th></tr></thead><tbody><tr v-for="(sample, index) in data.samples" :key="`${sample.time}-${index}`"><td>{{ timeLabel(sample.time) }}</td><td>{{ sample.value }}</td></tr></tbody></table></div></details></div></template>
<style scoped>.history-chart{width:100%;height:300px}.sample-table{max-height:320px;overflow:auto}summary{cursor:pointer;padding:12px 0;color:var(--primary-hover)}</style>
