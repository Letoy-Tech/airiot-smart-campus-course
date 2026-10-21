<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAlarms } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { timeLabel } from '@/utils/campus'
import ResourceState from '@/components/campus/ResourceState.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
defineOptions({ name: 'CampusAlarms' })
const skip = ref(0)
const { data, loading, error, lastSuccess, nextRefreshAt, load } = useResource(() => getAlarms(skip.value), 30000)
const page = async (amount: number) => { if (loading.value) return; const old = skip.value; skip.value = Math.max(0, skip.value + amount); await load(); if (error.value) skip.value = old }
// 等级与状态保留上游原始枚举，仅按原值分组计数，不推断语义
const groupBy = (key: 'level' | 'status') => {
  const map = new Map<string, number>()
  for (const item of data.value?.items || []) { const value = item[key] || '未提供'; map.set(value, (map.get(value) || 0) + 1) }
  return [...map].sort((a, b) => b[1] - a[1])
}
const levels = computed(() => groupBy('level'))
const statuses = computed(() => groupBy('status'))
const withRecovery = computed(() => data.value?.items.filter(item => typeof item.recoveryTime === 'number').length ?? 0)
const pageCount = computed(() => data.value?.items.length ?? 0)
</script>
<template><div class="campus-page alarms-page">
  <header class="campus-page-head"><div><p class="campus-eyebrow">事件监测</p><h1>报警<span class="gradient-text">记录</span></h1><p>保留 AIRIOT 的原始状态与等级，仅查询模拟项目报警。</p></div><div class="campus-page-actions"><LivePulse :loading="loading" :error="error" :last-success="lastSuccess" :next-at="nextRefreshAt" :interval="30000" /><button class="campus-button" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>刷新</button></div></header>
  <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
  <template v-if="data">
    <div class="campus-kpi-grid">
      <KpiCard :index="0" label="报警总数" icon="ri-alarm-warning-line" tone="rose" :value="data.total" unit="条" :hint="data.total === null ? '上游未提供总数' : '上游返回总数'" />
      <KpiCard :index="1" label="本页记录" icon="ri-file-list-3-line" tone="blue" :value="pageCount" unit="条" :hint="`第 ${Math.floor(skip / 50) + 1} 页`" />
      <KpiCard :index="2" label="本页有恢复时间" icon="ri-restart-line" tone="emerald" :value="withRecovery" :suffix="`/ ${pageCount}`" :ratio="pageCount ? withRecovery / pageCount : null" ratio-label="本页有恢复时间的记录占比" hint="以上游恢复时间字段为准" />
      <KpiCard :index="3" label="本页原始等级" icon="ri-stack-line" tone="violet" :value="levels.length" unit="种" hint="保留上游枚举，不做映射" />
    </div>
    <div v-if="data.items.length" class="alarm-facets campus-panel">
      <div><h3>原始等级 · 本页</h3><div class="facet-chips"><span v-for="[name, count] in levels" :key="name" class="facet-chip"><b>{{ name }}</b><em>{{ count }}</em></span></div></div>
      <div><h3>原始状态 · 本页</h3><div class="facet-chips"><span v-for="[name, count] in statuses" :key="name" class="facet-chip"><b>{{ name }}</b><em>{{ count }}</em></span></div></div>
    </div>
    <p class="campus-source">读取 {{ timeLabel(data.observedAt) }} · 总数 {{ data.total ?? '上游未提供' }} · 每30秒静默刷新</p>
    <ul v-if="data.issues.length" class="campus-notice warning"><li v-for="(issue, index) in data.issues" :key="index">{{ issue.message }}</li></ul>
    <div class="campus-table-scroll"><table class="campus-table"><thead><tr><th scope="col">报警内容</th><th scope="col">设备 / 点位</th><th scope="col">等级</th><th scope="col">原始状态</th><th scope="col">发生 / 恢复</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id"><td><span class="alarm-message"><i class="ri-alarm-warning-line" aria-hidden="true"></i><span>{{ item.message }}<small>{{ item.id }} · 模拟</small></span></span></td><td>{{ item.deviceName || item.deviceId || '未提供设备' }}<small>{{ item.tagId || '未提供点位' }}</small></td><td><span class="campus-chip">{{ item.level || '未提供' }}</span></td><td><span class="campus-chip info">{{ item.status || '未提供' }}</span></td><td>{{ timeLabel(item.time) }}<small>恢复：{{ timeLabel(item.recoveryTime) }}</small></td></tr></tbody></table></div>
    <p v-if="!data.items.length" class="campus-empty">本次查询未返回报警。空列表不代表报警机制已验收，管理员可在接入状态中核对能力。</p>
    <div class="campus-pagination"><button class="campus-button secondary" :disabled="loading || skip === 0" @click="page(-50)"><i class="ri-arrow-left-s-line" aria-hidden="true"></i>上一页</button><span>第 {{ Math.floor(skip / 50) + 1 }} 页</span><button class="campus-button secondary" :disabled="loading || (data.total !== null ? skip + 50 >= data.total : data.items.length < 50)" @click="page(50)">下一页<i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></div>
  </template>
</div></template>
<style scoped>
.alarm-facets{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 20px;margin-bottom:4px}
.alarm-facets h3{font-size:12.5px;font-weight:600;color:var(--text-tertiary);margin-bottom:10px;letter-spacing:.04em}
.facet-chips{display:flex;flex-wrap:wrap;gap:8px}
.facet-chip{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 12px;border-radius:999px;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--surface-inset);border:1px solid var(--border-base)}
.facet-chip b{font-weight:500;color:var(--text-secondary)}
.facet-chip em{font-style:normal;min-width:22px;height:20px;padding:0 7px;border-radius:999px;display:grid;place-items:center;font-size:11.5px;color:#fff;background:var(--brand-gradient)}
.alarm-message{display:flex;gap:10px;align-items:flex-start}
.alarm-message>i{width:28px;height:28px;flex-shrink:0;border-radius:9px;display:grid;place-items:center;color:var(--bad);background:var(--bad-soft)}
@media(max-width:768px){.alarm-facets{grid-template-columns:1fr}}
</style>
