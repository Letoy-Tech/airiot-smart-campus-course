<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { timeLabel } from '@/utils/campus'

/**
 * 轮询状态指示：只反映页面真实的读取周期。
 * 同步中显示旋转环；最近一次成功显示脉冲点与距下次读取的倒计时；失败显示琥珀色并保留上次成功时间。
 */
const props = withDefaults(defineProps<{ loading: boolean; error?: string; lastSuccess?: number | null; nextAt?: number | null; interval?: number; label?: string }>(), {
  error: '', lastSuccess: null, nextAt: null, interval: 15000, label: 'AIRIOT',
})
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 250) })
onUnmounted(() => clearInterval(timer))

const state = computed(() => (props.loading ? 'sync' : props.error ? 'stale' : props.lastSuccess ? 'live' : 'idle'))
const remaining = computed(() => (props.nextAt ? Math.max(0, props.nextAt - now.value) : null))
const progress = computed(() => (remaining.value === null ? 0 : 1 - remaining.value / props.interval))
const circumference = 2 * Math.PI * 7
const text = computed(() => {
  if (state.value === 'sync') return '正在读取'
  if (state.value === 'stale') return '读取失败 · 保留上次数据'
  if (state.value === 'live') return remaining.value !== null ? `${Math.ceil(remaining.value / 1000)}s 后刷新` : '已读取'
  return '等待读取'
})
</script>

<template>
  <div class="live-pulse" :class="state" :title="lastSuccess ? `上次成功读取 ${timeLabel(lastSuccess)}` : '尚未成功读取'">
    <span class="live-indicator" aria-hidden="true">
      <svg viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" class="lp-track" />
        <circle v-if="state === 'live' && remaining !== null" cx="9" cy="9" r="7" class="lp-progress" :stroke-dasharray="circumference" :stroke-dashoffset="circumference * (1 - progress)" transform="rotate(-90 9 9)" />
      </svg>
      <span class="lp-dot"></span>
    </span>
    <span class="lp-source">{{ label }}</span>
    <span class="lp-text">{{ text }}</span>
  </div>
</template>

<style scoped>
.live-pulse{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 8px;border-radius:999px;border:1px solid var(--border-base);background:var(--surface-1);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);font-size:12px;color:var(--text-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.live-indicator{position:relative;width:18px;height:18px;display:grid;place-items:center}
.live-indicator svg{position:absolute;inset:0;width:18px;height:18px}
.lp-track{fill:none;stroke:var(--ring-track);stroke-width:2}
.lp-progress{fill:none;stroke:var(--ok);stroke-width:2;stroke-linecap:round;transition:stroke-dashoffset .25s linear}
.lp-dot{width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);position:relative}
.live .lp-dot{background:var(--ok);box-shadow:0 0 0 0 var(--ok);animation:lp-ping 2s cubic-bezier(0,0,.2,1) infinite}
.stale .lp-dot{background:var(--warn)}
.stale{color:var(--warn-text);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.sync .lp-track{stroke:var(--brand-2);stroke-dasharray:11 33;animation:lp-spin .9s linear infinite;transform-origin:9px 9px}
.sync .lp-dot{background:var(--brand-2)}
.lp-source{font-weight:600;color:var(--text-main);letter-spacing:.02em}
@keyframes lp-ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 70%,transparent)}80%,100%{box-shadow:0 0 0 7px transparent}}
@keyframes lp-spin{to{transform:rotate(360deg)}}
@media(max-width:560px){.lp-source{display:none}}
</style>
