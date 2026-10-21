<script setup lang="ts">
import { computed, useId } from 'vue'
defineOptions({ name: 'SparkLine' })

/** 迷你趋势线：只绘制传入的原始样本，不插值、不补零。 */
const props = withDefaults(defineProps<{ samples: { time: number; value: number }[]; color?: string; width?: number; height?: number; dashed?: boolean }>(), {
  color: 'var(--brand-2)', width: 120, height: 32, dashed: false,
})
const id = useId()
const geometry = computed(() => {
  const list = props.samples.filter(s => Number.isFinite(s.value) && Number.isFinite(s.time))
  if (list.length < 2) return null
  const t0 = list[0]!.time
  const t1 = list[list.length - 1]!.time
  let min = Infinity
  let max = -Infinity
  for (const s of list) { if (s.value < min) min = s.value; if (s.value > max) max = s.value }
  const pad = 2
  const w = props.width - pad * 2
  const h = props.height - pad * 2
  const span = max - min || 1
  const pts = list.map(s => [pad + ((s.time - t0) / (t1 - t0 || 1)) * w, pad + h - ((s.value - min) / span) * h] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]!
  return { line, area: `${line} L${last[0].toFixed(1)} ${props.height} L${pts[0]![0].toFixed(1)} ${props.height} Z`, last }
})
</script>

<template>
  <svg v-if="geometry" class="sparkline" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" aria-hidden="true" preserveAspectRatio="none">
    <defs>
      <linearGradient :id="`s-${id}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity=".32" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#s-${id})`" />
    <path :d="geometry.line" fill="none" :stroke="color" stroke-width="1.6" stroke-linejoin="round" :stroke-dasharray="dashed ? '3 3' : undefined" vector-effect="non-scaling-stroke" class="sparkline-path" />
    <circle :cx="geometry.last[0]" :cy="geometry.last[1]" r="2.6" :fill="color" class="sparkline-dot" />
  </svg>
</template>

<style scoped>
.sparkline{display:block;overflow:visible}
</style>
