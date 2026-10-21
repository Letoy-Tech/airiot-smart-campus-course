<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

/** 数值滚动。仅对真实取得的数值做过渡；未取得时显示 placeholder，绝不以 0 代替。 */
const props = withDefaults(defineProps<{ value: number | null | undefined; decimals?: number; placeholder?: string; duration?: number }>(), { placeholder: '—', duration: 900 })
const shown = ref<number | null>(null)
let frame = 0

const digits = computed(() => {
  if (typeof props.decimals === 'number') return props.decimals
  const v = props.value
  if (typeof v !== 'number' || Number.isInteger(v)) return 0
  return Math.min(3, (String(v).split('.')[1] || '').length)
})
const format = (v: number) => new Intl.NumberFormat('zh-CN', { minimumFractionDigits: digits.value, maximumFractionDigits: digits.value }).format(v)
const text = computed(() => (shown.value === null ? props.placeholder : format(shown.value)))

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

function animate(to: number) {
  cancelAnimationFrame(frame)
  const from = shown.value ?? 0
  if (reduced() || typeof requestAnimationFrame !== 'function' || from === to) { shown.value = to; return }
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / props.duration)
    const eased = 1 - Math.pow(1 - p, 4)
    shown.value = from + (to - from) * eased
    if (p < 1) frame = requestAnimationFrame(step)
    else shown.value = to
  }
  frame = requestAnimationFrame(step)
}

watch(() => props.value, value => {
  if (typeof value === 'number' && Number.isFinite(value)) animate(value)
  else { cancelAnimationFrame(frame); shown.value = null }
}, { immediate: true })
onUnmounted(() => cancelAnimationFrame(frame))
</script>

<template><span class="count-up">{{ text }}</span></template>

<style scoped>.count-up{font-variant-numeric:tabular-nums}</style>
