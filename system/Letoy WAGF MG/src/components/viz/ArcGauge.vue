<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import CountUp from './CountUp.vue'

/**
 * 半圆表盘。min/max 为显示刻度，在表盘两端标出；超出刻度时指针停在端点但数值照实显示。
 * value 为 null 时不画指针与弧，显示“未取得”。
 */
const props = withDefaults(defineProps<{ value: number | null; min?: number; max: number; unit?: string; color?: string; glow?: string; caption?: string; stale?: boolean }>(), {
  min: 0, unit: '', color: 'var(--brand-2)', glow: 'var(--brand-1)', caption: '', stale: false,
})
const id = useId()
const mounted = ref(false)
onMounted(() => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { mounted.value = true }); else mounted.value = true })
const span = computed(() => Math.max(1e-9, props.max - props.min))
const ratio = computed(() => (props.value === null || !Number.isFinite(props.value) ? null : Math.max(0, Math.min(1, (props.value - props.min) / span.value))))
const shownRatio = computed(() => (mounted.value ? ratio.value ?? 0 : 0))
const angle = computed(() => -90 + shownRatio.value * 180)
const ticks = Array.from({ length: 21 }, (_, i) => i)
const fmt = (v: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(v)
</script>

<template>
  <div class="arc-gauge" :class="{ stale }">
    <svg viewBox="0 0 200 118" aria-hidden="true">
      <defs>
        <linearGradient :id="`a-${id}`" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="glow" />
          <stop offset="100%" :stop-color="color" />
        </linearGradient>
      </defs>
      <g class="arc-ticks">
        <line v-for="i in ticks" :key="i" x1="100" y1="16" x2="100" :y2="i % 5 === 0 ? 25 : 21" :transform="`rotate(${-90 + i * 9} 100 100)`" :class="{ major: i % 5 === 0, lit: ratio !== null && i / 20 <= shownRatio }" />
      </g>
      <path class="arc-track" d="M 26 100 A 74 74 0 0 1 174 100" pathLength="100" />
      <path v-if="ratio !== null" class="arc-value" d="M 26 100 A 74 74 0 0 1 174 100" pathLength="100" :stroke="`url(#a-${id})`" :stroke-dasharray="`${shownRatio * 100} 100`" />
      <g v-if="ratio !== null" class="arc-needle" :style="{ transform: `rotate(${angle}deg)` }">
        <path d="M 100 38 L 103.5 100 L 96.5 100 Z" />
      </g>
      <circle cx="100" cy="100" r="7" class="arc-hub" />
      <text x="26" y="116" text-anchor="middle" class="arc-limit">{{ fmt(min) }}</text>
      <text x="174" y="116" text-anchor="middle" class="arc-limit">{{ fmt(max) }}</text>
    </svg>
    <div class="arc-readout">
      <strong><CountUp :value="value" placeholder="未取得" /></strong><span v-if="value !== null && unit">{{ unit }}</span>
    </div>
    <p v-if="caption" class="arc-caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.arc-gauge{position:relative;width:100%;max-width:240px;margin:0 auto;text-align:center}
.arc-gauge svg{width:100%;display:block;overflow:visible}
.arc-track{fill:none;stroke:var(--ring-track);stroke-width:12;stroke-linecap:round}
.arc-value{fill:none;stroke-width:12;stroke-linecap:round;transition:stroke-dasharray 1.1s cubic-bezier(.22,.8,.24,1);filter:drop-shadow(0 0 8px var(--ring-glow))}
.arc-ticks line{stroke:var(--border-strong);stroke-width:1.2;stroke-linecap:round;transition:stroke .6s ease}
.arc-ticks line.major{stroke-width:2}
.arc-ticks line.lit{stroke:var(--text-secondary)}
.arc-needle{transform-origin:100px 100px;transition:transform 1.1s cubic-bezier(.34,1.3,.5,1)}
.arc-needle path{fill:var(--text-main);opacity:.85}
.arc-hub{fill:var(--bg-card);stroke:var(--text-main);stroke-width:3}
.arc-limit{font-size:10px;fill:var(--text-tertiary);font-variant-numeric:tabular-nums}
.arc-readout{margin-top:-2px;display:flex;align-items:baseline;justify-content:center;gap:4px}
.arc-readout strong{font-size:30px;font-weight:700;letter-spacing:-.02em;font-family:var(--font-number);color:var(--text-main)}
.arc-readout>span{font-size:12px;color:var(--text-secondary)}
.arc-caption{font-size:11px;color:var(--text-tertiary);margin-top:2px}
.stale .arc-value{opacity:.55}
.stale .arc-readout strong{color:var(--warn-text)}
</style>
