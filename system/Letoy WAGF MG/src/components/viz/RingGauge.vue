<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'

/** 环形进度。ratio 为 null 时只画虚线轨道，表示无法计算，而不是 0%。 */
const props = withDefaults(defineProps<{ ratio: number | null; size?: number; stroke?: number; from?: string; to?: string; label?: string }>(), {
  size: 84, stroke: 8, from: 'var(--brand-1)', to: 'var(--brand-3)', label: '',
})
const id = useId()
const mounted = ref(false)
onMounted(() => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { mounted.value = true }); else mounted.value = true })
const r = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * r.value)
const clamped = computed(() => (props.ratio === null || !Number.isFinite(props.ratio) ? null : Math.max(0, Math.min(1, props.ratio))))
const offset = computed(() => (clamped.value === null || !mounted.value ? circumference.value : circumference.value * (1 - clamped.value)))
</script>

<template>
  <div class="ring-gauge" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="label || (clamped === null ? '无法计算比例' : `${Math.round(clamped * 100)}%`)">
      <defs>
        <linearGradient :id="`g-${id}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="from" />
          <stop offset="100%" :stop-color="to" />
        </linearGradient>
      </defs>
      <circle class="ring-track" :class="{ unknown: clamped === null }" :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="stroke" />
      <circle
        v-if="clamped !== null"
        class="ring-value"
        :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="stroke"
        :stroke="`url(#g-${id})`"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="ring-center"><slot /></div>
  </div>
</template>

<style scoped>
.ring-gauge{position:relative;flex-shrink:0}
.ring-gauge svg{width:100%;height:100%;overflow:visible}
.ring-track{fill:none;stroke:var(--ring-track)}
.ring-track.unknown{stroke-dasharray:3 5}
.ring-value{fill:none;stroke-linecap:round;transition:stroke-dashoffset 1.1s cubic-bezier(.22,.8,.24,1);filter:drop-shadow(0 0 6px var(--ring-glow))}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.1}
</style>
