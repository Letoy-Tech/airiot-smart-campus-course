<script setup lang="ts">
import CountUp from './CountUp.vue'
import RingGauge from './RingGauge.vue'

export type KpiTone = 'cyan' | 'blue' | 'violet' | 'amber' | 'emerald' | 'rose' | 'teal'

withDefaults(defineProps<{
  label: string
  value: number | null
  icon?: string
  tone?: KpiTone
  suffix?: string
  unit?: string
  hint?: string
  warn?: boolean
  ratio?: number | null
  ratioLabel?: string
  decimals?: number
  index?: number
}>(), { icon: 'ri-pulse-line', tone: 'blue', suffix: '', unit: '', hint: '', warn: false, ratio: undefined, ratioLabel: '', decimals: undefined, index: 0 })
</script>

<template>
  <article class="kpi-card fx-spotlight fx-tilt" :class="`tone-${tone}`" :style="{ '--i': index }">
    <div class="kpi-main">
      <div class="kpi-label"><span class="kpi-icon" aria-hidden="true"><i :class="icon"></i></span>{{ label }}</div>
      <div class="kpi-value">
        <strong><CountUp :value="value" :decimals="decimals" /></strong>
        <span v-if="unit" class="kpi-unit">{{ unit }}</span>
        <span v-if="suffix" class="kpi-suffix">{{ suffix }}</span>
      </div>
      <p v-if="hint || $slots.hint" class="kpi-hint" :class="{ warn }"><slot name="hint">{{ hint }}</slot></p>
    </div>
    <span v-if="ratio !== undefined" class="kpi-ring"><RingGauge :ratio="ratio" :size="70" :stroke="7" :from="`var(--tone-a)`" :to="`var(--tone-b)`" :label="ratioLabel">
      <span class="kpi-ring-text">{{ ratio === null ? '—' : `${Math.round(ratio * 100)}%` }}</span>
    </RingGauge></span>
    <slot />
  </article>
</template>

<style scoped>
.kpi-card{position:relative;display:flex;align-items:center;gap:14px;padding:20px 20px 18px;border-radius:var(--radius-card);background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);min-width:0;isolation:isolate;transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .25s ease,box-shadow .3s ease,border-color .3s ease;animation:fx-rise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0) * 70ms)}
.kpi-card::after{content:'';position:absolute;inset:auto 18px 0 18px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--tone-a),var(--tone-b));opacity:.75}
@media(hover:hover){.kpi-card:hover{box-shadow:var(--shadow-hover);border-color:var(--border-strong)}}
.tone-cyan{--tone-a:#22d3ee;--tone-b:#0ea5e9}
.tone-blue{--tone-a:#38bdf8;--tone-b:#6366f1}
.tone-violet{--tone-a:#a78bfa;--tone-b:#d946ef}
.tone-amber{--tone-a:#fcd34d;--tone-b:#f97316}
.tone-emerald{--tone-a:#6ee7b7;--tone-b:#10b981}
.tone-teal{--tone-a:#5eead4;--tone-b:#0d9488}
.tone-rose{--tone-a:#fda4af;--tone-b:#e11d48}
.kpi-main{flex:1;min-width:0}
.kpi-card{container-type:inline-size}
.kpi-ring{display:block;flex-shrink:0}
.kpi-label{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-secondary);font-weight:500}
.kpi-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;color:#fff;background:linear-gradient(135deg,var(--tone-a),var(--tone-b));box-shadow:0 6px 16px -6px var(--tone-b);flex-shrink:0}
.kpi-value{display:flex;align-items:baseline;gap:6px;margin-top:14px;flex-wrap:wrap}
.kpi-value strong{font-size:32px;line-height:1.05;font-weight:700;letter-spacing:-.03em;font-family:var(--font-number);color:var(--text-main)}
.kpi-unit{font-size:13px;color:var(--text-secondary);font-weight:500}
.kpi-suffix{font-size:14px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
.kpi-hint{margin-top:8px;font-size:12px;color:var(--text-tertiary);line-height:1.5}
.kpi-hint.warn{color:var(--warn-text)}
.kpi-ring-text{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text-main)}
@media(max-width:560px){.kpi-card{padding:16px 14px 15px;gap:10px}.kpi-value strong{font-size:26px}.kpi-icon{width:30px;height:30px;font-size:15px;border-radius:9px}.kpi-label{font-size:12px;gap:8px}}
@container (max-width:250px){.kpi-ring{align-self:flex-start}.kpi-ring :deep(.ring-gauge){width:50px!important;height:50px!important}.kpi-ring-text{font-size:11px}.kpi-value strong{font-size:27px}.kpi-label{gap:8px;font-size:12px}.kpi-icon{width:30px;height:30px;font-size:15px}}
</style>
