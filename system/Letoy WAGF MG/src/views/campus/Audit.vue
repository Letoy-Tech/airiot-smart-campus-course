<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAudit } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { switchLabel, timeLabel } from '@/utils/campus'
import ResourceState from '@/components/campus/ResourceState.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
defineOptions({ name: 'CampusAudit' })
const skip = ref(0)
const { data, loading, error, lastSuccess, load } = useResource(() => getAudit(skip.value))
const page = async (amount: number) => { if (loading.value) return; const old = skip.value; skip.value = Math.max(0, skip.value + amount); await load(); if (error.value) skip.value = old }
const confirmedCount = computed(() => data.value?.items.filter(item => item.confirmed !== null && item.confirmed === item.requested).length ?? 0)
const failedCount = computed(() => data.value?.items.filter(item => !!item.error).length ?? 0)
const pageCount = computed(() => data.value?.items.length ?? 0)
const state = (value: boolean | null) => (value === true ? 'on' : value === false ? 'off' : 'unknown')
</script>
<template><div class="campus-page audit-page">
  <header class="campus-page-head"><div><p class="campus-eyebrow">管理与安全</p><h1>模拟命令<span class="gradient-text">审计</span></h1><p>BE 保存操作身份、理由、预期状态和写后回读结果。</p></div><button class="campus-button" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>刷新</button></header>
  <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
  <template v-if="data">
    <div class="campus-kpi-grid">
      <KpiCard :index="0" label="审计总数" icon="ri-file-shield-2-line" tone="blue" :value="data.total" unit="条" hint="仅管理员可读取" />
      <KpiCard :index="1" label="本页记录" icon="ri-file-list-3-line" tone="cyan" :value="pageCount" unit="条" :hint="`第 ${Math.floor(skip / 50) + 1} 页`" />
      <KpiCard :index="2" label="本页回读一致" icon="ri-shield-check-line" tone="emerald" :value="confirmedCount" :suffix="`/ ${pageCount}`" :ratio="pageCount ? confirmedCount / pageCount : null" ratio-label="本页回读值与目标一致的占比" hint="确认值等于目标值" />
      <KpiCard :index="3" label="本页带失败详情" icon="ri-error-warning-line" tone="rose" :value="failedCount" unit="条" :hint="failedCount ? '见理由 / 失败详情列' : '本页无失败详情'" :warn="failedCount > 0" />
    </div>
    <p class="campus-source">共 {{ data.total }} 条 · 仅管理员可读取</p>
    <div class="campus-table-scroll"><table class="campus-table"><thead><tr><th scope="col">时间 / 操作者</th><th scope="col">设备</th><th scope="col">之前 → 目标</th><th scope="col">确认值 / 结果</th><th scope="col">理由 / 失败详情</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id"><td>{{ timeLabel(item.createdAt) }}<small>{{ item.actorName || item.actorId }}</small></td><td><strong>{{ item.deviceId }}</strong><small>{{ item.id }}</small></td><td><span class="audit-flow"><span class="mini-switch" :class="state(item.before)" aria-hidden="true"></span>{{ switchLabel(item.before) }}<i class="ri-arrow-right-line" aria-hidden="true"></i><span class="mini-switch" :class="state(item.requested)" aria-hidden="true"></span>{{ switchLabel(item.requested) }}</span></td><td><span class="campus-chip" :class="item.confirmed !== null && item.confirmed === item.requested ? 'ok' : item.error ? 'bad' : ''">{{ switchLabel(item.confirmed) }}</span><small>{{ item.outcome }}</small></td><td>{{ item.reason }}<small v-if="item.error" class="campus-error-text">{{ item.error }}</small></td></tr></tbody></table></div>
    <p v-if="!data.items.length" class="campus-empty">当前页没有模拟命令记录。管理员与校园管理人员提交的操作由 BE 留存。</p>
    <div class="campus-pagination"><button class="campus-button secondary" :disabled="loading || skip === 0" @click="page(-50)"><i class="ri-arrow-left-s-line" aria-hidden="true"></i>上一页</button><span>第 {{ Math.floor(skip / 50) + 1 }} 页</span><button class="campus-button secondary" :disabled="loading || skip + 50 >= data.total" @click="page(50)">下一页<i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></div>
  </template>
</div></template>
<style scoped>
.audit-flow{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.audit-flow i{color:var(--text-tertiary)}
.mini-switch{position:relative;width:22px;height:12px;border-radius:999px;background:var(--ring-track)}
.mini-switch::after{content:'';position:absolute;top:2px;left:2px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.mini-switch.on{background:var(--ok)}
.mini-switch.on::after{left:12px}
.mini-switch.unknown{background:repeating-linear-gradient(45deg,var(--ring-track) 0 3px,transparent 3px 6px);box-shadow:inset 0 0 0 1px var(--border-strong)}
.mini-switch.unknown::after{left:7px;opacity:.6}
</style>
